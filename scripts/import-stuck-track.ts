// Atualiza o Stuck a partir dos CSVs de tracking (export_return_order_*.csv).
// Casa por Order ID com pacotes existentes (conjunto do dia do backlog).
// Atualiza status/motorista; status Delivered → marca delivered_at (nunca deleta).
// Registra 1 checkpoint (burn-down). Não adiciona pacotes novos.
// Uso:
//   node scripts/import-stuck-track.ts "data/shopee/stuck/stuck_track"          (aplica)
//   node scripts/import-stuck-track.ts "data/shopee/stuck/stuck_track" --dry
import pg from "pg"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { resolveDriver, dedupeById, type ParsedDriver } from "../src/lib/shopee/drivers.ts"
import { parseCsvObjects } from "../src/lib/shopee/csv.ts"
import { dataPtBrHoje, recordCheckpoints } from "./_checkpoints.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function loadEnv() {
  const txt = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8")
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

function labelFromFiles(files: string[]): string {
  // extrai HH:MM do primeiro nome export_return_order_YYYY-MM-DD_HH-MM-SS
  for (const f of files) {
    const m = path.basename(f).match(/_(\d{2})-(\d{2})-(\d{2})/)
    if (m) return `Tracking ${m[1]}:${m[2]}`
  }
  return "Tracking"
}

async function main() {
  const dir = process.argv[2]
  const dry = process.argv.includes("--dry")
  if (!dir) throw new Error('Informe a pasta. Ex: node scripts/import-stuck-track.ts "data/shopee/stuck/stuck_track"')
  loadEnv()

  const files = fs
    .readdirSync(path.resolve(ROOT, dir))
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .map((f) => path.resolve(ROOT, dir, f))
    .sort()

  // codigo -> {status, driver}  (último registro vence)
  const latest = new Map<string, { status: string; driver: ParsedDriver | null }>()
  const driversFound: ParsedDriver[] = []
  let totalRows = 0
  for (const f of files) {
    const objs = parseCsvObjects(fs.readFileSync(f, "utf8"))
    for (const o of objs) {
      const codigo = (o["Order ID"] || "").trim()
      if (!codigo) continue
      totalRows++
      const status = (o["Status"] || "").trim()
      const drv = resolveDriver(o["Driver Name"] || "", o["Driver ID"] || "")
      if (drv) driversFound.push(drv)
      latest.set(codigo, { status, driver: drv })
    }
    console.log(`  ${path.basename(f)}: ${objs.length} linhas`)
  }
  const drivers = dedupeById(driversFound)
  console.log(`\nTOTAL linhas=${totalRows} | códigos distintos=${latest.size} | motoristas distintos=${drivers.length}`)

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    // pacotes existentes (conjunto do dia)
    const existing = await client.query("select id, codigo, base_id, delivered_at from shopee_package")
    const byCode = new Map<string, { id: number; baseId: string; delivered: boolean }>()
    for (const r of existing.rows) byCode.set(r.codigo, { id: Number(r.id), baseId: String(r.base_id), delivered: r.delivered_at != null })

    // monta updates só p/ códigos existentes
    const ids: number[] = [], statuses: string[] = [], drv: (string | null)[] = []
    const basesAfetadas = new Set<string>()
    let matched = 0, willDeliver = 0
    for (const [codigo, info] of latest) {
      const pkg = byCode.get(codigo)
      if (!pkg) continue
      matched++
      if (info.status === "Delivered" && !pkg.delivered) willDeliver++
      ids.push(pkg.id)
      statuses.push(info.status)
      drv.push(info.driver?.id ?? null)
      basesAfetadas.add(pkg.baseId)
    }
    console.log(`casados com o conjunto do dia: ${matched} | novos entregues: ${willDeliver} | bases afetadas: ${basesAfetadas.size}`)

    if (dry) {
      console.log("\n[--dry] nada gravado.")
      return
    }

    // 1) registra motoristas novos
    const existingDrv = await client.query("select id from driver")
    const valid = new Set(existingDrv.rows.map((r) => String(r.id)))
    const op = await client.query("select id from operacao where slug='shopee'")
    const operacaoId = op.rows[0].id
    let drvNew = 0
    for (const d of drivers) {
      if (valid.has(d.id)) continue
      try {
        await client.query(
          `insert into driver (id, operacao_id, name, normalized_key) values ($1,$2,$3,$4)
           on conflict (id) do update set name=excluded.name, updated_at=now()`,
          [d.id, operacaoId, d.name, d.key],
        )
        valid.add(d.id)
        drvNew++
      } catch { /* colisão de nome — ignora */ }
    }
    // zera driver_id que não pôde ser registrado
    const drvSafe = drv.map((x) => (x && valid.has(x) ? x : null))
    console.log(`motoristas: +${drvNew} novos`)

    // 2) update em massa (coalesce mantém motorista quando tracking não traz)
    await client.query(
      `update shopee_package p set
         status = u.status,
         driver_id = coalesce(u.driver_id, p.driver_id),
         last_status_at = now(),
         updated_at = now(),
         delivered_at = case when u.status='Delivered' and p.delivered_at is null then now() else p.delivered_at end
       from unnest($1::bigint[], $2::text[], $3::text[]) as u(id, status, driver_id)
       where p.id = u.id`,
      [ids, statuses, drvSafe],
    )

    // 3) eventos
    await client.query(
      `insert into shopee_package_event (package_id, status, dias_preso, driver_id)
       select id, status, null, driver_id from unnest($1::bigint[], $2::text[], $3::text[]) as u(id, status, driver_id)`,
      [ids, statuses, drvSafe],
    )
    console.log(`pacotes atualizados: ${ids.length} | eventos: ${ids.length}`)

    // 4) checkpoint
    await recordCheckpoints(client, [...basesAfetadas], labelFromFiles(files), dataPtBrHoje())
    console.log(`checkpoint "${labelFromFiles(files)}" gravado`)
    console.log("\n✓ tracking aplicado")
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error("FALHA:", e.message)
  process.exit(1)
})

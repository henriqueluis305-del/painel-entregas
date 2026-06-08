// Importa o backlog inicial de Stuck a partir dos xlsx.
// Mantém só pacotes em stuck (floor(LM Hub Days) >= 1 e status != Delivered).
// Cadastra motoristas encontrados (resolver canônico). Upsert por (base, codigo).
// Uso:
//   node scripts/import-backlog.ts "data/shopee/stuck/backlogs"          (aplica)
//   node scripts/import-backlog.ts "data/shopee/stuck/backlogs" --dry    (preview)
import ExcelJS from "exceljs"
import pg from "pg"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { resolveDriver, dedupeById, type ParsedDriver } from "../src/lib/shopee/drivers.ts"
import { isStuck, parseDiasPreso, resolveBaseSlug } from "../src/lib/shopee/stuck.ts"
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

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

type Row = {
  baseSlug: string
  codigo: string
  status: string
  dias: number | null
  driverId: string | null
  agency: string | null
}

async function readBacklog(file: string): Promise<{ rows: Row[]; drivers: ParsedDriver[]; total: number }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  const ws = wb.worksheets[0]
  const header = ws.getRow(1)
  const col: Record<string, number> = {}
  header.eachCell((cell, c) => {
    col[String(cell.value ?? "").trim()] = c
  })
  const get = (r: ExcelJS.Row, name: string) => {
    const c = col[name]
    const v = c ? r.getCell(c).value : null
    return v == null ? "" : String(typeof v === "object" && "text" in v ? v.text : v).trim()
  }

  const rows: Row[] = []
  const drivers: ParsedDriver[] = []
  let total = 0
  for (let i = 2; i <= ws.rowCount; i++) {
    const r = ws.getRow(i)
    const codigo = get(r, "Shipment ID")
    if (!codigo) continue
    total++
    const status = get(r, "Latest Status")
    const dias = parseDiasPreso(get(r, "LM Hub Days"))
    if (!isStuck(get(r, "LM Hub Days"), status)) continue
    const drv = resolveDriver(get(r, "Latest User Name"))
    if (drv) drivers.push(drv)
    rows.push({
      baseSlug: resolveBaseSlug(get(r, "Station Name")),
      codigo,
      status,
      dias,
      driverId: drv?.id ?? null,
      agency: get(r, "Agency Name") || null,
    })
  }
  return { rows, drivers, total }
}

async function main() {
  const dir = process.argv[2]
  const dry = process.argv.includes("--dry")
  if (!dir) throw new Error('Informe a pasta. Ex: node scripts/import-backlog.ts "data/shopee/stuck/backlogs"')
  loadEnv()

  const files = fs
    .readdirSync(path.resolve(ROOT, dir))
    .filter((f) => f.toLowerCase().endsWith(".xlsx"))
    .map((f) => path.resolve(ROOT, dir, f))
    .sort()

  let allRows: Row[] = []
  let allDrivers: ParsedDriver[] = []
  let grandTotal = 0
  for (const f of files) {
    const { rows, drivers, total } = await readBacklog(f)
    allRows = allRows.concat(rows)
    allDrivers = allDrivers.concat(drivers)
    grandTotal += total
    console.log(`  ${path.basename(f)}: ${total} linhas | stuck=${rows.length}`)
  }
  const drivers = dedupeById(allDrivers)
  console.log(`\nTOTAL linhas=${grandTotal} | STUCK=${allRows.length} | motoristas distintos no backlog=${drivers.length}`)

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const op = await client.query("select id from operacao where slug='shopee'")
    const operacaoId = op.rows[0].id
    const baseRows = await client.query(
      "select id, slug from base where operacao_id=$1",
      [operacaoId],
    )
    const baseId = new Map<string, string>(baseRows.rows.map((b) => [b.slug, String(b.id)]))

    // bases não resolvidas
    const unresolved = [...new Set(allRows.map((r) => r.baseSlug).filter((s) => !baseId.has(s)))]
    if (unresolved.length) console.log(`⚠ bases sem cadastro (linhas ignoradas): ${unresolved.join(", ")}`)
    const rows = allRows.filter((r) => baseId.has(r.baseSlug))

    // por base
    const perBase = new Map<string, number>()
    for (const r of rows) perBase.set(r.baseSlug, (perBase.get(r.baseSlug) ?? 0) + 1)
    console.log("por base:", [...perBase.entries()].map(([s, n]) => `${s}=${n}`).join(" | "))

    if (dry) {
      console.log("\n[--dry] nada gravado.")
      return
    }

    // 1) motoristas (preload existentes + upsert novos; coleta ids válidos p/ FK)
    const existing = await client.query("select id from driver")
    const validDrivers = new Set(existing.rows.map((r) => String(r.id)))
    let drvNew = 0, drvFail = 0
    for (const d of drivers) {
      if (validDrivers.has(d.id)) continue
      try {
        await client.query(
          `insert into driver (id, operacao_id, name, normalized_key) values ($1,$2,$3,$4)
           on conflict (id) do update set name=excluded.name, updated_at=now()`,
          [d.id, operacaoId, d.name, d.key],
        )
        validDrivers.add(d.id)
        drvNew++
      } catch (e) {
        drvFail++
        console.log(`   ✗ motorista id=${d.id} (${d.name}): ${(e as Error).message}`)
      }
    }
    console.log(`motoristas: +${drvNew} novos | ${drvFail} falhas`)

    // 2) pacotes (upsert em lote) → mapeia chave -> package id
    const keyToId = new Map<string, number>()
    let pkgUp = 0
    for (const ch of chunk(rows, 1000)) {
      const vals: unknown[] = []
      const tuples = ch.map((r, i) => {
        const b = i * 6
        vals.push(
          baseId.get(r.baseSlug),
          r.codigo,
          r.status,
          r.driverId && validDrivers.has(r.driverId) ? r.driverId : null,
          r.dias,
          r.agency,
        )
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`
      })
      const res = await client.query(
        `insert into shopee_package (base_id, codigo, status, driver_id, dias_preso, agency)
         values ${tuples.join(",")}
         on conflict (base_id, codigo) do update set
           status=excluded.status, driver_id=excluded.driver_id,
           dias_preso=excluded.dias_preso, agency=excluded.agency,
           last_status_at=now(), updated_at=now()
         returning id, base_id, codigo`,
        vals,
      )
      for (const row of res.rows) keyToId.set(`${row.base_id}|${row.codigo}`, row.id)
      pkgUp += res.rowCount ?? 0
    }
    console.log(`pacotes upsert: ${pkgUp}`)

    // 3) eventos (1 por pacote deste import)
    let evt = 0
    for (const ch of chunk(rows, 1000)) {
      const vals: unknown[] = []
      const tuples: string[] = []
      let k = 0
      for (const r of ch) {
        const pid = keyToId.get(`${baseId.get(r.baseSlug)}|${r.codigo}`)
        if (!pid) continue
        const b = k * 4
        vals.push(pid, r.status, r.dias, r.driverId && validDrivers.has(r.driverId) ? r.driverId : null)
        tuples.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4})`)
        k++
      }
      if (!tuples.length) continue
      const res = await client.query(
        `insert into shopee_package_event (package_id, status, dias_preso, driver_id) values ${tuples.join(",")}`,
        vals,
      )
      evt += res.rowCount ?? 0
    }
    console.log(`eventos inseridos: ${evt}`)

    // checkpoint inicial (seq por base/dia)
    const dataPtBr = dataPtBrHoje()
    const baseIds = [...new Set(rows.map((r) => baseId.get(r.baseSlug)!))]
    await recordCheckpoints(client, baseIds, "Backlog", dataPtBr)
    console.log(`checkpoint "Backlog" gravado p/ ${baseIds.length} base(s) [${dataPtBr}]`)
    console.log("\n✓ backlog importado")
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error("FALHA:", e.message)
  process.exit(1)
})

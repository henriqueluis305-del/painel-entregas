// Importa DS (encaminhados vs entregues) de um xlsx por motorista p/ uma base.
// Colunas fixas A/F/I/K/M (porta o calcDS antigo). Cadastra motoristas faltantes.
// --demo: fabrica quantidades determinísticas quando o arquivo não as traz
//         (caso do fleets de exemplo, que só tem a coluna A).
// Uso:
//   node scripts/import-ds.ts "data/shopee/DS/fleets (1).xlsx" xpt-adr-02
//   node scripts/import-ds.ts "data/shopee/DS/fleets (1).xlsx" xpt-adr-02 --demo
import ExcelJS from "exceljs"
import pg from "pg"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { resolveDriver } from "../src/lib/shopee/drivers.ts"
import { parseDsCells, calcDs } from "../src/lib/shopee/ds.ts"
import { resolveBaseSlug } from "../src/lib/shopee/stuck.ts"
import { dataPtBrHoje, horaHoje, recordDsCheckpoints } from "./_checkpoints.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function loadEnv() {
  const txt = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8")
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

// RNG determinístico por motorista (p/ dados de exemplo estáveis)
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function demoQuants(seed: string) {
  let x = hash(seed)
  const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296)
  const saiu = 70 + Math.floor(rnd() * 90) // 70–159
  const entregues = Math.round(saiu * (0.78 + rnd() * 0.18)) // 78–96%
  const rest = saiu - entregues
  const emRota = Math.floor(rest * rnd())
  return { saiu, entregues, emRota, ocorrencias: rest - emRota }
}

async function main() {
  const file = process.argv[2]
  const fallbackBase = process.argv.find((a, i) => i >= 3 && !a.startsWith("--"))
  const demo = process.argv.includes("--demo")
  if (!file)
    throw new Error('Uso: node scripts/import-ds.ts "<arquivo.xlsx>" [baseSlugFallback] [--demo]')
  loadEnv()

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path.resolve(ROOT, file))
  const ws = wb.worksheets[0]

  // base por linha vem da coluna C (Driver Station); col 0-based 2
  const items: {
    id: string | null
    name: string
    baseSlug: string
    saiu: number
    entregues: number
    emRota: number
    ocorrencias: number
  }[] = []
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)
    const cells: unknown[] = []
    for (let c = 1; c <= 13; c++) {
      const v = row.getCell(c).value
      cells[c - 1] = v && typeof v === "object" && "text" in v ? (v as { text: string }).text : v
    }
    const parsed = parseDsCells(cells)
    if (!parsed) continue
    const drv = resolveDriver(parsed.driverRaw)
    if (!drv) continue
    const station = String(cells[2] ?? "").trim()
    const baseSlug = station ? resolveBaseSlug(station) : (fallbackBase ?? "")
    let { saiu, entregues, emRota, ocorrencias } = parsed
    if (demo && saiu === 0 && entregues === 0) {
      ;({ saiu, entregues, emRota, ocorrencias } = demoQuants(drv.id))
    }
    items.push({ id: drv.id, name: drv.name, baseSlug, saiu, entregues, emRota, ocorrencias })
  }

  const totals = calcDs(items)
  console.log(`Arquivo: ${file}${demo ? " | DEMO" : ""}`)
  console.log(
    `motoristas=${totals.motoristas} saiu=${totals.saiu} entregues=${totals.entregues} emRota=${totals.emRota} ocorr=${totals.ocorrencias} | DS=${totals.pct}%`,
  )

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const op = await client.query("select id from operacao where slug='shopee'")
    const operacaoId = op.rows[0].id
    const baseRows = await client.query("select id, slug from base where operacao_id=$1", [operacaoId])
    const baseId = new Map<string, string>(baseRows.rows.map((b) => [b.slug, String(b.id)]))

    const unresolved = [...new Set(items.map((i) => i.baseSlug).filter((s) => !baseId.has(s)))]
    if (unresolved.length) console.log(`⚠ bases não encontradas (linhas ignoradas): ${unresolved.join(", ")}`)
    const valid0 = items.filter((i) => baseId.has(i.baseSlug))
    const perBase = new Map<string, number>()
    for (const it of valid0) perBase.set(it.baseSlug, (perBase.get(it.baseSlug) ?? 0) + 1)
    console.log("por base:", [...perBase.entries()].map(([s, n]) => `${s}=${n}`).join(" | "))

    const dataPtBr = dataPtBrHoje()

    // garante motoristas cadastrados
    const existing = await client.query("select id from driver")
    const valid = new Set(existing.rows.map((r) => String(r.id)))
    for (const it of valid0) {
      if (it.id && !valid.has(it.id)) {
        await client.query(
          `insert into driver (id, operacao_id, name, normalized_key) values ($1,$2,$3,$4)
           on conflict (id) do update set name=excluded.name, updated_at=now()`,
          [it.id, operacaoId, it.name, it.name.toLowerCase()],
        )
        valid.add(it.id)
      }
    }

    // upsert DS por motorista
    let n = 0
    for (const it of valid0) {
      await client.query(
        `insert into shopee_ds_driver
           (base_id, data_pt_br, driver_id, driver_name, saiu, entregues, em_rota, ocorrencias, is_demo)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (base_id, data_pt_br, driver_id) do update set
           driver_name=excluded.driver_name, saiu=excluded.saiu, entregues=excluded.entregues,
           em_rota=excluded.em_rota, ocorrencias=excluded.ocorrencias, is_demo=excluded.is_demo,
           updated_at=now()`,
        [baseId.get(it.baseSlug), dataPtBr, it.id, it.name, it.saiu, it.entregues, it.emRota, it.ocorrencias, demo],
      )
      n++
    }

    // checkpoint do DS (burn-down)
    const baseIds = [...new Set(valid0.map((it) => baseId.get(it.baseSlug)!))]
    await recordDsCheckpoints(client, baseIds, `DS ${horaHoje()}`, dataPtBr)
    console.log(`\n✓ DS gravado: ${n} motoristas [${dataPtBr}] | checkpoint p/ ${baseIds.length} base(s)`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error("FALHA:", e.message)
  process.exit(1)
})

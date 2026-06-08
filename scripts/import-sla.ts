// Importa SLA a partir dos CSVs export_return_order_*.csv.
// Dedupe por Order ID, base via Current Station, SLA% = entregues/total.
// 1 registro por (base, dia) em shopee_sla_record.
// Uso:
//   node scripts/import-sla.ts "data/shopee/SLA"          (aplica)
//   node scripts/import-sla.ts "data/shopee/SLA" --dry
import pg from "pg"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { parseCsvObjects } from "../src/lib/shopee/csv.ts"
import { calcSla } from "../src/lib/shopee/sla.ts"
import { dataPtBrHoje } from "./_checkpoints.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function loadEnv() {
  const txt = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8")
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

async function main() {
  const dir = process.argv[2]
  const baseSlug = process.argv[3]
  const dry = process.argv.includes("--dry")
  if (!dir || !baseSlug)
    throw new Error('Uso: node scripts/import-sla.ts "data/shopee/SLA" <baseSlug> [--dry]')
  loadEnv()

  const files = fs
    .readdirSync(path.resolve(ROOT, dir))
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .map((f) => path.resolve(ROOT, dir, f))
    .sort()

  // O export de SLA é por base → o arquivo inteiro conta p/ baseSlug.
  // Dedupe por Order ID (vem em chunks).
  const byCode = new Map<string, string>() // codigo -> status
  let totalRows = 0
  for (const f of files) {
    const objs = parseCsvObjects(fs.readFileSync(f, "utf8"))
    for (const o of objs) {
      const codigo = (o["Order ID"] || "").trim()
      if (!codigo) continue
      totalRows++
      byCode.set(codigo, (o["Status"] || "").trim())
    }
    console.log(`  ${path.basename(f)}: ${objs.length} linhas`)
  }
  const b = calcSla([...byCode.values()])
  console.log(`\nTOTAL linhas=${totalRows} | Order IDs distintos=${byCode.size} | base=${baseSlug}`)
  console.log(
    `total=${b.total} entregues=${b.entregues} SLA=${b.pct}% | rota=${b.emRota} oc=${b.ocorrencias} falt=${b.faltantes} outros=${b.outros}`,
  )

  if (dry) {
    console.log("\n[--dry] nada gravado.")
    return
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const op = await client.query("select id from operacao where slug='shopee'")
    const operacaoId = op.rows[0].id
    const base = await client.query("select id from base where operacao_id=$1 and slug=$2", [operacaoId, baseSlug])
    if (!base.rows.length) throw new Error(`base ${baseSlug} não encontrada`)
    const baseId = String(base.rows[0].id)
    const dataPtBr = dataPtBrHoje()

    await client.query(
      `insert into shopee_sla_record
         (base_id, data_pt_br, total, entregues, em_rota, ocorrencias, faltantes, outros, sla_pct)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (base_id, data_pt_br) do update set
         total=excluded.total, entregues=excluded.entregues, em_rota=excluded.em_rota,
         ocorrencias=excluded.ocorrencias, faltantes=excluded.faltantes, outros=excluded.outros,
         sla_pct=excluded.sla_pct, updated_at=now()`,
      [baseId, dataPtBr, b.total, b.entregues, b.emRota, b.ocorrencias, b.faltantes, b.outros, b.pct],
    )
    console.log(`\n✓ SLA gravado p/ ${baseSlug} [${dataPtBr}]`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error("FALHA:", e.message)
  process.exit(1)
})

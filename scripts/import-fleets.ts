// Importa motoristas a partir do xlsx de fleets (coluna "Driver Name" = "[id] nome").
// Reusa o resolver canônico (src/lib/shopee/drivers.ts). Upsert por id.
// Uso:
//   node scripts/import-fleets.ts "data/shopee/DS/fleets (1).xlsx"          (aplica)
//   node scripts/import-fleets.ts "data/shopee/DS/fleets (1).xlsx" --dry    (só preview)
import ExcelJS from "exceljs"
import pg from "pg"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { resolveDriver, dedupeById } from "../src/lib/shopee/drivers.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function loadEnv() {
  const txt = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8")
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

async function readDriverNames(file: string): Promise<string[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path.resolve(ROOT, file))
  const ws = wb.worksheets[0]
  // acha a coluna "Driver Name" no cabeçalho (linha 1)
  const header = ws.getRow(1)
  let col = 0
  header.eachCell((cell, c) => {
    if (String(cell.value ?? "").trim().toLowerCase() === "driver name") col = c
  })
  if (!col) col = 1 // fleets tem só essa coluna
  const names: string[] = []
  for (let r = 2; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).getCell(col).value
    if (v != null && String(v).trim()) names.push(String(v).trim())
  }
  return names
}

async function main() {
  const file = process.argv[2]
  const dry = process.argv.includes("--dry")
  if (!file) throw new Error('Informe o xlsx. Ex: node scripts/import-fleets.ts "data/shopee/DS/fleets (1).xlsx"')
  loadEnv()

  const rawNames = await readDriverNames(file)
  const resolved = dedupeById(
    rawNames.map((n) => resolveDriver(n)).filter((d) => d !== null),
  )
  const skipped = rawNames.length - resolved.length

  // detecta colisão de normalized_key entre ids distintos (viola unique(op, key))
  const byKey = new Map<string, string[]>()
  for (const d of resolved) {
    const arr = byKey.get(d.key) ?? []
    arr.push(d.id)
    byKey.set(d.key, arr)
  }
  const collisions = [...byKey.entries()].filter(([, ids]) => ids.length > 1)

  console.log(`Arquivo: ${file}`)
  console.log(`Linhas com nome: ${rawNames.length} | motoristas resolvidos: ${resolved.length} | descartados (sistema/sem id): ${skipped}`)
  if (collisions.length) {
    console.log(`⚠ colisões de nome normalizado (ids distintos, mesmo nome):`)
    for (const [k, ids] of collisions) console.log(`   "${k}" -> ${ids.join(", ")}`)
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    const op = await client.query("select id from operacao where slug='shopee'")
    if (!op.rows.length) throw new Error("operação shopee não encontrada")
    const operacaoId = op.rows[0].id

    const existing = await client.query("select id from driver where operacao_id=$1", [operacaoId])
    const existingIds = new Set(existing.rows.map((r) => String(r.id)))
    const toCreate = resolved.filter((d) => !existingIds.has(d.id)).length
    const toUpdate = resolved.length - toCreate
    console.log(`No DB: ${existingIds.size} motoristas | novos: ${toCreate} | já existentes (update): ${toUpdate}`)

    if (dry) {
      console.log("\n[--dry] nada gravado. Amostra:")
      for (const d of resolved.slice(0, 5)) console.log("   ", d.id, "-", d.name)
      return
    }

    let created = 0, updated = 0, failed = 0
    for (const d of resolved) {
      try {
        const res = await client.query(
          `insert into driver (id, operacao_id, name, normalized_key)
           values ($1,$2,$3,$4)
           on conflict (id) do update set name=excluded.name, normalized_key=excluded.normalized_key, updated_at=now()
           returning (xmax = 0) as inserted`,
          [d.id, operacaoId, d.name, d.key],
        )
        if (res.rows[0].inserted) created++
        else updated++
      } catch (e) {
        failed++
        console.log(`   ✗ falha id=${d.id} (${d.name}): ${(e as Error).message}`)
      }
    }
    console.log(`\n✓ gravado — criados: ${created} | atualizados: ${updated} | falhas: ${failed}`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error("FALHA:", e.message)
  process.exit(1)
})

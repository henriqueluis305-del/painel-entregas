// Executa um arquivo .sql no Postgres (Supabase) via lib `pg`.
// Uso: node scripts/run-sql.mjs sql/10_shopee_stuck.sql
import { Client } from "pg"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

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
  const file = process.argv[2]
  if (!file) throw new Error("Informe o arquivo .sql. Ex: node scripts/run-sql.mjs sql/10_shopee_stuck.sql")
  loadEnv()
  const sql = fs.readFileSync(path.resolve(ROOT, file), "utf8")

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    await client.query(sql)
    console.log(`✓ aplicado: ${file}`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error("FALHA:", e.message)
  process.exit(1)
})

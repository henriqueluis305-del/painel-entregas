// Backup read-only do Postgres (Supabase) via lib `pg`.
// Lê todas as tabelas do schema `public` e grava:
//   backups/<timestamp>/<tabela>.json   (linhas)
//   backups/<timestamp>/dump.sql        (INSERTs idempotentes)
//   backups/<timestamp>/_meta.json      (contagens + ordem)
// NÃO altera nada no banco. Uso: `node scripts/backup-db.mjs`
import { Client } from "pg"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local")
  const txt = fs.readFileSync(envPath, "utf8")
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

function sqlLiteral(v) {
  if (v === null || v === undefined) return "NULL"
  if (typeof v === "number") return String(v)
  if (typeof v === "boolean") return v ? "true" : "false"
  if (v instanceof Date) return `'${v.toISOString()}'`
  if (Array.isArray(v)) {
    // arrays text[] do Postgres
    const inner = v.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(",")
    return `'{${inner}}'`
  }
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}

async function main() {
  loadEnv()
  const conn = process.env.DATABASE_URL
  if (!conn) throw new Error("DATABASE_URL ausente em .env.local")

  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const { rows: tables } = await client.query(`
    select tablename from pg_tables
    where schemaname = 'public'
    order by tablename
  `)

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outDir = path.join(ROOT, "backups", stamp)
  fs.mkdirSync(outDir, { recursive: true })

  const meta = { generated_at: new Date().toISOString(), database: conn.replace(/:[^:@]*@/, ":***@"), tables: {} }
  const sqlParts = [
    `-- Backup gerado em ${meta.generated_at}`,
    `-- Restaura dados (rode o schema antes: sql/01_schema.sql).`,
    `begin;`,
    ``,
  ]

  for (const { tablename } of tables) {
    const { rows } = await client.query(`select * from "${tablename}"`)
    fs.writeFileSync(path.join(outDir, `${tablename}.json`), JSON.stringify(rows, null, 2))
    meta.tables[tablename] = rows.length
    if (rows.length) {
      const cols = Object.keys(rows[0])
      sqlParts.push(`-- ${tablename} (${rows.length} linhas)`)
      for (const r of rows) {
        const vals = cols.map((c) => sqlLiteral(r[c])).join(", ")
        sqlParts.push(
          `insert into "${tablename}" (${cols.map((c) => `"${c}"`).join(", ")}) values (${vals}) on conflict do nothing;`,
        )
      }
      sqlParts.push("")
    } else {
      sqlParts.push(`-- ${tablename} (vazia)\n`)
    }
    console.log(`  ✓ ${tablename}: ${rows.length} linhas`)
  }

  sqlParts.push("commit;")
  fs.writeFileSync(path.join(outDir, "dump.sql"), sqlParts.join("\n"))
  fs.writeFileSync(path.join(outDir, "_meta.json"), JSON.stringify(meta, null, 2))

  await client.end()
  console.log(`\nBackup completo em: backups/${stamp}`)
  console.log(`Tabelas: ${Object.keys(meta.tables).length} | Total de linhas: ${Object.values(meta.tables).reduce((a, b) => a + b, 0)}`)
}

main().catch((e) => {
  console.error("FALHA no backup:", e.message)
  process.exit(1)
})

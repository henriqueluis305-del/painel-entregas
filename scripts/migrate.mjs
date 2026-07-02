// Runner de migrations SQL versionadas (substitui o run-sql.mjs manual).
//
// Uso:
//   node scripts/migrate.mjs              → aplica as pendentes de migrations/*.sql
//   node scripts/migrate.mjs --status     → lista aplicadas × pendentes
//   node scripts/migrate.mjs --baseline [arquivo.sql]
//                                         → marca como aplicadas SEM rodar: todas, ou
//                                           só até o arquivo dado (inclusive). Use em
//                                           banco que já tem o schema (Supabase/RDS
//                                           restaurado); as posteriores rodam no migrate.
//
// Regras:
//   - arquivos em migrations/ ordenados por nome (0001_..., 0002_...);
//   - cada arquivo roda numa transação; falhou → rollback e para;
//   - registro em schema_migrations (name, applied_at).
import { Client } from "pg"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const DIR = path.join(ROOT, "migrations")

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local")
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

async function main() {
  loadEnv()
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não definida.")

  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PG_SSL === "off" ? undefined : { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    await client.query(
      `create table if not exists schema_migrations (
         name       text primary key,
         applied_at timestamptz not null default now()
       )`,
    )
    const { rows } = await client.query(`select name from schema_migrations`)
    const applied = new Set(rows.map((r) => r.name))
    const pending = files.filter((f) => !applied.has(f))

    const mode = process.argv[2]
    if (mode === "--status") {
      for (const f of files) console.log(`${applied.has(f) ? "✓ aplicada" : "• pendente"}  ${f}`)
      if (!files.length) console.log("(nenhuma migration em migrations/)")
      return
    }

    if (mode === "--baseline") {
      const upTo = process.argv[3] // opcional: marca só até este arquivo (inclusive)
      for (const f of pending) {
        if (upTo && f > upTo) break
        await client.query(`insert into schema_migrations (name) values ($1)`, [f])
        console.log(`baseline: ${f} marcada como aplicada (sem rodar)`)
      }
      return
    }

    if (!pending.length) {
      console.log("Nada a aplicar — banco em dia.")
      return
    }
    for (const f of pending) {
      const sql = fs.readFileSync(path.join(DIR, f), "utf8")
      process.stdout.write(`Aplicando ${f} ... `)
      try {
        await client.query("begin")
        await client.query(sql)
        await client.query(`insert into schema_migrations (name) values ($1)`, [f])
        await client.query("commit")
        console.log("ok")
      } catch (err) {
        await client.query("rollback")
        console.log("FALHOU")
        throw err
      }
    }
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})

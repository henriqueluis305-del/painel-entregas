import pg from "pg"
import { readFileSync } from "fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const sql = `
-- "Padrão": quais operações aparecem na sidebar por padrão
ALTER TABLE operacao ADD COLUMN IF NOT EXISTS in_sidebar boolean NOT NULL DEFAULT true;

-- Soft delete de usuário
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Override por usuário: null = segue o padrão; array de slugs = conjunto explícito
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS sidebar_operacoes text[];

-- Por agora: só Shopee visível por padrão
UPDATE operacao SET in_sidebar = (slug = 'shopee');
`

const client = new pg.Client({ connectionString: env.DATABASE_URL })
await client.connect()
await client.query(sql)
const { rows } = await client.query(
  "SELECT slug, in_sidebar FROM operacao ORDER BY label",
)
console.log("migração ok:", JSON.stringify(rows))
await client.end()

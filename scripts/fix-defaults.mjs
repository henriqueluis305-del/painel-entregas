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
ALTER TABLE operacao ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE operacao ALTER COLUMN active SET DEFAULT true;
ALTER TABLE operacao ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE base ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE base ALTER COLUMN active SET DEFAULT true;
ALTER TABLE base ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE driver ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE driver ALTER COLUMN active SET DEFAULT true;
ALTER TABLE driver ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE driver ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE upload ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE upload ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE upload ALTER COLUMN size_bytes SET DEFAULT 0;
ALTER TABLE upload ALTER COLUMN rows_parsed SET DEFAULT 0;
ALTER TABLE upload ALTER COLUMN rows_kept SET DEFAULT 0;
ALTER TABLE upload ALTER COLUMN rows_rejected SET DEFAULT 0;

ALTER TABLE package ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE package ALTER COLUMN imported_at SET DEFAULT now();

ALTER TABLE snapshot ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE snapshot ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE snapshot ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE snapshot ALTER COLUMN total SET DEFAULT 0;
ALTER TABLE snapshot ALTER COLUMN entregues SET DEFAULT 0;
ALTER TABLE snapshot ALTER COLUMN em_rota SET DEFAULT 0;
ALTER TABLE snapshot ALTER COLUMN ocorrencias SET DEFAULT 0;
ALTER TABLE snapshot ALTER COLUMN faltantes SET DEFAULT 0;
ALTER TABLE snapshot ALTER COLUMN devolvidos SET DEFAULT 0;
ALTER TABLE snapshot ALTER COLUMN outros SET DEFAULT 0;

ALTER TABLE snapshot_driver ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE snapshot_driver ALTER COLUMN saiu SET DEFAULT 0;
ALTER TABLE snapshot_driver ALTER COLUMN entregues SET DEFAULT 0;
ALTER TABLE snapshot_driver ALTER COLUMN em_rota SET DEFAULT 0;
ALTER TABLE snapshot_driver ALTER COLUMN ocorrencias SET DEFAULT 0;

ALTER TABLE sla_ds_record ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE sla_ds_record ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE sla_ds_record ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE liberacao ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE liberacao ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE app_user ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE app_user ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE app_user ALTER COLUMN role SET DEFAULT 'SUPERVISOR';
ALTER TABLE app_user ALTER COLUMN base_scope SET DEFAULT 'SINGLE';
ALTER TABLE app_user ALTER COLUMN is_admin SET DEFAULT false;

ALTER TABLE cep_cache ALTER COLUMN fetched_at SET DEFAULT now();
`

const client = new pg.Client({ connectionString: env.DATABASE_URL })
await client.connect()
await client.query(sql)
console.log("defaults aplicados com sucesso")
await client.end()

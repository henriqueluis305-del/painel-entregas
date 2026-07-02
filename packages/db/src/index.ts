// Acesso ao Postgres via pool singleton (AD-07 do plano AWS).
// Funciona igual contra Supabase (hoje), Postgres local em Docker (dev) e RDS (prod):
// só muda DATABASE_URL / PG_SSL no ambiente.
//
// IMPORTANTE: não importar "server-only" aqui — este módulo também roda no worker
// (processo Node puro, fora do Next). A fronteira server/client é garantida pelos
// call sites ("use server" / server components).

import { Pool, type PoolClient } from "pg"

export type { PoolClient }

const g = globalThis as unknown as { __pgPool?: Pool }

function makePool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 8),
    idleTimeoutMillis: 30_000,
    // PG_SSL=off → Postgres local (Docker) sem TLS. Default: TLS sem verificação
    // de CA (Supabase/RDS usam certs próprios; paridade com o comportamento atual).
    ssl: process.env.PG_SSL === "off" ? undefined : { rejectUnauthorized: false },
  })
}

/** Pool único por processo — sobrevive ao hot reload do dev via globalThis. */
export const pool: Pool = g.__pgPool ?? (g.__pgPool = makePool())

/** Atalho: roda uma query no pool e devolve as rows tipadas. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const { rows } = await pool.query(text, params as never[])
  return rows as T[]
}

/** Empresta um client do pool, roda fn e devolve ao pool (substitui o antigo client-por-chamada). */
export async function withPgClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

/** Transação: begin/commit, rollback em erro. Use p/ escritas multi-tabela (ex.: recálculo de folha). */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  return withPgClient(async (c) => {
    await c.query("begin")
    try {
      const result = await fn(c)
      await c.query("commit")
      return result
    } catch (err) {
      await c.query("rollback")
      throw err
    }
  })
}

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

import "server-only"

import type { Client } from "pg"

import { withPgClient } from "@/lib/pg"

/** Cidade/bairro resolvidos a partir de um CEP (origem: cache local ou ViaCEP). */
export type CepInfo = { cep: string; cidade: string; bairro: string; uf: string | null }

/** Normaliza p/ 8 dígitos sem máscara (formato da PK de cep_cache). null se inválido. */
export function normalizeCep(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D+/g, "")
  return d.length === 8 ? d : null
}

type ViaCepResponse = {
  localidade?: string
  bairro?: string
  uf?: string
  erro?: boolean
}

/** Consulta o ViaCEP. Retorna null p/ CEP inexistente, erro de rede ou resposta inválida. */
async function fetchViaCep(cep: string): Promise<CepInfo | null> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    const data = (await res.json()) as ViaCepResponse
    if (data.erro) return null
    // cidade/bairro são NOT NULL no banco; ViaCEP pode devolver bairro vazio em CEPs gerais.
    return { cep, cidade: data.localidade ?? "", bairro: data.bairro ?? "", uf: data.uf ?? null }
  } catch {
    return null
  }
}

async function readCache(c: Client, ceps: string[]): Promise<Map<string, CepInfo>> {
  if (!ceps.length) return new Map()
  const r = await c.query(
    "select cep, cidade, bairro, uf from cep_cache where cep = any($1::text[])",
    [ceps],
  )
  return new Map(
    r.rows.map((row) => [
      String(row.cep),
      { cep: String(row.cep), cidade: row.cidade, bairro: row.bairro, uf: row.uf },
    ]),
  )
}

async function writeCache(c: Client, infos: CepInfo[]): Promise<void> {
  if (!infos.length) return
  const vals: unknown[] = []
  const tuples = infos.map((info, i) => {
    const b = i * 4
    vals.push(info.cep, info.cidade, info.bairro, info.uf)
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4})`
  })
  await c.query(
    `insert into cep_cache (cep, cidade, bairro, uf) values ${tuples.join(",")}
     on conflict (cep) do update set cidade=excluded.cidade, bairro=excluded.bairro,
       uf=excluded.uf, fetched_at=now()`,
    vals,
  )
}

/** Roda fn em até `limit` itens simultâneos (educado com a API do ViaCEP). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/**
 * Resolve vários CEPs de uma vez (cache-aside): lê o que já existe em cep_cache,
 * busca no ViaCEP só os que faltam, grava os novos e devolve o mapa cep→info.
 * CEPs inválidos ou não encontrados no ViaCEP ficam de fora do mapa.
 */
export async function lookupCeps(rawCeps: string[]): Promise<Map<string, CepInfo>> {
  const normalized = [...new Set(rawCeps.map(normalizeCep).filter((c): c is string => c !== null))]
  if (!normalized.length) return new Map()
  return withPgClient(async (c) => {
    const result = await readCache(c, normalized)
    const missing = normalized.filter((cep) => !result.has(cep))
    const fetched = (await mapLimit(missing, 5, fetchViaCep)).filter((x): x is CepInfo => x !== null)
    await writeCache(c, fetched)
    for (const info of fetched) result.set(info.cep, info)
    return result
  })
}

/** Resolve um único CEP. null se inválido ou não encontrado. */
export async function lookupCep(rawCep: string): Promise<CepInfo | null> {
  const cep = normalizeCep(rawCep)
  if (!cep) return null
  return (await lookupCeps([cep])).get(cep) ?? null
}

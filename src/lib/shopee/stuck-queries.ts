import "server-only"

import { query } from "@painel/db"
import { lookupCeps } from "@/lib/cep"
import { FORA_DE_ABRANGENCIA } from "@/lib/shopee/stuck"
import type { CheckpointPoint, StuckRow } from "@/lib/shopee/stuck"

// Re-export para consumidores server que importam tudo de stuck-queries.
export type { CheckpointPoint, StuckKpis, StuckRow } from "@/lib/shopee/stuck"
export { computeStuckKpis, isPackageDelivered } from "@/lib/shopee/stuck"

type RawStuckRow = {
  codigo: string
  status: string
  dias_preso: number | null
  agency: string | null
  cep: string | null
  delivered_at: string | null
  last_status_at: string | null
  base_slug: string
  base_label: string
  driver_id: string | null
  driver_name: string | null
}

/** Maior `last_backlog_date` da operação (o "dia atual" da visão). */
async function latestBacklogDate(operacaoId: string): Promise<string | null> {
  const rows = await query<{ day: string }>(
    `select p.last_backlog_date::text as day
       from shopee_package p
       join base b on b.id = p.base_id
      where b.operacao_id::text = $1 and p.last_backlog_date is not null
      order by p.last_backlog_date desc
      limit 1`,
    [operacaoId],
  )
  return rows[0]?.day ?? null
}

/**
 * Cidades habilitadas por base no Config (`enabled`), reaproveitadas no Stuck —
 * um switch só, vale p/ SLA, DS e o "Fora de Abrangência". Devolve o conjunto
 * `${base_slug}|${cidade}` das cidades ligadas. Opt-in estrito: cidade que não
 * está aqui (base sem nada ligado, inclusive) é tratada como fora de abrangência.
 */
async function cidadesHabilitadas(
  operacaoId: string,
  baseSlugs: string[],
): Promise<Set<string>> {
  const baseFilter = baseSlugs.length ? "and b.slug = any($2::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, baseSlugs] : [operacaoId]
  const rows = await query<{ slug: string; cidade: string }>(
    `select b.slug, sc.cidade
       from shopee_base_cidade sc
       join base b on b.id = sc.base_id
      where b.operacao_id::text = $1 and sc.enabled ${baseFilter}`,
    params,
  )
  const set = new Set<string>()
  for (const r of rows) if (r.slug && r.cidade) set.add(`${r.slug}|${r.cidade}`)
  return set
}

/** Pacotes stuck da operação, opcionalmente filtrados por bases e pelo dia. */
export async function getStuckPackages(
  operacaoId: string,
  baseSlugs: string[] = [],
  opts: { dailyReset?: boolean } = {},
): Promise<StuckRow[]> {
  // limpeza diária: mostra só o backlog do dia mais recente (DB intacto)
  const day = opts.dailyReset ? await latestBacklogDate(operacaoId) : null

  // SQL direto não tem o limite de 1000 linhas do PostgREST — uma query resolve.
  const params: unknown[] = [operacaoId]
  let baseFilter = ""
  if (baseSlugs.length) {
    params.push(baseSlugs)
    baseFilter = `and b.slug = any($${params.length}::text[])`
  }
  let dayFilter = ""
  if (day) {
    params.push(day)
    dayFilter = `and p.last_backlog_date = $${params.length}::date`
  }
  const all = await query<RawStuckRow>(
    `select p.codigo, p.status, p.dias_preso::float8 as dias_preso, p.agency, p.cep,
            p.delivered_at::text as delivered_at, p.last_status_at::text as last_status_at,
            b.slug as base_slug, b.label as base_label,
            dr.id::text as driver_id, dr.name as driver_name
       from shopee_package p
       join base b on b.id = p.base_id
       left join driver dr on dr.id = p.driver_id
      where b.operacao_id::text = $1 ${baseFilter} ${dayFilter}
      order by p.dias_preso desc nulls last, p.codigo`,
    params,
  )

  // Resolve cidade a partir do CEP (cache cep_cache + ViaCEP nos que faltam).
  const cidadePorCep = await lookupCeps(all.map((r) => r.cep ?? ""))
  // Cidades habilitadas no Config p/ separar "da base" x "fora de abrangência".
  const habilitadas = await cidadesHabilitadas(operacaoId, baseSlugs)

  return all.map((r) => {
    const slug = r.base_slug ?? ""
    const cepCidade = (r.cep && cidadePorCep.get(r.cep)?.cidade) || null
    const cepBairro = (r.cep && cidadePorCep.get(r.cep)?.bairro) || null
    // Só a cidade habilitada no Config mantém nome próprio (e bairro). Todo o
    // resto — cidade fora da base OU sem CEP/cidade resolvida — cai em "Fora de
    // Abrangência" (cidade e bairro), pra não acumular nomes de fora nas visões.
    const daBase = cepCidade != null && habilitadas.has(`${slug}|${cepCidade}`)
    return {
      codigo: r.codigo,
      status: r.status,
      dias_preso: r.dias_preso,
      agency: r.agency,
      delivered_at: r.delivered_at,
      last_status_at: r.last_status_at,
      base_slug: slug,
      base_label: r.base_label ?? "",
      driver_id: r.driver_id,
      driver_name: r.driver_name,
      cep: r.cep ?? null,
      cidade: daBase ? cepCidade : FORA_DE_ABRANGENCIA,
      bairro: daBase ? cepBairro : FORA_DE_ABRANGENCIA,
    }
  })
}

type RawCheckpoint = {
  seq: number
  label: string
  total: number
  ainda_stuck: number
  resolvidos: number
}

/** Série de burn-down: % ainda stuck por checkpoint (upload), agregado nas bases. */
export async function getStuckCheckpoints(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<CheckpointPoint[]> {
  // burn-down é do DIA mais recente (senão a semana toda se mistura)
  const last = await query<{ data_pt_br: string }>(
    `select c.data_pt_br
       from shopee_stuck_checkpoint c
       join base b on b.id = c.base_id
      where b.operacao_id::text = $1
      order by c.ts desc
      limit 1`,
    [operacaoId],
  )
  const day = last[0]?.data_pt_br
  if (!day) return []

  const baseFilter = baseSlugs.length ? "and b.slug = any($3::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, day, baseSlugs] : [operacaoId, day]
  const data = await query<RawCheckpoint>(
    `select c.seq, c.label, c.total, c.ainda_stuck, c.resolvidos
       from shopee_stuck_checkpoint c
       join base b on b.id = c.base_id
      where b.operacao_id::text = $1 and c.data_pt_br = $2 ${baseFilter}
      order by c.seq`,
    params,
  )

  const map = new Map<number, { label: string; total: number; ainda: number; resolv: number }>()
  for (const r of data) {
    const m = map.get(r.seq) ?? { label: r.label, total: 0, ainda: 0, resolv: 0 }
    m.total += r.total
    m.ainda += r.ainda_stuck
    m.resolv += r.resolvidos
    map.set(r.seq, m)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seq, m]) => ({
      seq,
      label: m.label,
      total: m.total,
      ainda: m.ainda,
      resolv: m.resolv,
      pct: m.total ? Number(((m.ainda / m.total) * 100).toFixed(2)) : 0,
    }))
}

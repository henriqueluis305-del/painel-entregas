import "server-only"

import { query } from "@painel/db"
import { calcDs, type DsTotals } from "@/lib/shopee/ds"

export type DsRow = {
  driver_id: string | null
  driver_name: string
  saiu: number
  entregues: number
  em_rota: number
  ocorrencias: number
  is_demo: boolean
  base_slug: string
  base_label: string
}

export type DsData = {
  rows: DsRow[]
  totals: DsTotals
  isDemo: boolean
  day: string | null
}

export type DsCheckpoint = { seq: number; label: string; pct: number }

type DsCkptRaw = {
  seq: number
  label: string
  saiu: number
  entregues: number
}

/** Burn-down do DS: % ainda não entregue por upload (checkpoint), agregado nas bases. */
export async function getDsCheckpoints(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<DsCheckpoint[]> {
  // burn-down do DIA mais recente
  const last = await query<{ data_pt_br: string }>(
    `select c.data_pt_br
       from shopee_ds_checkpoint c
       join base b on b.id = c.base_id
      where b.operacao_id::text = $1
      order by c.data desc, c.ts desc
      limit 1`,
    [operacaoId],
  )
  const day = last[0]?.data_pt_br
  if (!day) return []

  const baseFilter = baseSlugs.length ? "and b.slug = any($3::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, day, baseSlugs] : [operacaoId, day]
  const data = await query<DsCkptRaw>(
    `select c.seq, c.label, c.saiu, c.entregues
       from shopee_ds_checkpoint c
       join base b on b.id = c.base_id
      where b.operacao_id::text = $1 and c.data_pt_br = $2 ${baseFilter}
      order by c.seq`,
    params,
  )

  const map = new Map<number, { label: string; saiu: number; entregues: number }>()
  for (const r of data) {
    const m = map.get(r.seq) ?? { label: r.label, saiu: 0, entregues: 0 }
    m.saiu += r.saiu
    m.entregues += r.entregues
    map.set(r.seq, m)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seq, m]) => ({
      seq,
      label: m.label,
      // DS% = entregues/encaminhados (sobe ao longo do dia)
      pct: m.saiu ? Number(((m.entregues / m.saiu) * 100).toFixed(1)) : 0,
    }))
}

export async function getDsData(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<DsData> {
  // dia mais recente com DS (DS é "mesmo dia")
  const last = await query<{ data_pt_br: string }>(
    `select d.data_pt_br
       from shopee_ds_driver d
       join base b on b.id = d.base_id
      where b.operacao_id::text = $1
      order by d.data desc
      limit 1`,
    [operacaoId],
  )
  const day = last[0]?.data_pt_br ?? null
  if (!day) return { rows: [], totals: calcDs([]), isDemo: false, day: null }

  const baseFilter = baseSlugs.length ? "and b.slug = any($3::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, day, baseSlugs] : [operacaoId, day]
  const rows = await query<DsRow>(
    `select d.driver_id, d.driver_name, d.saiu, d.entregues, d.em_rota, d.ocorrencias,
            d.is_demo, b.slug as base_slug, b.label as base_label
       from shopee_ds_driver d
       join base b on b.id = d.base_id
      where b.operacao_id::text = $1 and d.data_pt_br = $2 ${baseFilter}
      order by d.entregues desc`,
    params,
  )

  return {
    rows,
    totals: calcDs(
      rows.map((r) => ({
        saiu: r.saiu,
        entregues: r.entregues,
        emRota: r.em_rota,
        ocorrencias: r.ocorrencias,
      })),
    ),
    isDemo: rows.some((r) => r.is_demo),
    day,
  }
}

export type DsWeekEntry = { baseSlug: string; day: string; pct: number }

/** DS% por base/dia dentro de um conjunto de dias (ISO) — célula do pivô Base × Data. */
export async function getDsWeekEntries(
  operacaoId: string,
  baseSlugs: string[],
  isoDays: string[],
): Promise<DsWeekEntry[]> {
  if (!isoDays.length) return []
  const baseFilter = baseSlugs.length ? "and b.slug = any($3::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, isoDays, baseSlugs] : [operacaoId, isoDays]
  const rows = await query<{ base_slug: string; data_pt_br: string; saiu: number; entregues: number }>(
    `select b.slug as base_slug, d.data_pt_br, sum(d.saiu)::int as saiu, sum(d.entregues)::int as entregues
       from shopee_ds_driver d
       join base b on b.id = d.base_id
      where b.operacao_id::text = $1 and d.data = any($2::date[]) ${baseFilter}
      group by b.slug, d.data_pt_br`,
    params,
  )
  return rows.map((r) => ({
    baseSlug: r.base_slug,
    day: r.data_pt_br,
    pct: r.saiu ? Number(((r.entregues / r.saiu) * 100).toFixed(1)) : 0,
  }))
}

export type DsWeeklyEntry = { baseSlug: string; weekStart: string; pct: number }

/** DS% por base/semana (soma os dias de cada semana) — célula do pivô Base × Semana (Mensal). */
export async function getDsWeeklyPct(
  operacaoId: string,
  baseSlugs: string[],
  weekStarts: string[],
): Promise<DsWeeklyEntry[]> {
  if (!weekStarts.length) return []
  const baseFilter = baseSlugs.length ? "and b.slug = any($3::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, weekStarts, baseSlugs] : [operacaoId, weekStarts]
  const rows = await query<{ base_slug: string; week_start: string; saiu: number; entregues: number }>(
    `select b.slug as base_slug, to_char(date_trunc('week', d.data), 'YYYY-MM-DD') as week_start,
            sum(d.saiu)::int as saiu, sum(d.entregues)::int as entregues
       from shopee_ds_driver d
       join base b on b.id = d.base_id
      where b.operacao_id::text = $1 and date_trunc('week', d.data) = any($2::date[]) ${baseFilter}
      group by b.slug, week_start`,
    params,
  )
  return rows.map((r) => ({
    baseSlug: r.base_slug,
    weekStart: r.week_start,
    pct: r.saiu ? Number(((r.entregues / r.saiu) * 100).toFixed(1)) : 0,
  }))
}

/** Semanas (segunda-feira ISO) com pelo menos 1 registro de DS no escopo, mais recente primeiro. */
export async function getDsWeeks(operacaoId: string, baseSlugs: string[] = []): Promise<string[]> {
  const baseFilter = baseSlugs.length ? "and b.slug = any($2::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, baseSlugs] : [operacaoId]
  const rows = await query<{ week_start: string }>(
    `select distinct to_char(date_trunc('week', d.data), 'YYYY-MM-DD') as week_start
       from shopee_ds_driver d
       join base b on b.id = d.base_id
      where b.operacao_id::text = $1 ${baseFilter}
      order by 1 desc`,
    params,
  )
  return rows.map((r) => r.week_start)
}

/** Motoristas de um dia específico, ordenados por DS% crescente (piores primeiro). */
export async function getDsDriversByDay(
  operacaoId: string,
  baseSlugs: string[] = [],
  day: string,
): Promise<DsRow[]> {
  const baseFilter = baseSlugs.length ? "and b.slug = any($3::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, day, baseSlugs] : [operacaoId, day]
  return query<DsRow>(
    `select d.driver_id, d.driver_name, d.saiu, d.entregues, d.em_rota, d.ocorrencias,
            d.is_demo, b.slug as base_slug, b.label as base_label
       from shopee_ds_driver d
       join base b on b.id = d.base_id
      where b.operacao_id::text = $1 and d.data_pt_br = $2 ${baseFilter}
      order by (case when d.saiu > 0 then d.entregues::float8 / d.saiu else 1 end) asc, d.saiu desc`,
    params,
  )
}

/** Motoristas de uma base numa semana inteira (soma os 7 dias) — consolidado da visão Mensal. */
export async function getDsDriversByWeek(
  operacaoId: string,
  baseSlug: string,
  weekStart: string,
): Promise<DsRow[]> {
  return query<DsRow>(
    `select d.driver_id, max(d.driver_name) as driver_name,
            sum(d.saiu)::int as saiu, sum(d.entregues)::int as entregues,
            sum(d.em_rota)::int as em_rota, sum(d.ocorrencias)::int as ocorrencias,
            bool_or(d.is_demo) as is_demo, b.slug as base_slug, b.label as base_label
       from shopee_ds_driver d
       join base b on b.id = d.base_id
      where b.operacao_id::text = $1 and b.slug = $2 and date_trunc('week', d.data) = $3::date
      group by d.driver_id, b.slug, b.label
      order by (case when sum(d.saiu) > 0 then sum(d.entregues)::float8 / sum(d.saiu) else 1 end) asc`,
    [operacaoId, baseSlug, weekStart],
  )
}

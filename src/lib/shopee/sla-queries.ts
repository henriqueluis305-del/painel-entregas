import "server-only"

import { query } from "@painel/db"
import { STATUS_MAP } from "@/lib/shopee/sla"

export type SlaBaseRow = {
  base_slug: string
  base_label: string
  total: number
  entregues: number
  em_rota: number
  ocorrencias: number
  faltantes: number
  outros: number
  pct: number
}

type SlaRaw = {
  data_pt_br: string
  total: number
  entregues: number
  em_rota: number
  ocorrencias: number
  faltantes: number
  outros: number
  sla_pct: number
  por_status: Record<string, number> | null
  base_slug: string
  base_label: string
}

export type StatusRow = { status: string; categoria: string; count: number; pct: number }

export type SlaData = {
  day: string | null
  total: number
  entregues: number
  emRota: number
  ocorrencias: number
  faltantes: number
  outros: number
  pct: number
  perBase: SlaBaseRow[]
  porStatus: StatusRow[]
}

function pct(entregues: number, total: number) {
  return total > 0 ? Number(((entregues / total) * 100).toFixed(1)) : 0
}

export async function getSlaData(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<SlaData> {
  const last = await query<{ data_pt_br: string }>(
    `select r.data_pt_br
       from shopee_sla_record r
       join base b on b.id = r.base_id
      where b.operacao_id::text = $1
      order by r.data desc
      limit 1`,
    [operacaoId],
  )
  const day = last[0]?.data_pt_br ?? null
  const empty: SlaData = { day: null, total: 0, entregues: 0, emRota: 0, ocorrencias: 0, faltantes: 0, outros: 0, pct: 0, perBase: [], porStatus: [] }
  if (!day) return empty

  const baseFilter = baseSlugs.length ? "and b.slug = any($3::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, day, baseSlugs] : [operacaoId, day]
  const rows = await query<SlaRaw>(
    `select r.data_pt_br, r.total, r.entregues, r.em_rota, r.ocorrencias, r.faltantes,
            r.outros, r.sla_pct::float8 as sla_pct, r.por_status,
            b.slug as base_slug, b.label as base_label
       from shopee_sla_record r
       join base b on b.id = r.base_id
      where b.operacao_id::text = $1 and r.data_pt_br = $2 ${baseFilter}`,
    params,
  )

  const perBase: SlaBaseRow[] = rows
    .map((r) => ({
      base_slug: r.base_slug,
      base_label: r.base_label,
      total: r.total,
      entregues: r.entregues,
      em_rota: r.em_rota,
      ocorrencias: r.ocorrencias,
      faltantes: r.faltantes,
      outros: r.outros,
      pct: r.sla_pct,
    }))
    .sort((a, b) => b.total - a.total)

  const agg = rows.reduce(
    (a, r) => ({
      total: a.total + r.total,
      entregues: a.entregues + r.entregues,
      emRota: a.emRota + r.em_rota,
      ocorrencias: a.ocorrencias + r.ocorrencias,
      faltantes: a.faltantes + r.faltantes,
      outros: a.outros + r.outros,
    }),
    { total: 0, entregues: 0, emRota: 0, ocorrencias: 0, faltantes: 0, outros: 0 },
  )

  // quebra por status (merge do por_status de todas as bases do escopo)
  const statusMap = new Map<string, number>()
  for (const r of rows) {
    for (const [st, n] of Object.entries(r.por_status ?? {})) {
      statusMap.set(st, (statusMap.get(st) ?? 0) + n)
    }
  }
  const porStatus: StatusRow[] = [...statusMap.entries()]
    .map(([status, count]) => ({
      status,
      categoria: STATUS_MAP[status] ?? "Outros",
      count,
      pct: agg.total ? Number(((count / agg.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  return { day, ...agg, pct: pct(agg.entregues, agg.total), perBase, porStatus }
}

export type SlaPoint = { label: string; pct: number }

type SlaCkptRaw = {
  seq: number
  label: string
  total: number
  entregues: number
}

/** Crescimento do SLA: SLA% por upload (checkpoint) do dia atual, agregado nas bases. */
export async function getSlaCheckpoints(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<SlaPoint[]> {
  // só o dia mais recente (o "dia atual" do painel)
  const last = await query<{ data_pt_br: string }>(
    `select c.data_pt_br
       from shopee_sla_checkpoint c
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
  const data = await query<SlaCkptRaw>(
    `select c.seq, c.label, c.total, c.entregues
       from shopee_sla_checkpoint c
       join base b on b.id = c.base_id
      where b.operacao_id::text = $1 and c.data_pt_br = $2 ${baseFilter}
      order by c.seq`,
    params,
  )

  const map = new Map<number, { label: string; total: number; entregues: number }>()
  for (const r of data) {
    const m = map.get(r.seq) ?? { label: r.label, total: 0, entregues: 0 }
    m.total += r.total
    m.entregues += r.entregues
    map.set(r.seq, m)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, m]) => ({ label: m.label, pct: pct(m.entregues, m.total) }))
}

function parseBrDate(s: string): number {
  const [d, m, y] = s.split("/").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
}

/** Evolução do SLA% por dia (snapshots), agregado nas bases selecionadas. */
export async function getSlaEvolution(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<SlaPoint[]> {
  const baseFilter = baseSlugs.length ? "and b.slug = any($2::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, baseSlugs] : [operacaoId]
  const data = await query<{ data_pt_br: string; total: number; entregues: number }>(
    `select r.data_pt_br, r.total, r.entregues
       from shopee_sla_record r
       join base b on b.id = r.base_id
      where b.operacao_id::text = $1 ${baseFilter}`,
    params,
  )

  const map = new Map<string, { total: number; entregues: number }>()
  for (const r of data) {
    const m = map.get(r.data_pt_br) ?? { total: 0, entregues: 0 }
    m.total += r.total
    m.entregues += r.entregues
    map.set(r.data_pt_br, m)
  }
  return [...map.entries()]
    .sort((a, b) => parseBrDate(a[0]) - parseBrDate(b[0]))
    .map(([label, m]) => ({ label, pct: pct(m.entregues, m.total) }))
}

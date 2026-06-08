import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
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

type EmbeddedSla = {
  data_pt_br: string
  total: number
  entregues: number
  em_rota: number
  ocorrencias: number
  faltantes: number
  outros: number
  sla_pct: number
  por_status: Record<string, number> | null
  base: { slug: string; label: string; operacao_id: string } | null
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
  const sb = createAdminClient()
  const { data: last } = await sb
    .from("shopee_sla_record")
    .select("data_pt_br, base!inner(operacao_id)")
    .eq("base.operacao_id", operacaoId)
    .order("updated_at", { ascending: false })
    .limit(1)
  const day = (last ?? [])[0]?.data_pt_br ?? null
  const empty: SlaData = { day: null, total: 0, entregues: 0, emRota: 0, ocorrencias: 0, faltantes: 0, outros: 0, pct: 0, perBase: [], porStatus: [] }
  if (!day) return empty

  let q = sb
    .from("shopee_sla_record")
    .select(
      "data_pt_br, total, entregues, em_rota, ocorrencias, faltantes, outros, sla_pct, por_status, base!inner(slug, label, operacao_id)",
    )
    .eq("base.operacao_id", operacaoId)
    .eq("data_pt_br", day)
  if (baseSlugs.length) q = q.in("base.slug", baseSlugs)

  const { data, error } = await q
  if (error) throw new Error(`getSlaData: ${error.message}`)
  const rows = (data ?? []) as unknown as EmbeddedSla[]

  const perBase: SlaBaseRow[] = rows
    .map((r) => ({
      base_slug: r.base?.slug ?? "",
      base_label: r.base?.label ?? "",
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

function parseBrDate(s: string): number {
  const [d, m, y] = s.split("/").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
}

/** Evolução do SLA% por dia (snapshots), agregado nas bases selecionadas. */
export async function getSlaEvolution(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<SlaPoint[]> {
  const sb = createAdminClient()
  let q = sb
    .from("shopee_sla_record")
    .select("data_pt_br, total, entregues, base!inner(slug, operacao_id)")
    .eq("base.operacao_id", operacaoId)
  if (baseSlugs.length) q = q.in("base.slug", baseSlugs)

  const { data, error } = await q
  if (error) throw new Error(`getSlaEvolution: ${error.message}`)

  const map = new Map<string, { total: number; entregues: number }>()
  for (const r of (data ?? []) as unknown as EmbeddedSla[]) {
    const m = map.get(r.data_pt_br) ?? { total: 0, entregues: 0 }
    m.total += r.total
    m.entregues += r.entregues
    map.set(r.data_pt_br, m)
  }
  return [...map.entries()]
    .sort((a, b) => parseBrDate(a[0]) - parseBrDate(b[0]))
    .map(([label, m]) => ({ label, pct: pct(m.entregues, m.total) }))
}

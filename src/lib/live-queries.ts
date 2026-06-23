import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { Profile } from "@/lib/auth"

export type OpLite = { id: string; slug: string; label: string }

/** Operações que o usuário pode ver + a default (principal → operacao_id → 1ª). */
export async function getAllowedOperacoes(
  profile: Profile,
): Promise<{ operacoes: OpLite[]; defaultId: string | null }> {
  const sb = createAdminClient()
  const { data } = await sb
    .from("operacao")
    .select("id, slug, label, in_sidebar")
    .eq("active", true)
    .order("label")
  const all = (data ?? []) as (OpLite & { in_sidebar: boolean })[]

  // mesmo filtro da sidebar: escopo + (override do user OU padrão in_sidebar)
  const canAll = profile.is_admin || profile.base_scope === "ALL"
  const acessivel = canAll ? all : all.filter((o) => o.id === profile.operacao_id)
  const userSet = profile.sidebar_operacoes ?? null
  const allowed = acessivel
    .filter((o) => (userSet ? userSet.includes(o.slug) : o.in_sidebar))
    .map(({ id, slug, label }) => ({ id, slug, label }))

  const principal = profile.principal_operacao_id ?? profile.operacao_id
  const defaultId =
    allowed.find((o) => o.id === principal)?.id ?? allowed[0]?.id ?? null
  return { operacoes: allowed, defaultId }
}

function parseBrDate(s: string): number {
  const [d, m, y] = s.split("/").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
}

/** Dias com dados (data_pt_br) da operação, mais recente primeiro. */
export async function getAvailableDays(operacaoId: string): Promise<string[]> {
  const sb = createAdminClient()
  const [{ data: ds }, { data: sla }] = await Promise.all([
    sb.from("shopee_ds_driver").select("data_pt_br, base!inner(operacao_id)").eq("base.operacao_id", operacaoId),
    sb.from("shopee_sla_record").select("data_pt_br, base!inner(operacao_id)").eq("base.operacao_id", operacaoId),
  ])
  const set = new Set<string>()
  for (const r of [...(ds ?? []), ...(sla ?? [])] as { data_pt_br: string }[]) set.add(r.data_pt_br)
  return [...set].sort((a, b) => parseBrDate(b) - parseBrDate(a))
}

export type SlaDay = {
  total: number
  entregues: number
  ocorrencias: number
  faltantes: number
  outros: number
  pct: number
}
export async function getSlaDay(operacaoId: string, dia: string): Promise<SlaDay> {
  const sb = createAdminClient()
  const { data } = await sb
    .from("shopee_sla_record")
    .select("total, entregues, ocorrencias, faltantes, outros, base!inner(operacao_id)")
    .eq("base.operacao_id", operacaoId)
    .eq("data_pt_br", dia)
  const agg = (data ?? []).reduce(
    (a, r) => ({
      total: a.total + r.total,
      entregues: a.entregues + r.entregues,
      ocorrencias: a.ocorrencias + r.ocorrencias,
      faltantes: a.faltantes + r.faltantes,
      outros: a.outros + r.outros,
    }),
    { total: 0, entregues: 0, ocorrencias: 0, faltantes: 0, outros: 0 },
  )
  return { ...agg, pct: agg.total ? Number(((agg.entregues / agg.total) * 100).toFixed(1)) : 0 }
}

export type DsDay = {
  saiu: number
  entregues: number
  emRota: number
  ocorrencias: number
  motoristas: number
  pct: number
}
type DsRowRaw = {
  saiu: number
  entregues: number
  em_rota: number
  ocorrencias: number
  driver_id: string | null
  driver: { name: string } | null
}
async function fetchDs(operacaoId: string, dia: string): Promise<DsRowRaw[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from("shopee_ds_driver")
    .select("saiu, entregues, em_rota, ocorrencias, driver_id, base!inner(operacao_id), driver(name)")
    .eq("base.operacao_id", operacaoId)
    .eq("data_pt_br", dia)
  return (data ?? []) as unknown as DsRowRaw[]
}

export async function getDsDay(operacaoId: string, dia: string): Promise<DsDay> {
  const rows = await fetchDs(operacaoId, dia)
  const drivers = new Set<string>()
  const agg = rows.reduce(
    (a, r) => {
      if (r.driver_id) drivers.add(r.driver_id)
      return {
        saiu: a.saiu + r.saiu,
        entregues: a.entregues + r.entregues,
        emRota: a.emRota + r.em_rota,
        ocorrencias: a.ocorrencias + r.ocorrencias,
      }
    },
    { saiu: 0, entregues: 0, emRota: 0, ocorrencias: 0 },
  )
  return { ...agg, motoristas: drivers.size, pct: agg.saiu ? Number(((agg.entregues / agg.saiu) * 100).toFixed(1)) : 0 }
}

export type DriverRank = {
  driver_id: string
  name: string
  saiu: number
  entregues: number
  ocorrencias: number
  ds_pct: number
  prejuizo: number // MOCK até o PNR
}
const CUSTO_OCORRENCIA_MOCK = 27.5 // R$ por ocorrência (placeholder)

export async function getDriverRanking(operacaoId: string, dia: string): Promise<DriverRank[]> {
  const rows = await fetchDs(operacaoId, dia)
  const map = new Map<string, DriverRank>()
  for (const r of rows) {
    if (!r.driver_id) continue
    const m = map.get(r.driver_id) ?? {
      driver_id: r.driver_id,
      name: r.driver?.name ?? r.driver_id,
      saiu: 0,
      entregues: 0,
      ocorrencias: 0,
      ds_pct: 0,
      prejuizo: 0,
    }
    m.saiu += r.saiu
    m.entregues += r.entregues
    m.ocorrencias += r.ocorrencias
    map.set(r.driver_id, m)
  }
  const list = [...map.values()].map((m) => ({
    ...m,
    ds_pct: m.saiu ? Number(((m.entregues / m.saiu) * 100).toFixed(1)) : 0,
    prejuizo: Number((m.ocorrencias * CUSTO_OCORRENCIA_MOCK).toFixed(2)),
  }))
  // piores: mais ocorrências, depois pior DS
  return list.sort((a, b) => b.ocorrencias - a.ocorrencias || a.ds_pct - b.ds_pct)
}

export type HealthLevel = "ok" | "warn" | "bad"
export type HealthItem = { label: string; value: string; level: HealthLevel }

export function computeHealthcheck(sla: SlaDay, ds: DsDay): { itens: HealthItem[]; geral: HealthLevel } {
  const ocorrPct = ds.saiu ? (ds.ocorrencias / ds.saiu) * 100 : 0
  const lvl = (v: number, ok: number, warn: number, higherBetter = true): HealthLevel => {
    if (higherBetter) return v >= ok ? "ok" : v >= warn ? "warn" : "bad"
    return v <= ok ? "ok" : v <= warn ? "warn" : "bad"
  }
  const itens: HealthItem[] = [
    { label: "SLA", value: `${sla.pct}%`, level: lvl(sla.pct, 98, 90) },
    { label: "DS", value: `${ds.pct}%`, level: lvl(ds.pct, 90, 80) },
    { label: "Ocorrências", value: `${ocorrPct.toFixed(1)}%`, level: lvl(ocorrPct, 3, 7, false) },
    { label: "Em rota", value: String(ds.emRota), level: "ok" },
  ]
  const order: Record<HealthLevel, number> = { ok: 0, warn: 1, bad: 2 }
  const geral = itens.reduce<HealthLevel>((w, i) => (order[i.level] > order[w] ? i.level : w), "ok")
  return { itens, geral }
}

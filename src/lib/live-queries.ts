import "server-only"

import { query, withPgClient } from "@painel/db"
import type { Profile } from "@/lib/auth"

export type OpLite = { id: string; slug: string; label: string }

/** Operações que o usuário pode ver + a default (principal → operacao_id → 1ª). */
export async function getAllowedOperacoes(
  profile: Profile,
): Promise<{ operacoes: OpLite[]; defaultId: string | null }> {
  const all = await query<OpLite & { in_sidebar: boolean }>(
    `select id, slug, label, in_sidebar from operacao where active order by label`,
  )

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

export type BaseLite = { slug: string; label: string }

/** Bases ativas da operação (os "datasets"). */
export async function getOpBases(operacaoId: string): Promise<BaseLite[]> {
  return query<BaseLite>(
    `select slug, label from base where operacao_id::text = $1 and active order by slug`,
    [operacaoId],
  )
}

/** Dias com dados, mais recente primeiro. baseSlug vazio = todas as bases. */
export async function getAvailableDays(operacaoId: string, baseSlug = ""): Promise<string[]> {
  const baseFilter = baseSlug ? "and b.slug = $2" : ""
  const params = baseSlug ? [operacaoId, baseSlug] : [operacaoId]
  const rows = await query<{ data_pt_br: string }>(
    `select distinct t.data_pt_br from (
       select d.data_pt_br from shopee_ds_driver d
         join base b on b.id = d.base_id
        where b.operacao_id::text = $1 ${baseFilter}
       union all
       select s.data_pt_br from shopee_sla_record s
         join base b on b.id = s.base_id
        where b.operacao_id::text = $1 ${baseFilter}
     ) t`,
    params,
  )
  return rows.map((r) => r.data_pt_br).sort((a, b) => parseBrDate(b) - parseBrDate(a))
}

export type SlaDay = {
  total: number
  entregues: number
  ocorrencias: number
  faltantes: number
  outros: number
  pct: number
}
export async function getSlaDay(operacaoId: string, dia: string, baseSlug = ""): Promise<SlaDay> {
  const baseFilter = baseSlug ? "and b.slug = $3" : ""
  const params = baseSlug ? [operacaoId, dia, baseSlug] : [operacaoId, dia]
  const [agg] = await query<Omit<SlaDay, "pct">>(
    `select coalesce(sum(r.total),0)::int       as total,
            coalesce(sum(r.entregues),0)::int   as entregues,
            coalesce(sum(r.ocorrencias),0)::int as ocorrencias,
            coalesce(sum(r.faltantes),0)::int   as faltantes,
            coalesce(sum(r.outros),0)::int      as outros
       from shopee_sla_record r
       join base b on b.id = r.base_id
      where b.operacao_id::text = $1 and r.data_pt_br = $2 ${baseFilter}`,
    params,
  )
  const a = agg ?? { total: 0, entregues: 0, ocorrencias: 0, faltantes: 0, outros: 0 }
  return { ...a, pct: a.total ? Number(((a.entregues / a.total) * 100).toFixed(1)) : 0 }
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
async function fetchDs(operacaoId: string, dia: string, baseSlug = ""): Promise<DsRowRaw[]> {
  const baseFilter = baseSlug ? "and b.slug = $3" : ""
  const params = baseSlug ? [operacaoId, dia, baseSlug] : [operacaoId, dia]
  const rows = await query<{
    saiu: number
    entregues: number
    em_rota: number
    ocorrencias: number
    driver_id: string | null
    driver_name: string | null
  }>(
    `select d.saiu, d.entregues, d.em_rota, d.ocorrencias, d.driver_id, dr.name as driver_name
       from shopee_ds_driver d
       join base b on b.id = d.base_id
       left join driver dr on dr.id = d.driver_id
      where b.operacao_id::text = $1 and d.data_pt_br = $2 ${baseFilter}`,
    params,
  )
  return rows.map(({ driver_name, ...r }) => ({
    ...r,
    driver: driver_name ? { name: driver_name } : null,
  }))
}

export async function getDsDay(operacaoId: string, dia: string, baseSlug = ""): Promise<DsDay> {
  const rows = await fetchDs(operacaoId, dia, baseSlug)
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
  prejuizo: number
}

async function fetchPnrByDriver(operacaoId: string, dia: string, baseSlug = "") {
  return withPgClient(async (c) => {
    const params: unknown[] = [operacaoId, dia]
    const baseFilter = baseSlug ? "and b.slug=$3" : ""
    if (baseSlug) params.push(baseSlug)

    const rows = await c.query(
      `select p.driver_id, coalesce(sum(p.valor),0)::float8 as valor
       from shopee_pnr p
       join base b on b.id = p.base_id
       where p.driver_id is not null
         and b.operacao_id::text = $1
         and to_char(p.created_time at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') = $2
         ${baseFilter}
       group by p.driver_id`,
      params,
    )

    return new Map<string, number>(
      rows.rows.map((row: { driver_id: string; valor: number }) => [
        String(row.driver_id),
        Number(row.valor ?? 0),
      ]),
    )
  })
}

export async function getDriverRanking(operacaoId: string, dia: string, baseSlug = ""): Promise<DriverRank[]> {
  const [rows, pnrByDriver] = await Promise.all([
    fetchDs(operacaoId, dia, baseSlug),
    fetchPnrByDriver(operacaoId, dia, baseSlug),
  ])
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
    prejuizo: Number((pnrByDriver.get(m.driver_id) ?? 0).toFixed(2)),
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

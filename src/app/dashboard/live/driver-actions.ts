"use server"

import { getSessionProfile } from "@/lib/auth"
import { getAllowedOperacoes } from "@/lib/live-queries"
import { query, withPgClient } from "@painel/db"

const DAY_MS = 86400000
const PERIODS = [7, 14, 30, 60, 90] as const

export type PerfPoint = {
  label: string
  fullDate: string
  saiu: number
  entregues: number
  ds_pct: number
  ocorrencias: number
  prejuizo: number
}

export type DriverPerf = {
  name: string
  periodDays: number
  points: PerfPoint[]
  total: {
    saiu: number
    entregues: number
    ocorrencias: number
    prejuizo: number
    ds_pct: number
  }
}

type DriverPerformanceInput = {
  operacaoId?: string
  operacaoIds?: string[]
  driverId: string
  dias: number
  baseSlug?: string
  baseSlugs?: string[]
  referenceDay?: string
}

type Row = {
  data_pt_br: string
  saiu: number
  entregues: number
  ocorrencias: number
  driver: { name: string } | null
}

function parseBrDate(s: string): number {
  const [d, m, y] = s.split("/").map(Number)
  if (!d || !m || !y) return Number.NaN
  return Date.UTC(y, m - 1, d)
}

function formatBrDate(time: number) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(time))
}

function normalizePeriod(dias: number) {
  return PERIODS.includes(dias as (typeof PERIODS)[number]) ? dias : 7
}

async function fetchDriverPnrByDay({
  operationIds,
  baseSlugs,
  driverId,
  startDay,
  endDay,
}: {
  operationIds: string[]
  baseSlugs: string[]
  driverId: string
  startDay: string
  endDay: string
}) {
  return withPgClient(async (c) => {
    const params: unknown[] = [driverId, operationIds, startDay, endDay]
    const baseFilter = baseSlugs.length ? "and b.slug = any($5::text[])" : ""
    if (baseSlugs.length) params.push(baseSlugs)

    const rows = await c.query(
      `select to_char(p.created_time at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') as data_pt_br,
              coalesce(sum(p.valor),0)::float8 as valor
       from shopee_pnr p
       join base b on b.id = p.base_id
       where p.driver_id = $1
         and b.operacao_id::text = any($2::text[])
         and p.created_time is not null
         and (p.created_time at time zone 'America/Sao_Paulo')::date
             between to_date($3, 'DD/MM/YYYY') and to_date($4, 'DD/MM/YYYY')
         ${baseFilter}
       group by data_pt_br`,
      params,
    )

    return new Map<string, number>(
      rows.rows.map((row: { data_pt_br: string; valor: number }) => [
        row.data_pt_br,
        Number(row.valor ?? 0),
      ]),
    )
  })
}

/** Driver DS performance for the selected lookback window. */
export async function getDriverPerformance({
  operacaoId,
  operacaoIds,
  driverId,
  dias,
  baseSlug = "",
  baseSlugs = [],
  referenceDay,
}: DriverPerformanceInput): Promise<DriverPerf> {
  const session = await getSessionProfile()
  if (!session?.profile) throw new Error("Nao autorizado")

  const { operacoes } = await getAllowedOperacoes(session.profile)
  const allowedIds = new Set(operacoes.map((o) => o.id))
  const requestedIds = [...new Set([...(operacaoIds ?? []), ...(operacaoId ? [operacaoId] : [])])]
  if (requestedIds.length === 0 || requestedIds.some((id) => !allowedIds.has(id))) {
    throw new Error("Nao autorizado")
  }

  const periodDays = normalizePeriod(dias)

  const requestedBaseSlugs = [...new Set([...(baseSlugs ?? []), ...(baseSlug ? [baseSlug] : [])])]
  const baseFilter = requestedBaseSlugs.length ? "and b.slug = any($3::text[])" : ""
  const params: unknown[] = requestedBaseSlugs.length
    ? [driverId, requestedIds, requestedBaseSlugs]
    : [driverId, requestedIds]
  const raw = await query<{
    data_pt_br: string
    saiu: number
    entregues: number
    ocorrencias: number
    driver_name: string | null
  }>(
    `select d.data_pt_br, d.saiu, d.entregues, d.ocorrencias, dr.name as driver_name
       from shopee_ds_driver d
       join base b on b.id = d.base_id
       left join driver dr on dr.id = d.driver_id
      where d.driver_id = $1 and b.operacao_id::text = any($2::text[]) ${baseFilter}`,
    params,
  )
  const rows: Row[] = raw.map(({ driver_name, ...r }) => ({
    ...r,
    driver: driver_name ? { name: driver_name } : null,
  }))
  const name = rows[0]?.driver?.name ?? driverId
  const fallbackRef = rows.reduce(
    (max, r) => Math.max(max, parseBrDate(r.data_pt_br)),
    Date.now(),
  )
  const parsedReference = referenceDay ? parseBrDate(referenceDay) : Number.NaN
  const end = Number.isFinite(parsedReference) ? parsedReference : fallbackRef
  const start = end - (periodDays - 1) * DAY_MS
  const pnrByDay = await fetchDriverPnrByDay({
    operationIds: requestedIds,
    baseSlugs: requestedBaseSlugs,
    driverId,
    startDay: formatBrDate(start),
    endDay: formatBrDate(end),
  })

  const byDay = new Map<string, { saiu: number; entregues: number; ocorrencias: number; prejuizo: number }>()
  for (const row of rows) {
    const time = parseBrDate(row.data_pt_br)
    if (time < start || time > end) continue

    const current = byDay.get(row.data_pt_br) ?? {
      saiu: 0,
      entregues: 0,
      ocorrencias: 0,
      prejuizo: 0,
    }
    current.saiu += row.saiu
    current.entregues += row.entregues
    current.ocorrencias += row.ocorrencias
    byDay.set(row.data_pt_br, current)
  }
  for (const [date, prejuizo] of pnrByDay) {
    const current = byDay.get(date) ?? {
      saiu: 0,
      entregues: 0,
      ocorrencias: 0,
      prejuizo: 0,
    }
    current.prejuizo = Number(prejuizo.toFixed(2))
    byDay.set(date, current)
  }

  const points: PerfPoint[] = [...byDay.entries()]
    .sort((a, b) => parseBrDate(a[0]) - parseBrDate(b[0]))
    .map(([date, day]) => ({
      label: date.slice(0, 5),
      fullDate: date,
      saiu: day.saiu,
      entregues: day.entregues,
      ds_pct: day.saiu ? Number(((day.entregues / day.saiu) * 100).toFixed(1)) : 0,
      ocorrencias: day.ocorrencias,
      prejuizo: day.prejuizo,
    }))

  let saiu = 0
  let entregues = 0
  let ocorrencias = 0
  let prejuizo = 0
  for (const day of byDay.values()) {
    saiu += day.saiu
    entregues += day.entregues
    ocorrencias += day.ocorrencias
    prejuizo += day.prejuizo
  }

  return {
    name,
    periodDays,
    points,
    total: {
      saiu,
      entregues,
      ocorrencias,
      prejuizo: Number(prejuizo.toFixed(2)),
      ds_pct: saiu ? Number(((entregues / saiu) * 100).toFixed(1)) : 0,
    },
  }
}

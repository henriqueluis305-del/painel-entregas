import "server-only"

import { query } from "@painel/db"
import type { OpLite } from "@/lib/live-queries"
import type { DriverRank } from "@/lib/live-queries"

const DAY_MS = 86400000

export type HomeMetric = "ds" | "stuck" | "sla" | "pnr"

export type HomeKpis = {
  activeDrivers: number
  monitoredOperations: number
  dataBases: number
  monitoredPackages: number
}

export type HomeBaseOption = {
  id: string
  slug: string
  label: string
  operationId: string
  operationLabel: string
  monitoredPackages: number
}

export type HomeMetricPoint = {
  operationId: string
  baseId: string
  date: string
  label: string
  dsSaiu: number
  dsEntregues: number
  ds: number | null
  slaTotal: number
  slaEntregues: number
  sla: number | null
  stuck: number | null
  pnr: number | null
}

export type HomeDriverRow = DriverRank & {
  baseId: string
  baseSlug: string
  operationId: string
}

export type HomeDriverPresence = {
  baseId: string
  driverId: string
}

function parseBrDate(s: string): number {
  const [d, m, y] = s.split("/").map(Number)
  if (!d || !m || !y) return Number.NaN
  return Date.UTC(y, m - 1, d)
}

function formatBrDate(time: number) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(time))
}

function lastDates(referenceDay: string, days: number) {
  const end = parseBrDate(referenceDay)
  if (!Number.isFinite(end)) return []
  return Array.from({ length: days }, (_, index) => formatBrDate(end - (days - 1 - index) * DAY_MS))
}

function round1(value: number) {
  return Number(value.toFixed(1))
}

function baseKey(operationId: string, baseId: string, date: string) {
  return `${operationId}::${baseId}::${date}`
}

export async function getHomeBases(operations: OpLite[]): Promise<{
  bases: HomeBaseOption[]
  driverPresence: HomeDriverPresence[]
}> {
  const operationIds = operations.map((op) => op.id)
  if (operationIds.length === 0) return { bases: [], driverPresence: [] }

  const operationLabelById = new Map(operations.map((op) => [op.id, op.label]))
  const [baseRows, slaRows, driverRows] = await Promise.all([
    query<{ id: string; slug: string; label: string; operacao_id: string }>(
      `select id, slug, label, operacao_id
         from base
        where active and operacao_id::text = any($1::text[])
        order by operacao_id, slug`,
      [operationIds],
    ),
    query<{ base_id: string; total: number }>(
      `select r.base_id, coalesce(sum(r.total), 0)::int as total
         from shopee_sla_record r
         join base b on b.id = r.base_id
        where b.operacao_id::text = any($1::text[])
        group by r.base_id`,
      [operationIds],
    ),
    query<{ base_id: string; driver_id: string }>(
      `select distinct d.base_id, d.driver_id
         from shopee_ds_driver d
         join base b on b.id = d.base_id
        where d.driver_id is not null and b.operacao_id::text = any($1::text[])`,
      [operationIds],
    ),
  ])

  const packagesByBase = new Map<string, number>()
  for (const row of slaRows) packagesByBase.set(row.base_id, row.total)

  const driverPresence: HomeDriverPresence[] = driverRows.map((row) => ({
    baseId: row.base_id,
    driverId: row.driver_id,
  }))

  const bases = baseRows.map((base) => ({
    id: base.id,
    slug: base.slug,
    label: base.label,
    operationId: base.operacao_id,
    operationLabel: operationLabelById.get(base.operacao_id) ?? base.operacao_id,
    monitoredPackages: packagesByBase.get(base.id) ?? 0,
  }))

  return { bases, driverPresence }
}

export async function getHomeKpis(operations: OpLite[]): Promise<HomeKpis> {
  const operationIds = operations.map((op) => op.id)
  if (operationIds.length === 0) {
    return { activeDrivers: 0, monitoredOperations: 0, dataBases: 0, monitoredPackages: 0 }
  }

  const [driverCount, baseCount, slaSum] = await Promise.all([
    query<{ n: number }>(
      `select count(*)::int as n from driver where active and operacao_id::text = any($1::text[])`,
      [operationIds],
    ),
    query<{ n: number }>(
      `select count(*)::int as n from base where active and operacao_id::text = any($1::text[])`,
      [operationIds],
    ),
    query<{ n: number }>(
      `select coalesce(sum(r.total), 0)::int as n
         from shopee_sla_record r
         join base b on b.id = r.base_id
        where b.operacao_id::text = any($1::text[])`,
      [operationIds],
    ),
  ])

  return {
    activeDrivers: driverCount[0]?.n ?? 0,
    monitoredOperations: operations.length,
    dataBases: baseCount[0]?.n ?? 0,
    monitoredPackages: slaSum[0]?.n ?? 0,
  }
}

export async function getHomeMetricSeries(
  operations: OpLite[],
): Promise<{ points: HomeMetricPoint[]; latestDay: string | null }> {
  const operationIds = operations.map((op) => op.id)
  if (operationIds.length === 0) return { points: [], latestDay: null }

  type DsRow = { operacao_id: string; base_id: string; data_pt_br: string; saiu: number; entregues: number }
  type SlaRow = { operacao_id: string; base_id: string; data_pt_br: string; total: number; entregues: number }
  type StuckRow = { operacao_id: string; base_id: string; data_pt_br: string; seq: number; ainda_stuck: number }
  type PnrRow = { operacao_id: string; base_id: string; data_pt_br: string; valor: number | null }

  const [dsRows, slaRows, stuckRows, pnrRows] = await Promise.all([
    query<DsRow>(
      `select b.operacao_id::text as operacao_id, d.base_id, d.data_pt_br, d.saiu, d.entregues
         from shopee_ds_driver d
         join base b on b.id = d.base_id
        where b.operacao_id::text = any($1::text[])`,
      [operationIds],
    ),
    query<SlaRow>(
      `select b.operacao_id::text as operacao_id, r.base_id, r.data_pt_br, r.total, r.entregues
         from shopee_sla_record r
         join base b on b.id = r.base_id
        where b.operacao_id::text = any($1::text[])`,
      [operationIds],
    ),
    query<StuckRow>(
      `select b.operacao_id::text as operacao_id, s.base_id, s.data_pt_br, s.seq, s.ainda_stuck
         from shopee_stuck_checkpoint s
         join base b on b.id = s.base_id
        where b.operacao_id::text = any($1::text[])`,
      [operationIds],
    ),
    // dia do PNR resolvido no SQL (America/Sao_Paulo)
    query<PnrRow>(
      `select b.operacao_id::text as operacao_id, p.base_id, p.valor::float8 as valor,
              to_char(p.created_date_br, 'DD/MM/YYYY') as data_pt_br
         from shopee_pnr p
         join base b on b.id = p.base_id
        where p.created_time is not null and b.operacao_id::text = any($1::text[])`,
      [operationIds],
    ),
  ])

  const allDates = new Set<string>()
  const baseIdsByOperation = new Map<string, Set<string>>()

  const addBase = (operationId: string, baseId: string) => {
    const set = baseIdsByOperation.get(operationId) ?? new Set<string>()
    set.add(baseId)
    baseIdsByOperation.set(operationId, set)
  }

  const dsMap = new Map<string, { saiu: number; entregues: number }>()
  for (const row of dsRows) {
    allDates.add(row.data_pt_br)
    addBase(row.operacao_id, row.base_id)
    const itemKey = baseKey(row.operacao_id, row.base_id, row.data_pt_br)
    const current = dsMap.get(itemKey) ?? { saiu: 0, entregues: 0 }
    current.saiu += row.saiu
    current.entregues += row.entregues
    dsMap.set(itemKey, current)
  }

  const slaMap = new Map<string, { total: number; entregues: number }>()
  for (const row of slaRows) {
    allDates.add(row.data_pt_br)
    addBase(row.operacao_id, row.base_id)
    const itemKey = baseKey(row.operacao_id, row.base_id, row.data_pt_br)
    const current = slaMap.get(itemKey) ?? { total: 0, entregues: 0 }
    current.total += row.total
    current.entregues += row.entregues
    slaMap.set(itemKey, current)
  }

  const latestStuckByBase = new Map<string, StuckRow>()
  for (const row of stuckRows) {
    allDates.add(row.data_pt_br)
    addBase(row.operacao_id, row.base_id)
    const itemKey = baseKey(row.operacao_id, row.base_id, row.data_pt_br)
    const current = latestStuckByBase.get(itemKey)
    if (!current || row.seq > current.seq) latestStuckByBase.set(itemKey, row)
  }

  const stuckMap = new Map<string, number>()
  for (const row of latestStuckByBase.values()) {
    const itemKey = baseKey(row.operacao_id, row.base_id, row.data_pt_br)
    stuckMap.set(itemKey, (stuckMap.get(itemKey) ?? 0) + row.ainda_stuck)
  }

  const pnrMap = new Map<string, number>()
  for (const row of pnrRows) {
    allDates.add(row.data_pt_br)
    addBase(row.operacao_id, row.base_id)
    const itemKey = baseKey(row.operacao_id, row.base_id, row.data_pt_br)
    pnrMap.set(itemKey, (pnrMap.get(itemKey) ?? 0) + Number(row.valor ?? 0))
  }

  const latestDay = [...allDates].sort((a, b) => parseBrDate(b) - parseBrDate(a))[0] ?? null
  if (!latestDay) return { points: [], latestDay: null }

  const dates = lastDates(latestDay, 30)
  const points: HomeMetricPoint[] = []
  for (const operation of operations) {
    for (const baseId of baseIdsByOperation.get(operation.id) ?? []) {
      for (const date of dates) {
        const itemKey = baseKey(operation.id, baseId, date)
        const ds = dsMap.get(itemKey)
        const sla = slaMap.get(itemKey)
        points.push({
          operationId: operation.id,
          baseId,
          date,
          label: date.slice(0, 5),
          dsSaiu: ds?.saiu ?? 0,
          dsEntregues: ds?.entregues ?? 0,
          ds: ds?.saiu ? round1((ds.entregues / ds.saiu) * 100) : null,
          slaTotal: sla?.total ?? 0,
          slaEntregues: sla?.entregues ?? 0,
          sla: sla?.total ? round1((sla.entregues / sla.total) * 100) : null,
          stuck: stuckMap.has(itemKey) ? stuckMap.get(itemKey)! : null,
          pnr: pnrMap.has(itemKey) ? Number(pnrMap.get(itemKey)!.toFixed(2)) : null,
        })
      }
    }
  }

  return { points, latestDay }
}

export async function getHomeDriverRanking(
  operations: OpLite[],
  day: string | null,
): Promise<HomeDriverRow[]> {
  const operationIds = operations.map((op) => op.id)
  if (operationIds.length === 0 || !day) return []

  type Row = {
    saiu: number
    entregues: number
    ocorrencias: number
    driver_id: string | null
    driver_name: string | null
    base_id: string
    base_slug: string
    operacao_id: string
  }
  type PnrRow = { driver_id: string; valor: number | null; base_id: string }

  const [dsRows, pnrRows] = await Promise.all([
    query<Row>(
      `select d.saiu, d.entregues, d.ocorrencias, d.driver_id, dr.name as driver_name,
              d.base_id, b.slug as base_slug, b.operacao_id::text as operacao_id
         from shopee_ds_driver d
         join base b on b.id = d.base_id
         left join driver dr on dr.id = d.driver_id
        where d.data_pt_br = $1 and b.operacao_id::text = any($2::text[])`,
      [day, operationIds],
    ),
    // dia do PNR resolvido no SQL (America/Sao_Paulo)
    query<PnrRow>(
      `select p.driver_id, p.valor::float8 as valor, p.base_id
         from shopee_pnr p
         join base b on b.id = p.base_id
        where p.driver_id is not null
          and p.created_date_br = to_date($1, 'DD/MM/YYYY')
          and b.operacao_id::text = any($2::text[])`,
      [day, operationIds],
    ),
  ])

  const pnrByDriverBase = new Map<string, number>()
  for (const row of pnrRows) {
    const itemKey = `${row.base_id}::${row.driver_id}`
    pnrByDriverBase.set(itemKey, (pnrByDriverBase.get(itemKey) ?? 0) + Number(row.valor ?? 0))
  }

  return dsRows
    .filter((row) => row.driver_id)
    .map((row) => ({
      driver_id: row.driver_id!,
      name: row.driver_name ?? row.driver_id!,
      saiu: row.saiu,
      entregues: row.entregues,
      ocorrencias: row.ocorrencias,
      ds_pct: row.saiu ? round1((row.entregues / row.saiu) * 100) : 0,
      prejuizo: Number((pnrByDriverBase.get(`${row.base_id}::${row.driver_id}`) ?? 0).toFixed(2)),
      baseId: row.base_id,
      baseSlug: row.base_slug,
      operationId: row.operacao_id,
    }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.ds_pct - b.ds_pct)
}

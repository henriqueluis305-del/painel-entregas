import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
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

type BaseScoped = {
  base: { id: string; slug?: string; operacao_id: string } | null
}

function parseBrDate(s: string): number {
  const [d, m, y] = s.split("/").map(Number)
  if (!d || !m || !y) return Number.NaN
  return Date.UTC(y, m - 1, d)
}

function formatBrDate(time: number) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(time))
}

function datePtBrFromTimestamp(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(date)
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

  const sb = createAdminClient()
  const operationLabelById = new Map(operations.map((op) => [op.id, op.label]))
  const [baseRes, slaRes, driverRes] = await Promise.all([
    sb
      .from("base")
      .select("id, slug, label, operacao_id")
      .eq("active", true)
      .in("operacao_id", operationIds)
      .order("operacao_id")
      .order("slug"),
    sb
      .from("shopee_sla_record")
      .select("total, base!inner(id, operacao_id)")
      .in("base.operacao_id", operationIds),
    sb
      .from("shopee_ds_driver")
      .select("driver_id, base!inner(id, operacao_id)")
      .in("base.operacao_id", operationIds),
  ])

  type BaseRow = { id: string; slug: string; label: string; operacao_id: string }
  type SlaRow = { total: number; base: { id: string; operacao_id: string } | null }
  type DriverRow = { driver_id: string | null; base: { id: string; operacao_id: string } | null }

  const packagesByBase = new Map<string, number>()
  for (const row of (slaRes.data ?? []) as unknown as SlaRow[]) {
    const baseId = row.base?.id
    if (!baseId) continue
    packagesByBase.set(baseId, (packagesByBase.get(baseId) ?? 0) + row.total)
  }

  const seenPresence = new Set<string>()
  const driverPresence: HomeDriverPresence[] = []
  for (const row of (driverRes.data ?? []) as unknown as DriverRow[]) {
    const baseId = row.base?.id
    if (!baseId || !row.driver_id) continue
    const itemKey = `${baseId}::${row.driver_id}`
    if (seenPresence.has(itemKey)) continue
    seenPresence.add(itemKey)
    driverPresence.push({ baseId, driverId: row.driver_id })
  }

  const bases = ((baseRes.data ?? []) as unknown as BaseRow[]).map((base) => ({
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

  const sb = createAdminClient()
  const [drivers, bases, slaRows] = await Promise.all([
    sb
      .from("driver")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .in("operacao_id", operationIds),
    sb
      .from("base")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .in("operacao_id", operationIds),
    sb
      .from("shopee_sla_record")
      .select("total, base!inner(operacao_id)")
      .in("base.operacao_id", operationIds),
  ])

  const monitoredPackages = ((slaRows.data ?? []) as { total: number }[]).reduce(
    (sum, row) => sum + row.total,
    0,
  )

  return {
    activeDrivers: drivers.count ?? 0,
    monitoredOperations: operations.length,
    dataBases: bases.count ?? 0,
    monitoredPackages,
  }
}

export async function getHomeMetricSeries(
  operations: OpLite[],
): Promise<{ points: HomeMetricPoint[]; latestDay: string | null }> {
  const operationIds = operations.map((op) => op.id)
  if (operationIds.length === 0) return { points: [], latestDay: null }

  const sb = createAdminClient()
  const [dsRes, slaRes, stuckRes, pnrRes] = await Promise.all([
    sb
      .from("shopee_ds_driver")
      .select("data_pt_br, saiu, entregues, base!inner(id, operacao_id)")
      .in("base.operacao_id", operationIds),
    sb
      .from("shopee_sla_record")
      .select("data_pt_br, total, entregues, base!inner(id, operacao_id)")
      .in("base.operacao_id", operationIds),
    sb
      .from("shopee_stuck_checkpoint")
      .select("base_id, data_pt_br, seq, ainda_stuck, base!inner(id, operacao_id)")
      .in("base.operacao_id", operationIds),
    sb
      .from("shopee_pnr")
      .select("valor, created_time, base!inner(id, operacao_id)")
      .not("created_time", "is", null)
      .in("base.operacao_id", operationIds),
  ])

  type DsRow = BaseScoped & { data_pt_br: string; saiu: number; entregues: number }
  type SlaRow = BaseScoped & { data_pt_br: string; total: number; entregues: number }
  type StuckRow = BaseScoped & {
    base_id: string
    data_pt_br: string
    seq: number
    ainda_stuck: number
  }
  type PnrRow = BaseScoped & { created_time: string | null; valor: number | null }

  const dsRows = (dsRes.data ?? []) as unknown as DsRow[]
  const slaRows = (slaRes.data ?? []) as unknown as SlaRow[]
  const stuckRows = (stuckRes.data ?? []) as unknown as StuckRow[]
  const pnrRows = (pnrRes.data ?? []) as unknown as PnrRow[]
  const allDates = new Set<string>()
  const baseIdsByOperation = new Map<string, Set<string>>()

  const addBase = (operationId: string, baseId: string) => {
    const set = baseIdsByOperation.get(operationId) ?? new Set<string>()
    set.add(baseId)
    baseIdsByOperation.set(operationId, set)
  }

  const dsMap = new Map<string, { saiu: number; entregues: number }>()
  for (const row of dsRows) {
    const operationId = row.base?.operacao_id
    const baseId = row.base?.id
    if (!operationId || !baseId) continue
    allDates.add(row.data_pt_br)
    addBase(operationId, baseId)
    const itemKey = baseKey(operationId, baseId, row.data_pt_br)
    const current = dsMap.get(itemKey) ?? { saiu: 0, entregues: 0 }
    current.saiu += row.saiu
    current.entregues += row.entregues
    dsMap.set(itemKey, current)
  }

  const slaMap = new Map<string, { total: number; entregues: number }>()
  for (const row of slaRows) {
    const operationId = row.base?.operacao_id
    const baseId = row.base?.id
    if (!operationId || !baseId) continue
    allDates.add(row.data_pt_br)
    addBase(operationId, baseId)
    const itemKey = baseKey(operationId, baseId, row.data_pt_br)
    const current = slaMap.get(itemKey) ?? { total: 0, entregues: 0 }
    current.total += row.total
    current.entregues += row.entregues
    slaMap.set(itemKey, current)
  }

  const latestStuckByBase = new Map<string, StuckRow>()
  for (const row of stuckRows) {
    const operationId = row.base?.operacao_id
    if (!operationId) continue
    allDates.add(row.data_pt_br)
    addBase(operationId, row.base_id)
    const itemKey = baseKey(operationId, row.base_id, row.data_pt_br)
    const current = latestStuckByBase.get(itemKey)
    if (!current || row.seq > current.seq) latestStuckByBase.set(itemKey, row)
  }

  const stuckMap = new Map<string, number>()
  for (const row of latestStuckByBase.values()) {
    const operationId = row.base?.operacao_id
    if (!operationId) continue
    const itemKey = baseKey(operationId, row.base_id, row.data_pt_br)
    stuckMap.set(itemKey, (stuckMap.get(itemKey) ?? 0) + row.ainda_stuck)
  }

  const pnrMap = new Map<string, number>()
  for (const row of pnrRows) {
    const operationId = row.base?.operacao_id
    const baseId = row.base?.id
    const date = datePtBrFromTimestamp(row.created_time)
    if (!operationId || !baseId || !date) continue
    allDates.add(date)
    addBase(operationId, baseId)
    const itemKey = baseKey(operationId, baseId, date)
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

  const sb = createAdminClient()
  const [dsRes, pnrRes] = await Promise.all([
    sb
      .from("shopee_ds_driver")
      .select("saiu, entregues, ocorrencias, driver_id, driver(name), base!inner(id, slug, operacao_id)")
      .eq("data_pt_br", day)
      .in("base.operacao_id", operationIds),
    sb
      .from("shopee_pnr")
      .select("driver_id, valor, created_time, base!inner(id, slug, operacao_id)")
      .not("created_time", "is", null)
      .in("base.operacao_id", operationIds),
  ])

  type Row = {
    saiu: number
    entregues: number
    ocorrencias: number
    driver_id: string | null
    driver: { name: string } | null
    base: { id: string; slug: string; operacao_id: string } | null
  }
  type PnrRow = {
    driver_id: string | null
    valor: number | null
    created_time: string | null
    base: { id: string; slug: string; operacao_id: string } | null
  }

  const pnrByDriverBase = new Map<string, number>()
  for (const row of (pnrRes.data ?? []) as unknown as PnrRow[]) {
    if (!row.driver_id || !row.base || datePtBrFromTimestamp(row.created_time) !== day) continue
    const itemKey = `${row.base.id}::${row.driver_id}`
    pnrByDriverBase.set(itemKey, (pnrByDriverBase.get(itemKey) ?? 0) + Number(row.valor ?? 0))
  }

  return ((dsRes.data ?? []) as unknown as Row[])
    .filter((row) => row.driver_id && row.base)
    .map((row) => ({
      driver_id: row.driver_id!,
      name: row.driver?.name ?? row.driver_id!,
      saiu: row.saiu,
      entregues: row.entregues,
      ocorrencias: row.ocorrencias,
      ds_pct: row.saiu ? round1((row.entregues / row.saiu) * 100) : 0,
      prejuizo: Number((pnrByDriverBase.get(`${row.base!.id}::${row.driver_id}`) ?? 0).toFixed(2)),
      baseId: row.base!.id,
      baseSlug: row.base!.slug,
      operationId: row.base!.operacao_id,
    }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.ds_pct - b.ds_pct)
}

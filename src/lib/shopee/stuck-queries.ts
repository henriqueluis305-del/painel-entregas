import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { DELIVERED_STATUS } from "@/lib/shopee/stuck"

export type StuckRow = {
  codigo: string
  status: string
  dias_preso: number | null
  agency: string | null
  delivered_at: string | null
  last_status_at: string | null
  base_slug: string
  base_label: string
  driver_id: string | null
  driver_name: string | null
}

type EmbeddedRow = {
  codigo: string
  status: string
  dias_preso: number | null
  agency: string | null
  delivered_at: string | null
  last_status_at: string | null
  base: { slug: string; label: string; operacao_id: string } | null
  driver: { id: string; name: string } | null
}

/** Maior `last_backlog_date` da operação (o "dia atual" da visão). */
async function latestBacklogDate(
  sb: ReturnType<typeof createAdminClient>,
  operacaoId: string,
): Promise<string | null> {
  const { data } = await sb
    .from("shopee_package")
    .select("last_backlog_date, base!inner(operacao_id)")
    .eq("base.operacao_id", operacaoId)
    .not("last_backlog_date", "is", null)
    .order("last_backlog_date", { ascending: false })
    .limit(1)
  const row = (data ?? [])[0] as { last_backlog_date: string } | undefined
  return row?.last_backlog_date ?? null
}

/** Pacotes stuck da operação, opcionalmente filtrados por bases e pelo dia. */
export async function getStuckPackages(
  operacaoId: string,
  baseSlugs: string[] = [],
  opts: { dailyReset?: boolean } = {},
): Promise<StuckRow[]> {
  const sb = createAdminClient()
  // limpeza diária: mostra só o backlog do dia mais recente (DB intacto)
  const day = opts.dailyReset ? await latestBacklogDate(sb, operacaoId) : null
  const SELECT =
    "codigo, status, dias_preso, agency, delivered_at, last_status_at, base!inner(slug, label, operacao_id), driver(id, name)"

  // builder reutilizável (mesmos filtros p/ contagem e p/ as páginas)
  const build = (head: boolean) => {
    let q = head
      ? sb.from("shopee_package").select(SELECT, { count: "exact", head: true })
      : sb.from("shopee_package").select(SELECT)
    q = q.eq("base.operacao_id", operacaoId)
    if (baseSlugs.length) q = q.in("base.slug", baseSlugs)
    if (day) q = q.eq("last_backlog_date", day)
    return q
  }

  // 1 contagem + N páginas EM PARALELO (PostgREST limita ~1000/req).
  const { count, error: cErr } = await build(true)
  if (cErr) throw new Error(`getStuckPackages(count): ${cErr.message}`)
  const total = count ?? 0
  const PAGE = 1000
  const pages = Math.ceil(total / PAGE)
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      build(false)
        .order("dias_preso", { ascending: false, nullsFirst: false })
        .order("codigo")
        .range(i * PAGE, i * PAGE + PAGE - 1),
    ),
  )
  const all: EmbeddedRow[] = []
  for (const r of results) {
    if (r.error) throw new Error(`getStuckPackages: ${r.error.message}`)
    all.push(...((r.data ?? []) as unknown as EmbeddedRow[]))
  }

  return all.map((r) => ({
    codigo: r.codigo,
    status: r.status,
    dias_preso: r.dias_preso,
    agency: r.agency,
    delivered_at: r.delivered_at,
    last_status_at: r.last_status_at,
    base_slug: r.base?.slug ?? "",
    base_label: r.base?.label ?? "",
    driver_id: r.driver?.id ?? null,
    driver_name: r.driver?.name ?? null,
  }))
}

export type CheckpointPoint = {
  seq: number
  label: string
  total: number
  ainda: number
  resolv: number
  pct: number // % ainda em stuck
}

type EmbeddedCheckpoint = {
  seq: number
  label: string
  total: number
  ainda_stuck: number
  resolvidos: number
  base: { slug: string; operacao_id: string } | null
}

/** Série de burn-down: % ainda stuck por checkpoint (upload), agregado nas bases. */
export async function getStuckCheckpoints(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<CheckpointPoint[]> {
  const sb = createAdminClient()
  let q = sb
    .from("shopee_stuck_checkpoint")
    .select("seq, label, total, ainda_stuck, resolvidos, base!inner(slug, operacao_id)")
    .eq("base.operacao_id", operacaoId)
    .order("seq")
  if (baseSlugs.length) q = q.in("base.slug", baseSlugs)

  const { data, error } = await q
  if (error) throw new Error(`getStuckCheckpoints: ${error.message}`)

  const map = new Map<number, { label: string; total: number; ainda: number; resolv: number }>()
  for (const r of (data ?? []) as unknown as EmbeddedCheckpoint[]) {
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

export type StuckKpis = {
  total: number
  ativos: number
  entregues: number
  motoristas: number
  bases: number
}

/** É um pacote ainda "preso" (não entregue)? */
export function isPackageDelivered(r: StuckRow): boolean {
  return r.delivered_at != null || r.status === DELIVERED_STATUS
}

export function computeStuckKpis(rows: StuckRow[]): StuckKpis {
  const drivers = new Set<string>()
  const bases = new Set<string>()
  let entregues = 0
  for (const r of rows) {
    if (r.driver_id) drivers.add(r.driver_id)
    if (r.base_slug) bases.add(r.base_slug)
    if (isPackageDelivered(r)) entregues++
  }
  return {
    total: rows.length,
    ativos: rows.length - entregues,
    entregues,
    motoristas: drivers.size,
    bases: bases.size,
  }
}

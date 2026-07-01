import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { lookupCeps } from "@/lib/cep"
import { FORA_DE_ABRANGENCIA } from "@/lib/shopee/stuck"
import type { CheckpointPoint, StuckRow } from "@/lib/shopee/stuck"

// Re-export para consumidores server que importam tudo de stuck-queries.
export type { CheckpointPoint, StuckKpis, StuckRow } from "@/lib/shopee/stuck"
export { computeStuckKpis, isPackageDelivered } from "@/lib/shopee/stuck"

type EmbeddedRow = {
  codigo: string
  status: string
  dias_preso: number | null
  agency: string | null
  cep: string | null
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

/**
 * Cidades habilitadas por base no Config (`enabled`), reaproveitadas no Stuck —
 * um switch só, vale p/ SLA, DS e o "Fora de Abrangência". Devolve o conjunto
 * `${base_slug}|${cidade}` das cidades ligadas. Opt-in estrito: cidade que não
 * está aqui (base sem nada ligado, inclusive) é tratada como fora de abrangência.
 */
async function cidadesHabilitadas(
  sb: ReturnType<typeof createAdminClient>,
  operacaoId: string,
  baseSlugs: string[],
): Promise<Set<string>> {
  const set = new Set<string>()
  const PAGE = 1000
  type Row = { cidade: string; enabled: boolean; base: { slug: string } | null }
  for (let from = 0; ; from += PAGE) {
    let q = sb
      .from("shopee_base_cidade")
      .select("cidade, enabled, base!inner(slug, operacao_id)")
      .eq("base.operacao_id", operacaoId)
      .order("id") // ordem única (PK) p/ paginação sem pulos
      .range(from, from + PAGE - 1)
    if (baseSlugs.length) q = q.in("base.slug", baseSlugs)
    const { data, error } = await q
    if (error) throw new Error(`cidadesHabilitadas: ${error.message}`)
    const batch = (data ?? []) as unknown as Row[]
    for (const r of batch) {
      const slug = r.base?.slug ?? ""
      if (slug && r.enabled && r.cidade) set.add(`${slug}|${r.cidade}`)
    }
    if (batch.length < PAGE) break
  }
  return set
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
    "codigo, status, dias_preso, agency, cep, delivered_at, last_status_at, base!inner(slug, label, operacao_id), driver(id, name)"

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

  // Resolve cidade a partir do CEP (cache cep_cache + ViaCEP nos que faltam).
  const cidadePorCep = await lookupCeps(all.map((r) => r.cep ?? ""))
  // Cidades habilitadas no Config p/ separar "da base" x "fora de abrangência".
  const habilitadas = await cidadesHabilitadas(sb, operacaoId, baseSlugs)

  return all.map((r) => {
    const slug = r.base?.slug ?? ""
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
      base_label: r.base?.label ?? "",
      driver_id: r.driver?.id ?? null,
      driver_name: r.driver?.name ?? null,
      cep: r.cep ?? null,
      cidade: daBase ? cepCidade : FORA_DE_ABRANGENCIA,
      bairro: daBase ? cepBairro : FORA_DE_ABRANGENCIA,
    }
  })
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
  // burn-down é do DIA mais recente (senão a semana toda se mistura)
  const { data: last } = await sb
    .from("shopee_stuck_checkpoint")
    .select("data_pt_br, base!inner(operacao_id)")
    .eq("base.operacao_id", operacaoId)
    .order("ts", { ascending: false })
    .limit(1)
  const day = (last ?? [])[0]?.data_pt_br as string | undefined
  if (!day) return []

  let q = sb
    .from("shopee_stuck_checkpoint")
    .select("seq, label, total, ainda_stuck, resolvidos, base!inner(slug, operacao_id)")
    .eq("base.operacao_id", operacaoId)
    .eq("data_pt_br", day)
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

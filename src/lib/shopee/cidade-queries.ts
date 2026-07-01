import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

type SbClient = ReturnType<typeof createAdminClient>

/** Linha da tabela por cidade do SLA (CIDADE/TOTAL/ENTREGUE/EM ROTA/INSUCESSOS/OUTROS/%). */
export type SlaCidadeRow = {
  cidade: string
  total: number
  entregues: number
  emRota: number
  insucessos: number // ocorrências
  outros: number // faltantes + outros
  pct: number
}

/** Linha da tabela por cidade do DS (CIDADE/TOTAL/ENTREGUE/EM ROTA/INSUCESSOS/%). */
export type DsCidadeRow = {
  cidade: string
  total: number // saiu
  entregues: number
  emRota: number
  insucessos: number // ocorrências
  pct: number
}

const pct = (entregues: number, total: number) =>
  total > 0 ? Number(((entregues / total) * 100).toFixed(1)) : 0

type SlaCidadeRaw = {
  base_id: string
  cidade: string
  total: number
  entregues: number
  em_rota: number
  ocorrencias: number
  faltantes: number
  outros: number
  base: { slug: string; operacao_id: string } | null
}

async function latestDay(
  sb: SbClient,
  table: "shopee_sla_cidade" | "shopee_ds_driver",
  operacaoId: string,
  baseSlugs: string[],
): Promise<string | null> {
  let q = sb
    .from(table)
    .select("data_pt_br, base!inner(slug, operacao_id)")
    .eq("base.operacao_id", operacaoId)
    .order("updated_at", { ascending: false })
    .limit(1)
  if (baseSlugs.length) q = q.in("base.slug", baseSlugs)
  const { data } = await q
  return ((data ?? []) as unknown as { data_pt_br: string }[])[0]?.data_pt_br ?? null
}

/** Visibilidade (base_id|cidade → show) das cidades das bases dadas. */
async function visibility(
  sb: SbClient,
  baseIds: string[],
  field: "show_sla" | "show_ds",
): Promise<Map<string, boolean>> {
  if (!baseIds.length) return new Map()
  const { data } = await sb
    .from("shopee_base_cidade")
    .select(`base_id, cidade, ${field}`)
    .in("base_id", baseIds)
  const map = new Map<string, boolean>()
  for (const v of (data ?? []) as Record<string, unknown>[]) {
    map.set(`${v.base_id}|${v.cidade}`, v[field] !== false)
  }
  return map
}

/** SLA por cidade do dia mais recente, só as cidades visíveis (show_sla). */
export async function getSlaCidades(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<{ day: string | null; rows: SlaCidadeRow[] }> {
  const sb = createAdminClient()
  const day = await latestDay(sb, "shopee_sla_cidade", operacaoId, baseSlugs)
  if (!day) return { day: null, rows: [] }

  let q = sb
    .from("shopee_sla_cidade")
    .select(
      "base_id, cidade, total, entregues, em_rota, ocorrencias, faltantes, outros, base!inner(slug, operacao_id)",
    )
    .eq("base.operacao_id", operacaoId)
    .eq("data_pt_br", day)
  if (baseSlugs.length) q = q.in("base.slug", baseSlugs)
  const { data, error } = await q
  if (error) throw new Error(`getSlaCidades: ${error.message}`)
  const raw = (data ?? []) as unknown as SlaCidadeRaw[]

  const vis = await visibility(sb, [...new Set(raw.map((r) => r.base_id))], "show_sla")

  const agg = new Map<string, SlaCidadeRow>()
  for (const r of raw) {
    if (!r.cidade) continue // sem cidade não entra na tabela (conta só no total da base)
    if (vis.get(`${r.base_id}|${r.cidade}`) === false) continue
    const cur =
      agg.get(r.cidade) ??
      { cidade: r.cidade, total: 0, entregues: 0, emRota: 0, insucessos: 0, outros: 0, pct: 0 }
    cur.total += r.total
    cur.entregues += r.entregues
    cur.emRota += r.em_rota
    cur.insucessos += r.ocorrencias
    cur.outros += r.faltantes + r.outros
    agg.set(r.cidade, cur)
  }
  const rows = [...agg.values()]
  for (const r of rows) r.pct = pct(r.entregues, r.total)
  rows.sort((a, b) => b.total - a.total)
  return { day, rows }
}

export type SlaOutrosItem = { codigo: string; status: string }
export type SlaOutrosCidade = { cidade: string; total: number; itens: SlaOutrosItem[] }

type SlaOutrosRaw = {
  base_id: string
  cidade: string
  status: string
  codigo: string
  base: { slug: string; operacao_id: string } | null
}

/**
 * Itens do balde "Outros" do SLA (do dia) agrupados por cidade, só cidades
 * visíveis (show_sla). Cada grupo traz a lista de códigos BR p/ copiar.
 */
export async function getSlaOutros(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<{ day: string | null; cidades: SlaOutrosCidade[] }> {
  const sb = createAdminClient()
  const day = await latestDay(sb, "shopee_sla_cidade", operacaoId, baseSlugs)
  if (!day) return { day: null, cidades: [] }

  // Pode passar de 1000 linhas — pagina até esvaziar (limite do PostgREST).
  const raw: SlaOutrosRaw[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = sb
      .from("shopee_sla_outros_item")
      .select("base_id, cidade, status, codigo, base!inner(slug, operacao_id)")
      .eq("base.operacao_id", operacaoId)
      .eq("data_pt_br", day)
      .order("cidade")
      .range(from, from + PAGE - 1)
    if (baseSlugs.length) q = q.in("base.slug", baseSlugs)
    const { data, error } = await q
    if (error) throw new Error(`getSlaOutros: ${error.message}`)
    const batch = (data ?? []) as unknown as SlaOutrosRaw[]
    raw.push(...batch)
    if (batch.length < PAGE) break
  }

  const vis = await visibility(sb, [...new Set(raw.map((r) => r.base_id))], "show_sla")

  const agg = new Map<string, SlaOutrosCidade>()
  for (const r of raw) {
    const cidade = r.cidade || ""
    // cidade com toggle desligado no Config fica de fora; "sem cidade" sempre entra
    if (cidade && vis.get(`${r.base_id}|${cidade}`) === false) continue
    const cur = agg.get(cidade) ?? { cidade, total: 0, itens: [] }
    cur.total += 1
    cur.itens.push({ codigo: r.codigo, status: r.status })
    agg.set(cidade, cur)
  }
  const cidades = [...agg.values()].sort((a, b) => b.total - a.total)
  for (const c of cidades) c.itens.sort((a, b) => a.codigo.localeCompare(b.codigo))
  return { day, cidades }
}

type DsRaw = {
  base_id: string
  driver_id: string | null
  saiu: number
  entregues: number
  em_rota: number
  ocorrencias: number
  base: { slug: string; operacao_id: string } | null
}

/** DS por cidade: cruza cada motorista (DS) com a cidade dele vinda do SLA (PROCV). */
export async function getDsCidades(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<{ day: string | null; rows: DsCidadeRow[] }> {
  const sb = createAdminClient()
  const day = await latestDay(sb, "shopee_ds_driver", operacaoId, baseSlugs)
  if (!day) return { day: null, rows: [] }

  let q = sb
    .from("shopee_ds_driver")
    .select("base_id, driver_id, saiu, entregues, em_rota, ocorrencias, base!inner(slug, operacao_id)")
    .eq("base.operacao_id", operacaoId)
    .eq("data_pt_br", day)
  if (baseSlugs.length) q = q.in("base.slug", baseSlugs)
  const { data, error } = await q
  if (error) throw new Error(`getDsCidades: ${error.message}`)
  const raw = (data ?? []) as unknown as DsRaw[]

  // PROCV: cidade do motorista vinda do SLA do mesmo dia/base.
  const { data: mapData } = await sb
    .from("shopee_sla_driver_cidade")
    .select("base_id, driver_id, cidade")
    .eq("data_pt_br", day)
  const cidadeOf = new Map<string, string>()
  for (const m of (mapData ?? []) as { base_id: string; driver_id: string; cidade: string }[]) {
    cidadeOf.set(`${m.base_id}|${m.driver_id}`, m.cidade)
  }

  const vis = await visibility(sb, [...new Set(raw.map((r) => r.base_id))], "show_ds")

  const agg = new Map<string, DsCidadeRow>()
  for (const r of raw) {
    const cidade = (r.driver_id && cidadeOf.get(`${r.base_id}|${r.driver_id}`)) || ""
    if (!cidade) continue // motorista sem cidade resolvida fica de fora da tabela
    if (vis.get(`${r.base_id}|${cidade}`) === false) continue
    const cur =
      agg.get(cidade) ?? { cidade, total: 0, entregues: 0, emRota: 0, insucessos: 0, pct: 0 }
    cur.total += r.saiu
    cur.entregues += r.entregues
    cur.emRota += r.em_rota
    cur.insucessos += r.ocorrencias
    agg.set(cidade, cur)
  }
  const rows = [...agg.values()]
  for (const r of rows) r.pct = pct(r.entregues, r.total)
  rows.sort((a, b) => b.total - a.total)
  return { day, rows }
}

export type CidadeConfig = {
  base_slug: string
  base_label: string
  cidades: { cidade: string; show_sla: boolean; show_ds: boolean }[]
}

/** Cidades descobertas por base + flags de visibilidade (p/ a aba Config). */
export async function getCidadeConfig(operacaoId: string): Promise<CidadeConfig[]> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from("shopee_base_cidade")
    .select("cidade, show_sla, show_ds, base!inner(slug, label, operacao_id)")
    .eq("base.operacao_id", operacaoId)
    .order("cidade")
  if (error) throw new Error(`getCidadeConfig: ${error.message}`)

  type Row = {
    cidade: string
    show_sla: boolean
    show_ds: boolean
    base: { slug: string; label: string; operacao_id: string } | null
  }
  const byBase = new Map<string, CidadeConfig>()
  for (const r of (data ?? []) as unknown as Row[]) {
    const slug = r.base?.slug ?? ""
    const entry =
      byBase.get(slug) ??
      { base_slug: slug, base_label: r.base?.label ?? slug, cidades: [] }
    entry.cidades.push({ cidade: r.cidade, show_sla: r.show_sla, show_ds: r.show_ds })
    byBase.set(slug, entry)
  }
  return [...byBase.values()].sort((a, b) => a.base_label.localeCompare(b.base_label, "pt-BR"))
}

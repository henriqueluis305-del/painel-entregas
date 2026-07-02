import "server-only"

import { withPgClient } from "@painel/db"
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

/**
 * Cidades habilitadas (`base_id|cidade`) das bases dadas. Opt-in: só entra a
 * cidade com `enabled = true`; a ausência de linha (ou desligada) fica de fora.
 * Um switch só, vale p/ SLA, DS e o "Fora de Abrangência" do Stuck.
 */
async function enabledCidades(sb: SbClient, baseIds: string[]): Promise<Set<string>> {
  if (!baseIds.length) return new Set()
  const { data } = await sb
    .from("shopee_base_cidade")
    .select("base_id, cidade, enabled")
    .in("base_id", baseIds)
  const set = new Set<string>()
  for (const v of (data ?? []) as { base_id: string; cidade: string; enabled: boolean }[]) {
    if (v.enabled) set.add(`${v.base_id}|${v.cidade}`)
  }
  return set
}

/** SLA por cidade do dia mais recente, só as cidades habilitadas no Config. */
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

  const enabled = await enabledCidades(sb, [...new Set(raw.map((r) => r.base_id))])

  const agg = new Map<string, SlaCidadeRow>()
  for (const r of raw) {
    if (!r.cidade) continue // sem cidade não entra na tabela (conta só no total da base)
    if (!enabled.has(`${r.base_id}|${r.cidade}`)) continue // opt-in: só as cidades ligadas
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
 * habilitadas no Config. Cada grupo traz a lista de códigos BR p/ copiar.
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

  const enabled = await enabledCidades(sb, [...new Set(raw.map((r) => r.base_id))])

  const agg = new Map<string, SlaOutrosCidade>()
  for (const r of raw) {
    const cidade = r.cidade || ""
    // cidade não habilitada no Config fica de fora; "sem cidade" sempre entra
    if (cidade && !enabled.has(`${r.base_id}|${cidade}`)) continue
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

  const enabled = await enabledCidades(sb, [...new Set(raw.map((r) => r.base_id))])

  const agg = new Map<string, DsCidadeRow>()
  for (const r of raw) {
    const cidade = (r.driver_id && cidadeOf.get(`${r.base_id}|${r.driver_id}`)) || ""
    if (!cidade) continue // motorista sem cidade resolvida fica de fora da tabela
    if (!enabled.has(`${r.base_id}|${cidade}`)) continue // opt-in: só as cidades ligadas
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

export type CidadeConfigItem = {
  cidade: string
  enabled: boolean
  source: "sla" | "stuck" | "ambos" // onde a cidade aparece (dica visual)
}

/**
 * Cidades de UMA base p/ o Config: união do que aparece no rastreio de SLA
 * (linhas já persistidas em shopee_base_cidade + estado do switch) com o que
 * aparece no rastreio de Stuck (cidade resolvida do CEP dos pacotes, via
 * cep_cache). Cidade que só existe no Stuck ainda não tem linha → entra
 * desligada (default). Ordenada por cidade (pt-BR).
 */
export async function getCidadeConfigBase(
  operacaoId: string,
  baseSlug: string,
): Promise<CidadeConfigItem[]> {
  return withPgClient(async (c) => {
    const persisted = await c.query(
      `select sc.cidade, sc.enabled
         from shopee_base_cidade sc
         join base b on b.id = sc.base_id
        where b.operacao_id = $1 and b.slug = $2`,
      [operacaoId, baseSlug],
    )
    const stuck = await c.query(
      `select distinct cc.cidade
         from shopee_package p
         join base b on b.id = p.base_id
         join cep_cache cc on cc.cep = regexp_replace(p.cep, '\\D', '', 'g')
        where b.operacao_id = $1 and b.slug = $2 and coalesce(cc.cidade, '') <> ''`,
      [operacaoId, baseSlug],
    )
    const map = new Map<string, CidadeConfigItem>()
    for (const r of persisted.rows as { cidade: string; enabled: boolean }[]) {
      if (r.cidade) map.set(r.cidade, { cidade: r.cidade, enabled: r.enabled, source: "sla" })
    }
    for (const r of stuck.rows as { cidade: string }[]) {
      const cur = map.get(r.cidade)
      if (cur) cur.source = "ambos"
      else map.set(r.cidade, { cidade: r.cidade, enabled: false, source: "stuck" })
    }
    return [...map.values()].sort((a, b) => a.cidade.localeCompare(b.cidade, "pt-BR"))
  })
}

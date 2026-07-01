// Domínio do Stuck da Shopee — regras puras (reusáveis por script e app).

export const DELIVERED_STATUS = "Delivered"

/**
 * Rótulo único p/ cidade/bairro de pacote que não é de cidade habilitada da
 * base no Config (cidades por base — um switch só, opt-in): cidade resolvida do
 * CEP mas não ligada, OU sem CEP/cidade resolvida. Agrupa tudo num só nome,
 * evitando acúmulo de nomes de fora nas visões do Stuck. Aplicado uma vez, na
 * camada de dados (getStuckPackages), então vale p/ pivô, detalhe e comparação.
 */
export const FORA_DE_ABRANGENCIA = "Fora de Abrangência"

/**
 * Status que contam como "resolvido" — o pacote saiu do stuck (decisão 2026-06-29).
 * Inclui Delivered e os estágios de coleta/saída para rota. Um pacote importado
 * no backlog já em qualquer um destes nunca entra como stuck.
 */
export const RESOLVED_STATUSES = [
  "Delivering",
  "SP_Collection_Collected",
  "SP_Ready_Collection",
  "Delivered",
] as const
const RESOLVED_SET = new Set<string>(RESOLVED_STATUSES)

/** O status atual já resolve o pacote? */
export function isResolvedStatus(status: string): boolean {
  return RESOLVED_SET.has((status ?? "").trim())
}

// Estação (Station Name / Current Station) → slug de base.
// Portado de js/constants.js (BASE_ALIAS) do app antigo.
export const BASE_ALIAS: Record<string, string> = {
  xpt_es_linhares: "xpt-lrs-01",
  xpt_es_colatina: "xpt-ctn-01",
  "xpt_es_nova venécia": "xpt-nvc-01",
  "xpt_es_nova venecia": "xpt-nvc-01",
  "xpt_es_são mateus": "xpt-smt-01",
  "xpt_es_sao mateus": "xpt-smt-01",
  "xpt_rj_angra dos reis": "xpt-adr-02",
  "xpt_rj_angra dos reis_02": "xpt-adr-02",
  xpt_rj_saquarema: "xpt-sqr-01",
  // Estações RJ/BA que hoje só têm dados de PNR (bases criadas inativas — ver
  // sql/17_shopee_bases_rj_ba_pnr.sql). Sem estes aliases o fallback "_"→"-" não
  // casaria com o slug da base e cada novo import re-orfanaria os pacotes.
  "lm hub_rj_cabo frio_jd flamb": "lrj-21",
  "lm hub_rj_cps dos goytacazes": "lrj-24",
  "lm hub_rj_ilha do governador": "lrj-32",
  "lm hub_rj_macae_ imboassica": "lrj-05",
  "lm hub_rj_são cristóvão": "lrj-07",
  "lm hub_rj_são joão do meriti": "lrj-01",
  "lm hub_rj_nova friburgo": "lrj-02",
  "lm hub_rj_rio de janeiro_campo g": "lrj-04",
  "lm hub_rj_são gonçalo_02": "lrj-08",
  "lm hub_rj_são gonçalo": "lrj-08",
  "lm hub_rj_nova iguaçu": "lrj-27",
  "lm hub_rj_mage": "lrj-15",
  "lm hub_ba_salvador_pirajá": "lba-18",
  // Bases ES só-PNR (ver sql/18). Linhares "hub" (les-05) é distinto do
  // "xpt" (xpt-lrs-01) — a cidade aparece em duas bases de propósito.
  "lm hub_es_cachoeiro de itap": "les-01",
  "lm hub_es_linhares": "les-05",
}

/** Nome de estação cru → slug de base. Fallback: troca "_" por "-". */
export function resolveBaseSlug(raw: string): string {
  const n = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  return BASE_ALIAS[n] ?? n.replace(/_/g, "-")
}

/** Aceita número, "1.37" ou "1,37". null se vazio/inválido. */
export function parseDiasPreso(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."))
  return Number.isFinite(n) ? n : null
}

/**
 * Regra de "pacote em Stuck" (decisão 2026-06-08, ampliada 2026-06-29):
 * floor(LM Hub Days) >= 1  E  status não-resolvido.
 * (Descarta: chegou hoje — floor 0 — e os que já estão resolvidos, ex.: importados
 * no backlog como Delivering.)
 */
export function isStuck(lmHubDays: unknown, status: string): boolean {
  const d = parseDiasPreso(lmHubDays)
  if (d == null) return false
  return Math.floor(d) >= 1 && !isResolvedStatus(status)
}

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
  cep: string | null
  cidade: string | null
  bairro: string | null
}

/** Dimensão de agrupamento do pivô (linhas da visão "Por …"). */
export type StuckDim = "base" | "status" | "cidade" | "bairro"

/** Valor da linha `r` para a dimensão `dim` (chave do pivô e do drill-down). */
export function stuckDimValue(r: StuckRow, dim: StuckDim): string {
  switch (dim) {
    case "base":
      return r.base_label
    case "status":
      return r.status
    case "cidade":
      return r.cidade ?? "—"
    case "bairro":
      return r.bairro ?? "—"
  }
}

// Faixas de dias preso (compartilhadas entre o pivô e o detalhe).
export const STUCK_RANGES = ["1", "2-4", "5-7", "8-14", ">=15"] as const
export type StuckRange = (typeof STUCK_RANGES)[number]

/** floor(dias) → faixa. null para dias vazio/inválido ou < 1 (não é stuck). */
export function diasToRange(dias: number | null): StuckRange | null {
  if (dias == null) return null
  const d = Math.floor(dias)
  if (d < 1) return null
  if (d < 2) return "1"
  if (d < 5) return "2-4"
  if (d < 8) return "5-7"
  if (d < 15) return "8-14"
  return ">=15"
}

export type CheckpointPoint = {
  seq: number
  label: string
  total: number
  ainda: number
  resolv: number
  pct: number // % ainda em stuck
}

export type StuckKpis = {
  total: number
  ativos: number
  entregues: number
  motoristas: number
  bases: number
}

/** O pacote já saiu do stuck (resolvido)? */
export function isPackageDelivered(r: StuckRow): boolean {
  return r.delivered_at != null || isResolvedStatus(r.status)
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

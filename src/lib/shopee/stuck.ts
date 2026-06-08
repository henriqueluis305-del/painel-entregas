// Domínio do Stuck da Shopee — regras puras (reusáveis por script e app).

export const DELIVERED_STATUS = "Delivered"

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
 * Regra de "pacote em Stuck" (decisão 2026-06-08):
 * floor(LM Hub Days) >= 1  E  status != Delivered.
 * (Descarta: chegou hoje — floor 0 — e já entregue.)
 */
export function isStuck(lmHubDays: unknown, status: string): boolean {
  const d = parseDiasPreso(lmHubDays)
  if (d == null) return false
  return Math.floor(d) >= 1 && (status ?? "").trim() !== DELIVERED_STATUS
}

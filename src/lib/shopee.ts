// Constantes compartilhadas (client + server) da operação Shopee.

export const SHOPEE_SLUG = "shopee"
export const SHOPEE_BASE_PATH = `/dashboard/operacao/${SHOPEE_SLUG}`

export type ShopeeTab = {
  slug: string
  label: string
  admin?: boolean
}

export const SHOPEE_TABS: ShopeeTab[] = [
  { slug: "geral", label: "Geral" },
  { slug: "sla", label: "SLA" },
  { slug: "ds", label: "DS" },
  { slug: "stuck", label: "Stuck" },
  { slug: "pnr", label: "PNR" },
  { slug: "uploads", label: "Uploads", admin: true },
  { slug: "config", label: "Config", admin: true },
]

export type ShopeePeriod = {
  value: string
  label: string
}

// Períodos fixos. "Últimos N dias" (regex /^\d+d$/), "dia" (dia específico,
// usa `from`) e "intervalo" (de `from` até `to`) são resolvidos dinamicamente
// em periodLabel()/resolvePeriodRange() — não entram neste catálogo.
export const SHOPEE_PERIODS: ShopeePeriod[] = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "semanal", label: "Semanal" },
  { value: "tudo", label: "Todo o período" },
]

export const SHOPEE_DEFAULT_PERIOD = "hoje"
// PNR é cumulativo (tickets persistem entre dias), então o padrão mostra tudo —
// "hoje" filtraria por created_time = current_date e esconderia prejuízos abertos.
export const SHOPEE_PNR_DEFAULT_PERIOD = "tudo"

export type ShopeeBaseOption = { slug: string; label: string }

/** Filtros lidos dos searchParams (estado canônico na URL). */
export type ShopeeFilters = {
  /** Base única (filtro básico). Vazio = todas. */
  base: string
  /** Bases do filtro avançado (multi). Tem precedência sobre `base`. */
  bases: string[]
  period: string
  /** Datas custom (quando period for intervalo manual no futuro). */
  from?: string
  to?: string
}

type RawSearchParams = Record<string, string | string[] | undefined>

function pickOne(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? ""
  return v ?? ""
}

/** Normaliza os searchParams (já resolvidos) em ShopeeFilters. */
export function parseShopeeFilters(
  sp: RawSearchParams,
  defaultPeriod: string = SHOPEE_DEFAULT_PERIOD,
): ShopeeFilters {
  const basesRaw = pickOne(sp.bases)
  const bases = basesRaw
    ? basesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : []
  const period = pickOne(sp.period) || defaultPeriod
  return {
    base: pickOne(sp.base),
    bases,
    period,
    from: pickOne(sp.from) || undefined,
    to: pickOne(sp.to) || undefined,
  }
}

/** Bases efetivas para consulta: multi (avançado) > single (básico) > todas. */
export function effectiveBases(f: ShopeeFilters): string[] {
  if (f.bases.length) return f.bases
  if (f.base) return [f.base]
  return []
}

function formatBr(iso: string): string {
  const [y, m, d] = iso.split("-")
  return y && m && d ? `${d}/${m}/${y}` : iso
}

/** Rótulo legível do período, incluindo os modos dinâmicos (Nd / dia / intervalo). */
export function periodLabel(value: string, from?: string, to?: string): string {
  const fixed = SHOPEE_PERIODS.find((p) => p.value === value)
  if (fixed) return fixed.label
  if (value === "dia") return from ? `Dia ${formatBr(from)}` : "Dia específico"
  if (value === "intervalo") {
    if (from && to) return `${formatBr(from)} a ${formatBr(to)}`
    if (from) return `A partir de ${formatBr(from)}`
    return "Intervalo"
  }
  const dias = /^(\d+)d$/.exec(value)
  if (dias) return `Últimos ${dias[1]} dias`
  return value
}

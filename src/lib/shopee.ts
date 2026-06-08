// Constantes compartilhadas (client + server) da operação Shopee.

export const SHOPEE_SLUG = "shopee"
export const SHOPEE_BASE_PATH = `/dashboard/operacao/${SHOPEE_SLUG}`

export type ShopeeTab = {
  slug: string
  label: string
  wip?: boolean
  admin?: boolean
}

export const SHOPEE_TABS: ShopeeTab[] = [
  { slug: "geral", label: "Geral" },
  { slug: "sla", label: "SLA" },
  { slug: "ds", label: "DS" },
  { slug: "stuck", label: "Stuck" },
  { slug: "pnr", label: "PNR", wip: true },
  { slug: "uploads", label: "Uploads", admin: true },
]

export type ShopeePeriod = {
  value: string
  label: string
}

export const SHOPEE_PERIODS: ShopeePeriod[] = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "tudo", label: "Todo o período" },
]

export const SHOPEE_DEFAULT_PERIOD = "hoje"

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
export function parseShopeeFilters(sp: RawSearchParams): ShopeeFilters {
  const basesRaw = pickOne(sp.bases)
  const bases = basesRaw
    ? basesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : []
  const period = pickOne(sp.period) || SHOPEE_DEFAULT_PERIOD
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

export function periodLabel(value: string): string {
  return SHOPEE_PERIODS.find((p) => p.value === value)?.label ?? value
}

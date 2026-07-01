import { ShopeeFilterBar } from "@/components/shopee/filter-bar"
import { getOperacaoBySlug } from "@/lib/queries"
import { SHOPEE_SLUG } from "@/lib/shopee"

/** Cabeçalho padrão de uma subtab: título + subtítulo + barra de filtros. */
export async function ShopeeSubtabShell({
  title,
  description,
  actions,
  defaultPeriod,
  bases: basesProp,
  filterExtra,
  children,
}: {
  title: string
  description: string
  actions?: React.ReactNode
  defaultPeriod?: string
  bases?: Array<{ slug: string; label: string }>
  /** Controle extra renderizado ao lado da barra de filtros (ex.: seletor de semana). */
  filterExtra?: React.ReactNode
  children?: React.ReactNode
}) {
  const bases = basesProp ?? await (async () => {
    const op = await getOperacaoBySlug(SHOPEE_SLUG)
    return (op?.bases ?? []).filter((b) => b.active).map((b) => ({ slug: b.slug, label: b.label }))
  })()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {actions}
      </div>

      <ShopeeFilterBar bases={bases} defaultPeriod={defaultPeriod} extra={filterExtra} />

      {children}
    </div>
  )
}

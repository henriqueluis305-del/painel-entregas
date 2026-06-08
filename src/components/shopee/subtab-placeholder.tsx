import { ConstructionIcon } from "lucide-react"

import { ShopeeFilterBar } from "@/components/shopee/filter-bar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getOperacaoBySlug } from "@/lib/queries"
import { SHOPEE_SLUG } from "@/lib/shopee"

export async function SubtabPlaceholder({
  title,
  description,
  sources,
  planned,
  children,
}: {
  title: string
  description: string
  sources?: string[]
  planned: string[]
  children?: React.ReactNode
}) {
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const bases = (op?.bases ?? [])
    .filter((b) => b.active)
    .map((b) => ({ slug: b.slug, label: b.label }))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      <ShopeeFilterBar bases={bases} />

      {children}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ConstructionIcon className="text-muted-foreground size-4" />
            Em construção
          </CardTitle>
          <CardDescription>
            Estrutura criada na Fase 1. Dados e visualizações chegam nas próximas
            fases.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          {sources && sources.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
                Fonte de dados
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-1">
                {sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
              Próximos passos
            </p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1">
              {planned.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

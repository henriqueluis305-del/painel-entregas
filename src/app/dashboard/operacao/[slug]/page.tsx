import { notFound } from "next/navigation"
import { BoxesIcon } from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getOperacaoBySlug } from "@/lib/queries"

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const op = await getOperacaoBySlug(slug)
  if (!op) notFound()

  return (
    <>
      <SiteHeader title={op.label} />
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={BoxesIcon}
            label="Bases"
            value={op.bases.length}
            color="#0ea5e9"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bases de {op.label}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {op.bases.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhuma base cadastrada nesta operação.
              </p>
            ) : (
              op.bases.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-1 rounded-lg border p-4"
                >
                  <span className="font-medium">{b.label}</span>
                  <span className="text-muted-foreground text-xs">{b.slug}</span>
                  <span className="text-muted-foreground mt-2 text-xs">
                    Sem snapshots ainda
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

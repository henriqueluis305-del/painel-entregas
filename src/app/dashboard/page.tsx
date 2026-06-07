import Link from "next/link"
import {
  Building2Icon,
  BoxesIcon,
  UsersIcon,
  LineChartIcon,
  ChartSplineIcon,
} from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSessionProfile } from "@/lib/auth"
import { getDashboardStats, getOperacoesWithBases } from "@/lib/queries"

export default async function Page() {
  const [stats, ops, session] = await Promise.all([
    getDashboardStats(),
    getOperacoesWithBases(),
    getSessionProfile(),
  ])
  const nome = session?.profile?.empresa || session?.email || ""

  // Mesma resolução da sidebar: operações liberadas (in_sidebar/override) ∩ escopo,
  // e dentro de cada uma só as bases ativas (liberadas).
  const profile = session?.profile ?? null
  const canSeeAll = !profile || profile.is_admin || profile.base_scope === "ALL"
  const userSet = profile?.sidebar_operacoes ?? null
  const visibleOps = ops
    .filter((o) => (canSeeAll ? true : o.id === profile?.operacao_id))
    .filter((o) => (userSet ? userSet.includes(o.slug) : o.in_sidebar))
    .map((o) => ({ ...o, bases: o.bases.filter((b) => b.active) }))

  const totalBasesVisiveis = visibleOps.reduce((s, o) => s + o.bases.length, 0)

  return (
    <>
      <SiteHeader title="Início" />
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-2xl font-bold">
            Bem-vindo, <span className="text-primary">{nome}</span>
          </h2>
          <p className="text-muted-foreground text-sm">Visão geral da operação.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Building2Icon} label="Operações" value={visibleOps.length} color="#6366f1" />
          <KpiCard icon={BoxesIcon} label="Bases" value={totalBasesVisiveis} color="#0ea5e9" />
          <KpiCard icon={UsersIcon} label="Usuários" value={stats.usuarios} color="#ec4899" />
          <KpiCard icon={LineChartIcon} label="Registros SLA/DS" value={stats.slaDs} color="#f59e0b" />
        </div>

        {stats.slaDs === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <ChartSplineIcon className="text-muted-foreground size-8" />
              <div>
                <p className="font-medium">Sem dados de SLA/DS ainda</p>
                <p className="text-muted-foreground text-sm">
                  Importe planilhas em “SLA &amp; DS Hoje” para ver gráficos aqui.
                </p>
              </div>
              <Link
                href="/dashboard/hoje"
                className={buttonVariants({ size: "sm" })}
              >
                Ir para SLA &amp; DS Hoje
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Operações &amp; bases</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleOps.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Nenhuma operação liberada para exibição.
              </p>
            )}
            {visibleOps.map((op) => (
              <Link
                key={op.id}
                href={`/dashboard/operacao/${op.slug}`}
                className="hover:border-primary/50 hover:bg-accent/40 rounded-lg border p-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{op.label}</span>
                  <Badge variant="secondary">{op.bases.length}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {op.bases.length ? (
                    op.bases.map((b) => (
                      <Badge key={b.id} variant="outline">
                        {b.label}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      sem bases ativas
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

import { redirect } from "next/navigation"

import { HomeDashboard } from "@/components/dashboard/home-dashboard"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { getSessionProfile } from "@/lib/auth"
import {
  getHomeBases,
  getHomeDriverRanking,
  getHomeMetricSeries,
} from "@/lib/dashboard-home-queries"
import { getAllowedOperacoes } from "@/lib/live-queries"

export default async function Page() {
  const session = await getSessionProfile()
  if (!session) redirect("/login")
  if (!session.profile) redirect("/login")

  const { operacoes } = await getAllowedOperacoes(session.profile)
  const [series, baseData] = await Promise.all([
    getHomeMetricSeries(operacoes),
    getHomeBases(operacoes),
  ])
  const drivers = await getHomeDriverRanking(operacoes, series.latestDay)

  return (
    <>
      <SiteHeader title="Início" />
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Painel operacional</h2>
          <p className="text-sm text-muted-foreground">
            Visão consolidada das operações liberadas para a sua sidebar.
          </p>
        </div>

        {operacoes.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma operação liberada para você.
            </CardContent>
          </Card>
        ) : (
          <HomeDashboard
            operations={operacoes}
            points={series.points}
            latestDay={series.latestDay}
            drivers={drivers}
            bases={baseData.bases}
            driverPresence={baseData.driverPresence}
          />
        )}
      </div>
    </>
  )
}

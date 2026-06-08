"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BurnDownChart } from "@/components/shopee/burn-down-chart"
import { DonutLegend, MiniDonut, type DonutSegment } from "@/components/shopee/mini-donut"
import type { CheckpointPoint, StuckKpis } from "@/lib/shopee/stuck-queries"

export function StuckCharts({
  points,
  kpi,
}: {
  points: CheckpointPoint[]
  kpi: StuckKpis
}) {
  const pctResolv = kpi.total ? Math.round((kpi.entregues / kpi.total) * 100) : 0
  const segments: DonutSegment[] = [
    { key: "ativos", label: "Stuck ativos", value: kpi.ativos, color: "#f59e0b" },
    { key: "resolv", label: "Resolvidos", value: kpi.entregues, color: "#22c55e" },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Burn-down do dia</CardTitle>
          <CardDescription>% dos pacotes do dia ainda em stuck a cada upload</CardDescription>
        </CardHeader>
        <CardContent>
          <BurnDownChart points={points.map((p) => ({ label: p.label, pct: p.pct }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stuck vs Resolvidos (hoje)</CardTitle>
          <CardDescription>
            {kpi.total} pacotes do dia · {pctResolv}% resolvidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-6">
            <MiniDonut segments={segments} centerValue={`${pctResolv}%`} centerSub="resolvidos" />
            <DonutLegend segments={segments} total={kpi.total} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

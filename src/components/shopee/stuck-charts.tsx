"use client"

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { CheckpointPoint, StuckKpis } from "@/lib/shopee/stuck-queries"

const burndownConfig = {
  pct: { label: "% ainda stuck", color: "var(--chart-1)" },
} satisfies ChartConfig

const monitorConfig = {
  ainda: { label: "Stuck", color: "#f59e0b" },
  resolv: { label: "Resolvidos", color: "#22c55e" },
} satisfies ChartConfig

export function StuckCharts({
  points,
  kpi,
}: {
  points: CheckpointPoint[]
  kpi: StuckKpis
}) {
  const pctResolv = kpi.total ? Math.round((kpi.entregues / kpi.total) * 100) : 0
  const monitorData = [
    { key: "ainda", label: "Stuck", value: kpi.ativos, fill: "#f59e0b" },
    { key: "resolv", label: "Resolvidos", value: kpi.entregues, fill: "#22c55e" },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Burn-down */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Burn-down do dia</CardTitle>
          <CardDescription>
            % dos pacotes do dia ainda em stuck a cada upload
          </CardDescription>
        </CardHeader>
        <CardContent>
          {points.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              Sem checkpoints ainda.
            </p>
          ) : (
            <ChartContainer config={burndownConfig} className="h-[220px] w-full">
              <AreaChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  fontSize={11}
                  tickFormatter={(v) => `${v}%`}
                />
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(v) => `${v}% ainda stuck`} />}
                />
                <Area
                  dataKey="pct"
                  type="monotone"
                  stroke="var(--color-pct)"
                  fill="var(--color-pct)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Monitor stuck vs resolvidos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stuck vs Resolvidos (hoje)</CardTitle>
          <CardDescription>
            {kpi.total} pacotes do dia · {pctResolv}% resolvidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <ChartContainer config={monitorConfig} className="h-[180px] w-[180px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                  <Pie
                    data={monitorData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={58}
                    outerRadius={80}
                    strokeWidth={2}
                  >
                    {monitorData.map((d) => (
                      <Cell key={d.key} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums">{pctResolv}%</span>
                <span className="text-muted-foreground text-xs">resolvidos</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <Legend color="#f59e0b" label="Stuck ativos" value={kpi.ativos} total={kpi.total} />
              <Legend color="#22c55e" label="Resolvidos" value={kpi.entregues} total={kpi.total} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Legend({
  color,
  label,
  value,
  total,
}: {
  color: string
  label: string
  value: number
  total: number
}) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="size-3 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums">
        {value.toLocaleString("pt-BR")} ({pct}%)
      </span>
    </div>
  )
}

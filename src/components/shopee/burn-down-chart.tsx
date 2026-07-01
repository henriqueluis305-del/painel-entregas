"use client"

import { Area, AreaChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const config = {
  pct: { label: "%", color: "var(--chart-1)" },
} satisfies ChartConfig

/**
 * Eixo Y com zoom adaptativo: enquadra a faixa real dos pontos, deixando uma
 * folga levemente abaixo do menor valor e levemente acima do maior, para que a
 * onda fique visível mesmo quando todos os valores são altos (ex.: SLA 96–99%).
 */
function adaptiveDomain(values: number[], clampMax = 100): [number, number] {
  if (values.length === 0) return [0, clampMax]
  const min = Math.min(...values)
  const max = Math.max(...values)
  // folga ~15% da amplitude, com mínimo de 1 ponto pra não degenerar em linha reta
  const pad = Math.max((max - min) * 0.15, 1)
  let lower = Math.max(0, Math.floor(min - pad))
  let upper = Math.min(clampMax, Math.ceil(max + pad))
  if (lower >= upper) {
    lower = Math.max(0, lower - 1)
    upper = Math.min(clampMax, upper + 1)
  }
  return [lower, upper]
}

export function BurnDownChart({
  points,
  suffix = "%",
  adaptive = true,
}: {
  points: { label: string; pct: number }[]
  suffix?: string
  /** Ajusta o eixo Y à faixa dos dados (default). `false` trava em 0–100. */
  adaptive?: boolean
}) {
  if (points.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        Sem checkpoints ainda.
      </p>
    )
  }
  const domain: [number, number] = adaptive
    ? adaptiveDomain(points.map((p) => p.pct))
    : [0, 100]
  return (
    <ChartContainer config={config} className="h-[200px] w-full">
      <AreaChart data={points} margin={{ left: 4, right: 12, top: 14 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis
          domain={domain}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={36}
          fontSize={11}
          tickFormatter={(v) => `${v}${suffix}`}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(v) => `${v}${suffix}`} />}
        />
        <Area
          dataKey="pct"
          type="monotone"
          stroke="var(--color-pct)"
          fill="var(--color-pct)"
          fillOpacity={0.2}
          strokeWidth={2}
          dot={{ r: 3 }}
        >
          <LabelList
            dataKey="pct"
            position="top"
            offset={10}
            fontSize={11}
            className="fill-foreground"
            formatter={(v) => `${String(v)}${suffix}`}
          />
        </Area>
      </AreaChart>
    </ChartContainer>
  )
}

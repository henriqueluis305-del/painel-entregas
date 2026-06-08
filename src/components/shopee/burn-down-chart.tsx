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

export function BurnDownChart({
  points,
  suffix = "%",
}: {
  points: { label: string; pct: number }[]
  suffix?: string
}) {
  if (points.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        Sem checkpoints ainda.
      </p>
    )
  }
  return (
    <ChartContainer config={config} className="h-[200px] w-full">
      <AreaChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis
          domain={[0, 100]}
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

"use client"

import { Cell, Label, Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export type DonutSegment = { key: string; label: string; value: number; color: string }

export function MiniDonut({
  segments,
  centerValue,
  centerSub,
}: {
  segments: DonutSegment[]
  centerValue: string
  centerSub?: string
}) {
  const config: ChartConfig = Object.fromEntries(
    segments.map((s) => [s.label, { label: s.label, color: s.color }]),
  )
  return (
    <ChartContainer config={config} className="mx-auto aspect-square h-[180px]">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="label" hideLabel />} />
        <Pie
          data={segments}
          dataKey="value"
          nameKey="label"
          innerRadius={58}
          outerRadius={82}
          strokeWidth={2}
          isAnimationActive={false}
        >
          {segments.map((s) => (
            <Cell key={s.key} fill={s.color} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && viewBox.cx != null) {
                const { cx, cy } = viewBox as { cx: number; cy: number }
                return (
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={cx} y={cy - 4} className="fill-foreground text-2xl font-bold">
                      {centerValue}
                    </tspan>
                    {centerSub && (
                      <tspan x={cx} y={cy + 16} className="fill-muted-foreground text-xs">
                        {centerSub}
                      </tspan>
                    )}
                  </text>
                )
              }
              return null
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

export function DonutLegend({ segments, total }: { segments: DonutSegment[]; total: number }) {
  return (
    <div className="flex flex-col gap-2.5 text-sm">
      {segments.map((s) => {
        const pct = total ? Math.round((s.value / total) * 100) : 0
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-medium tabular-nums">
              {s.value.toLocaleString("pt-BR")} ({pct}%)
            </span>
          </div>
        )
      })}
    </div>
  )
}

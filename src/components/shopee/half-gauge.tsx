"use client"

import { Cell, Pie, PieChart } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

const cfg = {
  ok: { label: "OK", color: "#22c55e" },
  rest: { label: "Restante", color: "#ef4444" },
} satisfies ChartConfig

/** Medidor meia-lua (semicírculo) com % grande e legenda na base do arco. */
export function HalfGauge({ pct, sub }: { pct: number; sub: string }) {
  const p = Math.max(0, Math.min(100, pct))
  const data = [
    { k: "ok", value: p },
    { k: "rest", value: 100 - p },
  ]
  return (
    <div className="relative mx-auto h-[160px] w-full max-w-[300px]">
      <ChartContainer config={cfg} className="h-full w-full">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            innerRadius={72}
            outerRadius={104}
            cy="98%"
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill="#22c55e" />
            <Cell fill="#ef4444" />
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center">
        <span className="text-3xl leading-none font-bold tabular-nums">{pct}%</span>
        <span className="text-muted-foreground mt-1 text-xs">{sub}</span>
      </div>
    </div>
  )
}

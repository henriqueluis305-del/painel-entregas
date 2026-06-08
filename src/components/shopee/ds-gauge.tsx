"use client"

import { Cell, Pie, PieChart } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

const cfg = {
  ok: { label: "Entregues", color: "#22c55e" },
  rest: { label: "Restante", color: "#ef4444" },
} satisfies ChartConfig

export function DsGauge({ pct, saiu }: { pct: number; saiu: number }) {
  const p = Math.max(0, Math.min(100, pct))
  const data = [
    { k: "ok", value: p },
    { k: "rest", value: 100 - p },
  ]
  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <ChartContainer config={cfg} className="h-[150px] w-full">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            innerRadius="70%"
            outerRadius="100%"
            cy="95%"
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill="#22c55e" />
            <Cell fill="#ef4444" />
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums">{pct}%</span>
        <span className="text-muted-foreground text-xs">
          {saiu.toLocaleString("pt-BR")} encaminhados
        </span>
      </div>
    </div>
  )
}

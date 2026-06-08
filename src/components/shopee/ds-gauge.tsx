"use client"

import { Cell, Label, Pie, PieChart } from "recharts"

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
    <ChartContainer config={cfg} className="mx-auto h-[170px] w-full max-w-[300px]">
      <PieChart margin={{ top: 8, bottom: 8 }}>
        <Pie
          data={data}
          dataKey="value"
          startAngle={180}
          endAngle={0}
          innerRadius={72}
          outerRadius={100}
          cy="78%"
          stroke="none"
          isAnimationActive={false}
        >
          <Cell fill="#22c55e" />
          <Cell fill="#ef4444" />
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && viewBox.cx != null) {
                const { cx, cy } = viewBox as { cx: number; cy: number }
                return (
                  <text x={cx} y={cy} textAnchor="middle">
                    <tspan x={cx} y={cy - 26} className="fill-foreground text-3xl font-bold">
                      {pct}%
                    </tspan>
                    <tspan x={cx} y={cy - 6} className="fill-muted-foreground text-xs">
                      {saiu.toLocaleString("pt-BR")} encaminhados
                    </tspan>
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

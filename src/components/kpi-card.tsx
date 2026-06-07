import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

export function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  color: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
            color,
          }}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold tabular-nums">{value}</span>
          <span className="text-muted-foreground text-sm">{label}</span>
        </div>
      </CardContent>
    </Card>
  )
}

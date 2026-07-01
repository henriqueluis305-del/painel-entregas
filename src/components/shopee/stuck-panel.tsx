"use client"

import { useMemo, useState } from "react"
import { BoxesIcon, CheckCircle2Icon, EyeOffIcon, MapPinIcon, UsersIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { KpiCard } from "@/components/kpi-card"
import { StuckCharts } from "@/components/shopee/stuck-charts"
import { StuckViewTabs } from "@/components/shopee/stuck-view-tabs"
import { computeStuckKpis } from "@/lib/shopee/stuck"
import type { CheckpointPoint, StuckRow } from "@/lib/shopee/stuck"

/**
 * Painel do Stuck: KPIs + gráficos + visões, com filtro de status por EXCLUSÃO.
 * O usuário marca os status que NÃO quer ver; esses pacotes somem da contagem
 * total da aba (KPIs), da visão por base e do detalhe.
 */
export function StuckPanel({
  rows,
  points,
}: {
  rows: StuckRow[]
  points: CheckpointPoint[]
}) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  // Status distintos presentes nos dados (para montar o menu de exclusão).
  const statuses = useMemo(() => {
    const seen = new Set<string>()
    for (const r of rows) if (r.status) seen.add(r.status)
    return [...seen].sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [rows])

  // Linhas visíveis: tudo, menos os status excluídos.
  const visibleRows = useMemo(
    () => (excluded.size ? rows.filter((r) => !excluded.has(r.status)) : rows),
    [rows, excluded],
  )

  const kpi = useMemo(() => computeStuckKpis(visibleRows), [visibleRows])

  function toggle(status: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
            <EyeOffIcon className="size-4" />
            Ocultar status
            {excluded.size > 0 && (
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {excluded.size}
              </Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-auto min-w-[12rem] max-w-[20rem] [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="text-muted-foreground px-2 py-1.5 text-xs">
              Marque os status que NÃO quer ver
            </div>
            {excluded.size > 0 && (
              <DropdownMenuItem
                onClick={() => setExcluded(new Set())}
                className="text-muted-foreground text-xs"
              >
                Mostrar todos
              </DropdownMenuItem>
            )}
            {statuses.length === 0 ? (
              <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                Nenhum status
              </DropdownMenuItem>
            ) : (
              statuses.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={excluded.has(s)}
                  onCheckedChange={() => toggle(s)}
                  closeOnClick={false}
                  className="pr-2 pl-7 [&>[data-slot=dropdown-menu-checkbox-item-indicator]]:left-1.5 [&>[data-slot=dropdown-menu-checkbox-item-indicator]]:right-auto"
                >
                  <span className="truncate">{s}</span>
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={BoxesIcon} label="Stuck ativos" value={kpi.ativos} color="#f59e0b" />
        <KpiCard icon={CheckCircle2Icon} label="Entregues" value={kpi.entregues} color="#22c55e" />
        <KpiCard icon={UsersIcon} label="Motoristas" value={kpi.motoristas} color="#0ea5e9" />
        <KpiCard icon={MapPinIcon} label="Bases" value={kpi.bases} color="#a78bfa" />
      </div>

      <StuckCharts points={points} kpi={kpi} />

      <StuckViewTabs rows={visibleRows} />
    </>
  )
}

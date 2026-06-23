"use client"

import { useMemo, useState } from "react"
import {
  ActivityIcon,
  DatabaseIcon,
  MapPinnedIcon,
  PackageIcon,
  SlidersHorizontalIcon,
  TruckIcon,
} from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { DriverRanking } from "@/components/live/driver-ranking"
import { Button } from "@/components/ui/button"
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
  type ChartConfig,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DriverRank, OpLite } from "@/lib/live-queries"
import type {
  HomeBaseOption,
  HomeDriverPresence,
  HomeDriverRow,
  HomeMetric,
  HomeMetricPoint,
} from "@/lib/dashboard-home-queries"
import { cn } from "@/lib/utils"

type PeriodKey = "today" | "7d" | "14d" | "30d"

const METRICS: { value: HomeMetric; label: string; unit: "pct" | "count" | "money" }[] = [
  { value: "ds", label: "DS", unit: "pct" },
  { value: "stuck", label: "Stuck (final do dia)", unit: "count" },
  { value: "sla", label: "SLA", unit: "pct" },
  { value: "pnr", label: "PNR", unit: "money" },
]

const PERIODS: { value: PeriodKey; label: string; days: number }[] = [
  { value: "today", label: "Hoje", days: 1 },
  { value: "7d", label: "Últimos 7 dias", days: 7 },
  { value: "14d", label: "Últimos 14 dias", days: 14 },
  { value: "30d", label: "Últimos 30 dias", days: 30 },
]

const COLORS = [
  "var(--chart-5)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-1)",
]

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR")
}

function formatMetricValue(value: number | null | undefined, metric: HomeMetric) {
  if (value == null) return "Sem dado"
  if (metric === "ds" || metric === "sla") return `${value}%`
  if (metric === "pnr") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  return value.toLocaleString("pt-BR")
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof TruckIcon
  label: string
  value: string
  hint: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-1 p-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="bg-muted flex size-5 items-center justify-center rounded-md">
              <Icon className="size-3 text-muted-foreground" />
            </span>
            <p className="text-sm leading-tight font-semibold text-foreground">{label}</p>
          </div>
          <p className="text-xl leading-none font-semibold tracking-normal tabular-nums">{value}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

type HomeDashboardProps = {
  operations: OpLite[]
  points: HomeMetricPoint[]
  latestDay: string | null
  drivers: HomeDriverRow[]
  bases: HomeBaseOption[]
  driverPresence: HomeDriverPresence[]
}

export function HomeDashboard({
  operations,
  points,
  latestDay,
  drivers,
  bases,
  driverPresence,
}: HomeDashboardProps) {
  const [metric, setMetric] = useState<HomeMetric>("ds")
  const [period, setPeriod] = useState<PeriodKey>("7d")
  const [activeOps, setActiveOps] = useState(() => operations.map((operation) => operation.id))
  const [baseFilterOpen, setBaseFilterOpen] = useState(false)
  const [selectedBaseIds, setSelectedBaseIds] = useState(() => bases.map((base) => base.id))
  const [pendingBaseIds, setPendingBaseIds] = useState(() => bases.map((base) => base.id))
  const selectedMetric = METRICS.find((item) => item.value === metric) ?? METRICS[0]
  const selectedPeriod = PERIODS.find((item) => item.value === period) ?? PERIODS[1]
  const operationById = useMemo(
    () => new Map(operations.map((operation) => [operation.id, operation])),
    [operations],
  )
  const selectedBaseSet = useMemo(() => new Set(selectedBaseIds), [selectedBaseIds])
  const filteredBases = useMemo(
    () => bases.filter((base) => selectedBaseSet.has(base.id)),
    [bases, selectedBaseSet],
  )
  const filteredOperationIds = useMemo(
    () => [...new Set(filteredBases.map((base) => base.operationId))],
    [filteredBases],
  )
  const selectedBaseSlugs = useMemo(() => filteredBases.map((base) => base.slug), [filteredBases])

  const filteredKpis = useMemo(() => {
    const driverIds = new Set(
      driverPresence
        .filter((item) => selectedBaseSet.has(item.baseId))
        .map((item) => item.driverId),
    )
    return {
      activeDrivers: driverIds.size,
      monitoredOperations: filteredOperationIds.length,
      dataBases: filteredBases.length,
      monitoredPackages: filteredBases.reduce((sum, base) => sum + base.monitoredPackages, 0),
    }
  }, [driverPresence, filteredBases, filteredOperationIds.length, selectedBaseSet])
  const basesByOperation = useMemo(
    () =>
      operations.map((operation) => ({
        operation,
        bases: bases.filter((base) => base.operationId === operation.id),
      })),
    [bases, operations],
  )

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        operations.map((operation, index) => [
          operation.id,
          { label: operation.label, color: COLORS[index % COLORS.length] },
        ]),
      ) satisfies ChartConfig,
    [operations],
  )

  const chartData = useMemo(() => {
    const dates = [...new Set(points.map((point) => point.date))].slice(-selectedPeriod.days)
    const byDate = new Map(dates.map((date) => [date, { date, label: date.slice(0, 5) } as Record<string, string | number | null>]))
    const aggregates = new Map<
      string,
      {
        dsSaiu: number
        dsEntregues: number
        slaTotal: number
        slaEntregues: number
        stuck: number
        pnr: number
        hasPnr: boolean
      }
    >()

    for (const point of points) {
      if (!dates.includes(point.date)) continue
      if (!selectedBaseSet.has(point.baseId)) continue
      const itemKey = `${point.operationId}::${point.date}`
      const current = aggregates.get(itemKey) ?? {
        dsSaiu: 0,
        dsEntregues: 0,
        slaTotal: 0,
        slaEntregues: 0,
        stuck: 0,
        pnr: 0,
        hasPnr: false,
      }
      current.dsSaiu += point.dsSaiu
      current.dsEntregues += point.dsEntregues
      current.slaTotal += point.slaTotal
      current.slaEntregues += point.slaEntregues
      current.stuck += point.stuck ?? 0
      if (point.pnr != null) {
        current.pnr += point.pnr
        current.hasPnr = true
      }
      aggregates.set(itemKey, current)
    }

    for (const date of dates) {
      const row = byDate.get(date)
      if (!row) continue
      for (const operation of operations) {
        const current = aggregates.get(`${operation.id}::${date}`)
        if (!current) {
          row[operation.id] = null
          continue
        }
        if (metric === "ds") {
          row[operation.id] = current.dsSaiu
            ? Number(((current.dsEntregues / current.dsSaiu) * 100).toFixed(1))
            : null
        } else if (metric === "sla") {
          row[operation.id] = current.slaTotal
            ? Number(((current.slaEntregues / current.slaTotal) * 100).toFixed(1))
            : null
        } else if (metric === "stuck") {
          row[operation.id] = current.stuck
        } else if (metric === "pnr") {
          row[operation.id] = current.hasPnr ? Number(current.pnr.toFixed(2)) : null
        } else {
          row[operation.id] = null
        }
      }
    }

    return [...byDate.values()]
  }, [metric, operations, points, selectedBaseSet, selectedPeriod.days])

  function toggleOperation(operationId: string) {
    setActiveOps((current) => {
      if (current.includes(operationId)) {
        return current.length === 1 ? current : current.filter((id) => id !== operationId)
      }
      return [...current, operationId]
    })
  }

  function openBaseFilter() {
    setPendingBaseIds(selectedBaseIds)
    setBaseFilterOpen(true)
  }

  function togglePendingBase(baseId: string) {
    setPendingBaseIds((current) => {
      if (current.includes(baseId)) {
        return current.filter((id) => id !== baseId)
      }
      return [...current, baseId]
    })
  }

  function setPendingOperationBases(operationId: string, checked: boolean) {
    const operationBaseIds = bases.filter((base) => base.operationId === operationId).map((base) => base.id)
    setPendingBaseIds((current) => {
      const currentSet = new Set(current)
      for (const baseId of operationBaseIds) {
        if (checked) currentSet.add(baseId)
        else currentSet.delete(baseId)
      }
      return [...currentSet]
    })
  }

  function applyBaseFilter() {
    if (pendingBaseIds.length === 0) return
    setSelectedBaseIds(pendingBaseIds)
    setBaseFilterOpen(false)
  }

  const activeLines = operations.filter(
    (operation) => activeOps.includes(operation.id) && filteredOperationIds.includes(operation.id),
  )
  const operationIds = filteredOperationIds
  const filteredDrivers = useMemo<DriverRank[]>(() => {
    const map = new Map<string, DriverRank>()
    for (const row of drivers) {
      if (!selectedBaseSet.has(row.baseId)) continue
      const current = map.get(row.driver_id) ?? {
        driver_id: row.driver_id,
        name: row.name,
        saiu: 0,
        entregues: 0,
        ocorrencias: 0,
        ds_pct: 0,
        prejuizo: 0,
      }
      current.saiu += row.saiu
      current.entregues += row.entregues
      current.ocorrencias += row.ocorrencias
      current.prejuizo += row.prejuizo
      map.set(row.driver_id, current)
    }

    return [...map.values()]
      .map((driver) => ({
        ...driver,
        ds_pct: driver.saiu ? Number(((driver.entregues / driver.saiu) * 100).toFixed(1)) : 0,
        prejuizo: Number(driver.prejuizo.toFixed(2)),
      }))
      .sort((a, b) => b.ocorrencias - a.ocorrencias || a.ds_pct - b.ds_pct)
  }, [drivers, selectedBaseSet])

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={TruckIcon}
          label="Total de motoristas ativos"
          value={formatNumber(filteredKpis.activeDrivers)}
          hint="Dentro das operações liberadas"
        />
        <KpiCard
          icon={ActivityIcon}
          label="Operações monitoradas"
          value={formatNumber(filteredKpis.monitoredOperations)}
          hint="Filtradas pela sidebar"
        />
        <KpiCard
          icon={DatabaseIcon}
          label="Bases de dados"
          value={formatNumber(filteredKpis.dataBases)}
          hint="Bases ativas monitoradas"
        />
        <KpiCard
          icon={PackageIcon}
          label="Total de pacotes monitorados"
          value={formatNumber(filteredKpis.monitoredPackages)}
          hint="Soma dos pacotes importados"
        />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Atividade operacional</CardTitle>
              <CardDescription>
                {latestDay ? `Série até ${latestDay}` : "Sem dados importados ainda"}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={metric} onValueChange={(value) => setMetric(value as HomeMetric)}>
                <SelectTrigger size="sm" className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {METRICS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={period} onValueChange={(value) => setPeriod(value as PeriodKey)}>
                <SelectTrigger size="sm" className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {PERIODS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={openBaseFilter}
            >
              <SlidersHorizontalIcon className="size-3.5" />
              Filtros
              <span className="text-muted-foreground">
                {filteredBases.length}/{bases.length}
              </span>
            </Button>
            {operations.map((operation, index) => {
              const active = activeOps.includes(operation.id)
              return (
                <button
                  key={operation.id}
                  type="button"
                  onClick={() => toggleOperation(operation.id)}
                  className={cn(
                    "inline-flex h-7 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                    active
                      ? "border-foreground/20 bg-muted text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={active}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  {operation.label}
                </button>
              )
            })}
          </div>
        </CardHeader>

        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Sem dados para o período selecionado.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <LineChart data={chartData} margin={{ left: 4, right: 12, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={metric === "pnr" ? 70 : metric === "stuck" ? 48 : 36}
                  domain={selectedMetric.unit === "pct" ? [0, 100] : [0, "auto"]}
                  tickFormatter={(value) => formatMetricValue(Number(value), metric)}
                  fontSize={11}
                />
                <ChartTooltip
                  content={
                    <HomeChartTooltip
                      metric={metric}
                      operations={operationById}
                    />
                  }
                />
                {activeLines.map((operation) => {
                  const colorIndex = operations.findIndex((item) => item.id === operation.id)
                  return (
                    <Line
                      key={operation.id}
                      type="monotone"
                      dataKey={operation.id}
                      stroke={COLORS[Math.max(0, colorIndex) % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 2, fill: "var(--background)" }}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  )
                })}
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{formatNumber(filteredDrivers.length)} motoristas</CardTitle>
              <CardDescription>
                Ranking por ocorrências no último dia disponível{latestDay ? ` (${latestDay})` : ""}.
              </CardDescription>
            </div>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <MapPinnedIcon className="size-3.5" />
              Recorte da sidebar
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredDrivers.length === 0 || !latestDay ? (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Sem motoristas com DS no último dia disponível.
            </div>
          ) : (
            <DriverRanking
              drivers={filteredDrivers}
              operacaoIds={operationIds}
              baseSlugs={selectedBaseSlugs}
              referenceDay={latestDay}
              showHighlights={false}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={baseFilterOpen} onOpenChange={setBaseFilterOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filtros avançados</DialogTitle>
            <DialogDescription>
              Selecione quais bases entram no consolidado da home.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {basesByOperation.map(({ operation, bases: operationBases }) => {
              if (operationBases.length === 0) return null
              const selectedInGroup = operationBases.filter((base) => pendingBaseIds.includes(base.id)).length
              const allSelected = selectedInGroup === operationBases.length
              return (
                <section key={operation.id} className="rounded-lg border">
                  <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => setPendingOperationBases(operation.id, Boolean(checked))}
                      />
                      {operation.label}
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {selectedInGroup}/{operationBases.length} bases
                    </span>
                  </div>
                  <div className="grid gap-1 p-2 sm:grid-cols-2">
                    {operationBases.map((base) => {
                      const checked = pendingBaseIds.includes(base.id)
                      return (
                        <label
                          key={base.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePendingBase(base.id)}
                          />
                          <span className="min-w-0 flex-1 truncate">{base.label}</span>
                          <span className="text-xs text-muted-foreground">{base.slug}</span>
                        </label>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingBaseIds(bases.map((base) => base.id))}
            >
              Selecionar todas
            </Button>
            <Button
              type="button"
              onClick={applyBaseFilter}
              disabled={pendingBaseIds.length === 0}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HomeChartTooltip({
  active,
  payload,
  label,
  metric,
  operations,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: number | null; color?: string }>
  label?: string
  metric: HomeMetric
  operations: Map<string, OpLite>
}) {
  const rows = (payload ?? []).filter((item) => item.value != null)
  if (!active || rows.length === 0) return null

  return (
    <div className="grid min-w-44 gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      <div className="font-medium">{label}</div>
      {rows.map((item) => {
        const operationId = String(item.dataKey)
        return (
          <div key={operationId} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
              {operations.get(operationId)?.label ?? operationId}
            </span>
            <span className="font-mono font-medium tabular-nums">
              {formatMetricValue(Number(item.value), metric)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

"use client"

import { useRef, useState } from "react"
import { LoaderCircleIcon } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  getDriverPerformance,
  type DriverPerf,
  type PerfPoint,
} from "@/app/dashboard/live/driver-actions"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const PERIODS = [7, 14, 30, 60, 90] as const
const METRIC_OPTIONS = [
  { value: "ds_pct", label: "DS", color: "var(--chart-5)" },
  { value: "prejuizo", label: "Prejuízo", color: "var(--chart-4)" },
  { value: "ocorrencias", label: "Ocorrências", color: "var(--chart-3)" },
  { value: "entregues", label: "Entregues", color: "var(--chart-2)" },
] as const
type MetricKey = (typeof METRIC_OPTIONS)[number]["value"]

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export type DriverPerfScope = {
  operacaoId?: string
  operacaoIds?: string[]
  baseSlug?: string
  baseSlugs?: string[]
  referenceDay: string
  /** Texto sob o título do modal; default genérico se omitido. */
  description?: string
}

/**
 * Estado + carregamento do modal de desempenho do motorista. Compartilhado
 * entre ranking do live, tabela de DS e tabela de PNR — só muda o `scope`.
 */
export function useDriverPerformanceDialog(scope: DriverPerfScope) {
  const [driverId, setDriverId] = useState<string | null>(null)
  const [driverName, setDriverName] = useState("")
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(7)
  const [metric, setMetric] = useState<MetricKey>("ds_pct")
  const [perf, setPerf] = useState<DriverPerf | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  function load(id: string, name: string, days: (typeof PERIODS)[number]) {
    const reqId = requestId.current + 1
    requestId.current = reqId
    setDriverId(id)
    setDriverName(name)
    setPeriod(days)
    setOpen(true)
    setLoading(true)
    setError(null)
    setPerf(null)

    getDriverPerformance({
      operacaoId: scope.operacaoId,
      operacaoIds: scope.operacaoIds,
      driverId: id,
      dias: days,
      baseSlug: scope.baseSlug,
      baseSlugs: scope.baseSlugs,
      referenceDay: scope.referenceDay,
    })
      .then((data) => {
        if (requestId.current === reqId) setPerf(data)
      })
      .catch((err: unknown) => {
        if (requestId.current !== reqId) return
        setError(err instanceof Error ? err.message : "Não foi possível carregar o motorista.")
      })
      .finally(() => {
        if (requestId.current === reqId) setLoading(false)
      })
  }

  function openDriver(id: string, name = "") {
    setMetric("ds_pct")
    load(id, name, 7)
  }

  function changePeriod(days: (typeof PERIODS)[number]) {
    if (driverId) load(driverId, driverName, days)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) requestId.current += 1
  }

  const dialogElement = (
    <DriverPerformanceDialog
      title={perf?.name ?? driverName ?? "Motorista"}
      description={scope.description ?? `Desempenho até ${scope.referenceDay} no recorte atual.`}
      open={open}
      onOpenChange={onOpenChange}
      period={period}
      metric={metric}
      onMetricChange={setMetric}
      onPeriodChange={changePeriod}
      perf={perf}
      loading={loading}
      error={error}
    />
  )

  return { openDriver, dialogElement }
}

function DriverPerformanceDialog({
  title,
  description,
  open,
  onOpenChange,
  period,
  metric,
  onMetricChange,
  onPeriodChange,
  perf,
  loading,
  error,
}: {
  title: string
  description: string
  open: boolean
  onOpenChange: (open: boolean) => void
  period: (typeof PERIODS)[number]
  metric: MetricKey
  onMetricChange: (metric: MetricKey) => void
  onPeriodChange: (days: (typeof PERIODS)[number]) => void
  perf: DriverPerf | null
  loading: boolean
  error: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {PERIODS.map((days) => (
              <Button
                key={days}
                type="button"
                size="sm"
                variant={period === days ? "default" : "outline"}
                onClick={() => onPeriodChange(days)}
                aria-pressed={period === days}
              >
                {days} dias
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Métrica</span>
            <Select value={metric} onValueChange={(value) => onMetricChange(value as MetricKey)}>
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {METRIC_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Carregando desempenho...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && perf && (
          <div className="flex flex-col gap-4">
            <DriverPerformanceChart perf={perf} metric={metric} />
            <DriverPerformanceSummary perf={perf} />
            <p className="text-xs text-muted-foreground">
              Prejuízo somado a partir dos tickets PNR importados no período.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DriverPerformanceSummary({ perf }: { perf: DriverPerf }) {
  const items = [
    { label: "Prejuízo PNR", value: brl(perf.total.prejuizo) },
    { label: "DS no período", value: `${perf.total.ds_pct}%` },
    {
      label: "Entregues / saiu",
      value: `${perf.total.entregues.toLocaleString("pt-BR")} / ${perf.total.saiu.toLocaleString("pt-BR")}`,
    },
    { label: "Ocorrências", value: perf.total.ocorrencias.toLocaleString("pt-BR") },
  ]

  return (
    <dl className="rounded-lg border bg-muted/20 p-3 text-sm">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between gap-4 border-b py-2 first:pt-0 last:border-b-0 last:pb-0"
        >
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="font-medium tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const chartConfig = {
  ds_pct: { label: "DS%", color: "var(--chart-5)" },
  prejuizo: { label: "Prejuízo", color: "var(--chart-4)" },
  ocorrencias: { label: "Ocorrências", color: "var(--chart-3)" },
  entregues: { label: "Entregues", color: "var(--chart-2)" },
} satisfies ChartConfig

function DriverPerformanceChart({ perf, metric }: { perf: DriverPerf; metric: MetricKey }) {
  if (perf.points.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Sem registros de DS neste período.
      </p>
    )
  }
  const option = METRIC_OPTIONS.find((item) => item.value === metric) ?? METRIC_OPTIONS[0]
  const isPercent = metric === "ds_pct"

  return (
    <ChartContainer config={chartConfig} className="h-[260px] w-full">
      <AreaChart data={perf.points} margin={{ left: 4, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis
          domain={isPercent ? [0, 100] : [0, "auto"]}
          tickLine={false}
          axisLine={false}
          width={metric === "prejuizo" ? 58 : 42}
          fontSize={11}
          tickFormatter={(v) => formatMetricAxis(Number(v), metric)}
        />
        <ChartTooltip content={<PerformanceTooltip metric={metric} />} />
        <defs>
          <linearGradient id="driver-perf-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={option.color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={option.color} stopOpacity={0.06} />
          </linearGradient>
        </defs>
        <Area
          dataKey={metric}
          type="monotone"
          stroke={option.color}
          fill="url(#driver-perf-fill)"
          fillOpacity={1}
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--background)", strokeWidth: 2 }}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}

function formatMetricAxis(value: number, metric: MetricKey) {
  if (metric === "ds_pct") return `${value}%`
  if (metric === "prejuizo") {
    return value.toLocaleString("pt-BR", {
      maximumFractionDigits: 0,
      notation: value >= 1000 ? "compact" : "standard",
    })
  }
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
}

function formatMetricValue(point: PerfPoint, metric: MetricKey) {
  if (metric === "ds_pct") return `${point.ds_pct}%`
  if (metric === "prejuizo") return brl(point.prejuizo)
  return point[metric].toLocaleString("pt-BR")
}

function PerformanceTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean
  payload?: Array<{ payload?: PerfPoint }>
  metric: MetricKey
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const option = METRIC_OPTIONS.find((item) => item.value === metric) ?? METRIC_OPTIONS[0]

  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      <div className="font-medium">{point.fullDate}</div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{option.label}</span>
        <span className="font-mono font-medium">{formatMetricValue(point, metric)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Prejuízo</span>
        <span className="font-mono font-medium">{brl(point.prejuizo)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Ocorrências</span>
        <span className="font-mono font-medium">{point.ocorrencias}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Entregues</span>
        <span className="font-mono font-medium">
          {point.entregues}/{point.saiu}
        </span>
      </div>
    </div>
  )
}

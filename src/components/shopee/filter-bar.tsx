"use client"

import { useCallback, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarIcon, MapPinIcon, SlidersHorizontalIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  parseShopeeFilters,
  periodLabel,
  SHOPEE_DEFAULT_PERIOD,
  SHOPEE_PERIODS,
  type ShopeeBaseOption,
} from "@/lib/shopee"

const ALL = "__all__"

export function ShopeeFilterBar({
  bases,
  defaultPeriod = SHOPEE_DEFAULT_PERIOD,
  extra,
}: {
  bases: ShopeeBaseOption[]
  defaultPeriod?: string
  /** Controle extra da subtab (ex.: seletor de semana do PNR), ao lado dos filtros. */
  extra?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filters = parseShopeeFilters(Object.fromEntries(searchParams.entries()), defaultPeriod)

  // Aplica um patch nos searchParams (null = remover) e navega.
  const apply = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") params.delete(k)
        else params.set(k, v)
      }
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams],
  )

  const multiActive = filters.bases.length > 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Filtro básico: base única */}
      <div className="flex items-center gap-2">
        <MapPinIcon className="text-muted-foreground size-4" />
        <Select
          value={filters.base || ALL}
          onValueChange={(v) =>
            apply({ base: !v || v === ALL ? null : v, bases: null, semana: null })
          }
        >
          <SelectTrigger size="sm" className="w-[190px]">
            <SelectValue placeholder="Base" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as bases</SelectItem>
            {bases.map((b) => (
              <SelectItem key={b.slug} value={b.slug}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filtro avançado */}
      <AdvancedFilters
        bases={bases}
        currentPeriod={filters.period}
        currentFrom={filters.from}
        currentTo={filters.to}
        currentBases={filters.bases}
        defaultPeriod={defaultPeriod}
        onApply={apply}
      />

      {extra}

      {/* Indicadores de estado */}
      <div className="text-muted-foreground ml-auto flex items-center gap-2 text-xs">
        <Badge variant="outline" className="gap-1 font-normal">
          <CalendarIcon className="size-3" />
          {periodLabel(filters.period, filters.from, filters.to)}
        </Badge>
        {multiActive && (
          <Badge variant="secondary" className="font-normal">
            {filters.bases.length} bases selecionadas
          </Badge>
        )}
      </div>
    </div>
  )
}

type PeriodMode = "hoje" | "ontem" | "semanal" | "tudo" | "ultimosDias" | "dia" | "intervalo"

const FIXED_MODES = new Set<PeriodMode>(["hoje", "ontem", "semanal", "tudo"])

/** Deriva o modo da UI a partir do valor de período persistido na URL. */
function deriveMode(period: string): PeriodMode {
  if (FIXED_MODES.has(period as PeriodMode)) return period as PeriodMode
  if (period === "dia") return "dia"
  if (period === "intervalo") return "intervalo"
  return "ultimosDias" // cobre Nd (ex.: "7d") e qualquer valor desconhecido
}

function diasFromPeriod(period: string): number {
  const m = /^(\d+)d$/.exec(period)
  return m ? Number(m[1]) : 7
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function AdvancedFilters({
  bases,
  currentPeriod,
  currentFrom,
  currentTo,
  currentBases,
  defaultPeriod,
  onApply,
}: {
  bases: ShopeeBaseOption[]
  currentPeriod: string
  currentFrom?: string
  currentTo?: string
  currentBases: string[]
  defaultPeriod: string
  onApply: (patch: Record<string, string | null>) => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PeriodMode>(() => deriveMode(currentPeriod))
  const [dias, setDias] = useState(() => diasFromPeriod(currentPeriod))
  const [diaUnico, setDiaUnico] = useState(currentFrom ?? todayIso())
  const [de, setDe] = useState(currentFrom ?? "")
  const [ate, setAte] = useState(currentTo ?? "")
  const [selected, setSelected] = useState<string[]>(currentBases)

  // Ressincroniza quando o sheet abre (caso a URL tenha mudado por fora).
  function onOpenChange(next: boolean) {
    if (next) {
      setMode(deriveMode(currentPeriod))
      setDias(diasFromPeriod(currentPeriod))
      setDiaUnico(currentFrom ?? todayIso())
      setDe(currentFrom ?? "")
      setAte(currentTo ?? "")
      setSelected(currentBases)
    }
    setOpen(next)
  }

  function toggle(slug: string, checked: boolean) {
    setSelected((prev) =>
      checked ? [...prev, slug] : prev.filter((s) => s !== slug),
    )
  }

  function handleApply() {
    const patch: Record<string, string | null> = {
      bases: selected.length ? selected.join(",") : null,
      from: null,
      to: null,
      semana: null, // muda período/bases → some o foco de semana
    }
    if (selected.length) patch.base = null // multi tem precedência: limpa o filtro básico só quando há multi

    if (mode === "ultimosDias") {
      const n = Math.max(1, Math.round(dias) || 7)
      patch.period = `${n}d` === defaultPeriod ? null : `${n}d`
    } else if (mode === "dia") {
      patch.period = "dia"
      patch.from = diaUnico || null
    } else if (mode === "intervalo") {
      patch.period = "intervalo"
      patch.from = de || null
      patch.to = ate || null
    } else {
      patch.period = mode === defaultPeriod ? null : mode
    }
    onApply(patch)
    setOpen(false)
  }

  function handleClear() {
    setMode(deriveMode(defaultPeriod))
    setDias(7)
    setDiaUnico(todayIso())
    setDe("")
    setAte("")
    setSelected([])
    onApply({ period: null, bases: null, base: null, from: null, to: null, semana: null, tipo: null })
    setOpen(false)
  }

  const activeCount =
    (currentBases.length ? 1 : 0) +
    (currentPeriod !== defaultPeriod ? 1 : 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5" />}
      >
        <SlidersHorizontalIcon className="size-4" />
        Filtros
        {activeCount > 0 && (
          <Badge className="ml-0.5 px-1.5 py-0 text-[10px]">{activeCount}</Badge>
        )}
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Filtros avançados</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <div className="grid gap-2">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Período
            </Label>
            <Select value={mode} onValueChange={(v) => v && setMode(v as PeriodMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHOPEE_PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value="ultimosDias">Últimos N dias</SelectItem>
                <SelectItem value="dia">Dia específico</SelectItem>
                <SelectItem value="intervalo">Dia X até dia Y</SelectItem>
              </SelectContent>
            </Select>

            {mode === "ultimosDias" && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-muted-foreground text-sm">Últimos</span>
                <Input
                  type="number"
                  min={1}
                  value={dias}
                  onChange={(e) => setDias(Number(e.target.value) || 1)}
                  className="w-20"
                />
                <span className="text-muted-foreground text-sm">dias</span>
              </div>
            )}

            {mode === "dia" && (
              <Input
                type="date"
                value={diaUnico}
                max={todayIso()}
                onChange={(e) => setDiaUnico(e.target.value)}
                className="pt-1"
              />
            )}

            {mode === "intervalo" && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="date"
                  value={de}
                  max={ate || todayIso()}
                  onChange={(e) => setDe(e.target.value)}
                />
                <span className="text-muted-foreground text-sm">até</span>
                <Input
                  type="date"
                  value={ate}
                  min={de || undefined}
                  max={todayIso()}
                  onChange={(e) => setAte(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Bases ({selected.length || "todas"})
            </Label>
            <div className="grid gap-2.5">
              {bases.map((b) => (
                <label
                  key={b.slug}
                  className="flex cursor-pointer items-center gap-2.5 text-sm"
                >
                  <Checkbox
                    checked={selected.includes(b.slug)}
                    onCheckedChange={(c) => toggle(b.slug, c === true)}
                  />
                  {b.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 border-t">
          <Button variant="ghost" onClick={handleClear} className="flex-1">
            Limpar
          </Button>
          <SheetClose render={<Button className="flex-1" onClick={handleApply} />}>
            Aplicar
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

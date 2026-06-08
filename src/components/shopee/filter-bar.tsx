"use client"

import { useCallback, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarIcon, MapPinIcon, SlidersHorizontalIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

export function ShopeeFilterBar({ bases }: { bases: ShopeeBaseOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filters = parseShopeeFilters(Object.fromEntries(searchParams.entries()))

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
            apply({ base: !v || v === ALL ? null : v, bases: null })
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
        currentBases={filters.bases}
        onApply={apply}
      />

      {/* Indicadores de estado */}
      <div className="text-muted-foreground ml-auto flex items-center gap-2 text-xs">
        <Badge variant="outline" className="gap-1 font-normal">
          <CalendarIcon className="size-3" />
          {periodLabel(filters.period)}
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

function AdvancedFilters({
  bases,
  currentPeriod,
  currentBases,
  onApply,
}: {
  bases: ShopeeBaseOption[]
  currentPeriod: string
  currentBases: string[]
  onApply: (patch: Record<string, string | null>) => void
}) {
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState(currentPeriod)
  const [selected, setSelected] = useState<string[]>(currentBases)

  // Ressincroniza quando o sheet abre (caso a URL tenha mudado por fora).
  function onOpenChange(next: boolean) {
    if (next) {
      setPeriod(currentPeriod)
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
      period: period === SHOPEE_DEFAULT_PERIOD ? null : period,
      bases: selected.length ? selected.join(",") : null,
    }
    // multi tem precedência: limpa o filtro básico só quando há multi
    if (selected.length) patch.base = null
    onApply(patch)
    setOpen(false)
  }

  function handleClear() {
    setPeriod(SHOPEE_DEFAULT_PERIOD)
    setSelected([])
    onApply({ period: null, bases: null, base: null, from: null, to: null })
    setOpen(false)
  }

  const activeCount =
    (currentBases.length ? 1 : 0) +
    (currentPeriod !== SHOPEE_DEFAULT_PERIOD ? 1 : 0)

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
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v ?? SHOPEE_DEFAULT_PERIOD)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHOPEE_PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

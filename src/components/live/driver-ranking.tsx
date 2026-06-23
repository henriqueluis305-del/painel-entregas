"use client"

import { useDeferredValue, useMemo, useState } from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { useDriverPerformanceDialog } from "@/components/shopee/driver-performance-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { DriverRank } from "@/lib/live-queries"

const PAGE_SIZE = 10

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")

type SortKey = "name" | "saiu" | "entregues" | "ds_pct" | "ocorrencias" | "prejuizo"

type DriverRankingProps = {
  drivers: DriverRank[]
  operacaoId?: string
  operacaoIds?: string[]
  baseSlug?: string
  baseSlugs?: string[]
  referenceDay: string
  showHighlights?: boolean
}

export function DriverRanking({
  drivers,
  operacaoId,
  operacaoIds,
  baseSlug = "",
  baseSlugs = [],
  referenceDay,
  showHighlights = true,
}: DriverRankingProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "ocorrencias",
    dir: "desc",
  })
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [page, setPage] = useState(1)

  const { openDriver, dialogElement } = useDriverPerformanceDialog({
    operacaoId,
    operacaoIds,
    baseSlug,
    baseSlugs,
    referenceDay,
    description: `Desempenho até ${referenceDay} no recorte atual da operação.`,
  })

  const piores = drivers.slice(0, 3)

  const sorted = useMemo(() => {
    const needle = normalize(deferredQuery.trim())
    const arr = drivers.filter((d) => {
      if (!needle) return true
      return normalize(`${d.name} ${d.driver_id}`).includes(needle)
    })

    arr.sort((a, b) => {
      const va = a[sort.key]
      const vb = b[sort.key]
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt-BR")
      return sort.dir === "asc" ? c : -c
    })
    return arr
  }, [drivers, deferredQuery, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstRow = sorted.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const lastRow = Math.min(currentPage * PAGE_SIZE, sorted.length)
  const pageNumbers = useMemo(() => {
    const count = Math.min(5, totalPages)
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - count + 1))
    return Array.from({ length: count }, (_, i) => start + i)
  }, [currentPage, totalPages])

  function toggle(key: SortKey) {
    setPage(1)
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {showHighlights && (
      <div className="grid gap-4 sm:grid-cols-3">
        {piores.map((d, i) => (
          <button
            key={d.driver_id}
            type="button"
            onClick={() => openDriver(d.driver_id, d.name)}
            className="rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card
              className={cn(
                "h-full transition-colors hover:bg-muted/40",
                i === 0 && "border-red-500/40",
              )}
            >
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <TriangleAlertIcon className="size-3.5 text-red-500" />
                  {i + 1}º maior ofensor
                </CardDescription>
                <CardTitle className="truncate text-base">{d.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-bold tabular-nums text-red-500">{d.ocorrencias}</span>{" "}
                  <span className="text-muted-foreground">ocorr.</span>
                </span>
                <span className="text-muted-foreground">DS {d.ds_pct}%</span>
                <span className="font-medium tabular-nums">{brl(d.prejuizo)}</span>
              </CardContent>
            </Card>
          </button>
        ))}
        {piores.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
            Sem motoristas no dia.
          </p>
        )}
      </div>
      )}

      {drivers.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Buscar motorista..."
                className="pl-8"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {sorted.length} motorista(s) · 10 por página
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <Th label="Motorista" k="name" sort={sort} onSort={toggle} />
                  <Th label="Saiu" k="saiu" sort={sort} onSort={toggle} align />
                  <Th label="Entregues" k="entregues" sort={sort} onSort={toggle} align />
                  <Th label="DS%" k="ds_pct" sort={sort} onSort={toggle} align />
                  <Th label="Ocorrências" k="ocorrencias" sort={sort} onSort={toggle} align />
                  <Th label="Prejuízo" k="prejuizo" sort={sort} onSort={toggle} align />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((d) => (
                  <TableRow
                    key={d.driver_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDriver(d.driver_id, d.name)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        openDriver(d.driver_id, d.name)
                      }
                    }}
                    className="cursor-pointer outline-none focus-visible:bg-muted/60"
                  >
                    <TableCell className="max-w-[240px] truncate font-medium">{d.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.saiu}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-500">
                      {d.entregues}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.ds_pct}%</TableCell>
                    <TableCell className="text-right tabular-nums text-red-500">
                      {d.ocorrencias}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brl(d.prejuizo)}</TableCell>
                  </TableRow>
                ))}
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Nenhum motorista encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              Mostrando {firstRow}-{lastRow} de {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Página anterior"
              >
                <ChevronLeftIcon />
              </Button>
              {pageNumbers.map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={n === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(n)}
                  aria-current={n === currentPage ? "page" : undefined}
                >
                  {n}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Próxima página"
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Prejuízo somado a partir dos tickets PNR importados para o recorte atual.
      </p>

      {dialogElement}
    </div>
  )
}

function Th({
  label,
  k,
  sort,
  onSort,
  align,
}: {
  label: string
  k: SortKey
  sort: { key: SortKey; dir: "asc" | "desc" }
  onSort: (k: SortKey) => void
  align?: boolean
}) {
  const active = sort.key === k
  return (
    <TableHead className={align ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", align && "flex-row-reverse")}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />
        ) : (
          <ChevronsUpDownIcon className="size-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

"use client"

import { useMemo, useState } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  SearchIcon,
} from "lucide-react"

import { useDriverPerformanceDialog } from "@/components/shopee/driver-performance-dialog"
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
import type { DsRow } from "@/lib/shopee/ds-queries"

const PAGE_SIZE = 25

function dsPct(entregues: number, saiu: number) {
  return saiu > 0 ? Math.round((entregues / saiu) * 100) : 0
}

type SortKey = "driver_name" | "saiu" | "entregues" | "em_rota" | "ocorrencias" | "ds"
type Sort = { key: SortKey; dir: "asc" | "desc" }

function val(r: DsRow, key: SortKey): string | number {
  switch (key) {
    case "driver_name":
      return r.driver_name
    case "ds":
      return dsPct(r.entregues, r.saiu)
    default:
      return r[key]
  }
}

export function DsTable({
  rows,
  operacaoId,
  baseSlugs = [],
  referenceDay,
}: {
  rows: DsRow[]
  operacaoId: string
  baseSlugs?: string[]
  referenceDay: string
}) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<Sort>({ key: "entregues", dir: "desc" })

  const { openDriver, dialogElement } = useDriverPerformanceDialog({
    operacaoId,
    baseSlugs,
    referenceDay,
    description: `Desempenho até ${referenceDay} no recorte atual de DS.`,
  })

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }))
    setPage(0)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = !q
      ? [...rows]
      : rows.filter(
          (r) => r.driver_name.toLowerCase().includes(q) || (r.driver_id ?? "").includes(q),
        )
    base.sort((a, b) => {
      const va = val(a, sort.key)
      const vb = val(b, sort.key)
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt-BR")
      return sort.dir === "asc" ? c : -c
    })
    return base
  }, [rows, query, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative sm:max-w-xs">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          placeholder="Buscar motorista…"
          className="pl-8"
        />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortTh label="Motorista" k="driver_name" sort={sort} onSort={toggleSort} />
              <SortTh label="Saiu" k="saiu" sort={sort} onSort={toggleSort} align="right" />
              <SortTh label="Entregues" k="entregues" sort={sort} onSort={toggleSort} align="right" />
              <SortTh label="Em rota" k="em_rota" sort={sort} onSort={toggleSort} align="right" />
              <SortTh label="Ocorrências" k="ocorrencias" sort={sort} onSort={toggleSort} align="right" />
              <SortTh label="DS%" k="ds" sort={sort} onSort={toggleSort} align="right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  Nenhum motorista encontrado.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => (
                <TableRow
                  key={`${r.base_slug}-${r.driver_id}`}
                  role={r.driver_id ? "button" : undefined}
                  tabIndex={r.driver_id ? 0 : undefined}
                  onClick={() => r.driver_id && openDriver(r.driver_id, r.driver_name)}
                  onKeyDown={(event) => {
                    if (!r.driver_id) return
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openDriver(r.driver_id, r.driver_name)
                    }
                  }}
                  className={cn(r.driver_id && "cursor-pointer outline-none focus-visible:bg-muted/60")}
                >
                  <TableCell className="max-w-[260px] truncate">
                    <span className="text-muted-foreground">[{r.driver_id}]</span> {r.driver_name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.saiu}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-500">{r.entregues}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.em_rota}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-500">{r.ocorrencias}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{dsPct(r.entregues, r.saiu)}%</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm">{filtered.length} motorista(s)</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Página {safePage + 1} de {pageCount}</span>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>

      {dialogElement}
    </div>
  )
}

function SortTh({
  label,
  k,
  sort,
  onSort,
  align,
}: {
  label: string
  k: SortKey
  sort: Sort
  onSort: (k: SortKey) => void
  align?: "right"
}) {
  const active = sort.key === k
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1 transition-colors",
          align === "right" && "flex-row-reverse",
        )}
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

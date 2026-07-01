"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ClipboardCopyIcon,
  ListFilterIcon,
  SearchIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { diasToRange, isPackageDelivered, STUCK_RANGES } from "@/lib/shopee/stuck"
import type { StuckRow } from "@/lib/shopee/stuck"

const PAGE_SIZE = 50

const isDelivered = isPackageDelivered

type SortKey = "codigo" | "status" | "dias_preso" | "range" | "driver_name" | "cidade" | "base_label"
type Sort = { key: SortKey; dir: "asc" | "desc" }
type FilterKey = "status" | "dias_preso" | "range" | "driver_name" | "cidade" | "base_label"

function rowSortVal(r: StuckRow, key: SortKey): string | number {
  switch (key) {
    case "dias_preso": return r.dias_preso ?? -1
    case "range": {
      const rg = diasToRange(r.dias_preso)
      return rg ? STUCK_RANGES.indexOf(rg) : -1
    }
    case "driver_name": return r.driver_name ?? ""
    case "cidade": return r.cidade ?? ""
    default: return (r as Record<string, unknown>)[key] as string ?? ""
  }
}

function rowFilterVal(r: StuckRow, key: FilterKey): string {
  switch (key) {
    case "dias_preso": return r.dias_preso == null ? "—" : String(Math.floor(r.dias_preso))
    case "range": return diasToRange(r.dias_preso) ?? "—"
    case "driver_name": return r.driver_name ?? "—"
    case "cidade": return r.cidade ?? "—"
    default: return (r as Record<string, unknown>)[key] as string ?? "—"
  }
}

export function StuckTable({ rows }: { rows: StuckRow[] }) {
  const [query, setQuery] = useState("")
  const [hideDelivered, setHideDelivered] = useState(true)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<Sort>({ key: "dias_preso", dir: "desc" })
  const [colFilters, setColFilters] = useState<Partial<Record<FilterKey, Set<string>>>>({})

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }))
    setPage(0)
  }

  // Valores distintos de cada coluna filtrávelçomputed from the full rows prop
  // (sem aplicar os outros filtros de coluna), para sempre mostrar todas as opções.
  const colOptions = useMemo(() => {
    const keys: FilterKey[] = ["status", "dias_preso", "range", "driver_name", "cidade", "base_label"]
    const result: Partial<Record<FilterKey, string[]>> = {}
    for (const key of keys) {
      const seen = new Set<string>()
      for (const r of rows) {
        if (hideDelivered && isDelivered(r)) continue
        seen.add(rowFilterVal(r, key))
      }
      // Ordenação natural para cada coluna
      let sorted: string[]
      if (key === "range") {
        sorted = STUCK_RANGES.filter((rg) => seen.has(rg))
        if (seen.has("—")) sorted.push("—")
      } else if (key === "dias_preso") {
        sorted = [...seen].sort((a, b) => {
          const na = a === "—" ? -1 : Number(a)
          const nb = b === "—" ? -1 : Number(b)
          return nb - na
        })
      } else {
        sorted = [...seen].sort((a, b) => a.localeCompare(b, "pt-BR"))
      }
      result[key] = sorted
    }
    return result
  }, [rows, hideDelivered])

  function toggleOption(key: FilterKey, value: string) {
    setColFilters((prev) => {
      const cur = new Set(prev[key] ?? [])
      if (cur.has(value)) cur.delete(value)
      else cur.add(value)
      return { ...prev, [key]: cur.size ? cur : undefined }
    })
    setPage(0)
  }

  function clearFilter(key: FilterKey) {
    setColFilters((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setPage(0)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = rows.filter((r) => {
      if (hideDelivered && isDelivered(r)) return false
      if (q && !r.codigo.toLowerCase().includes(q)) return false
      for (const [key, sel] of Object.entries(colFilters) as [FilterKey, Set<string>][]) {
        if (!sel?.size) continue
        if (!sel.has(rowFilterVal(r, key))) return false
      }
      return true
    })
    base.sort((a, b) => {
      const va = rowSortVal(a, sort.key)
      const vb = rowSortVal(b, sort.key)
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt-BR")
      return sort.dir === "asc" ? c : -c
    })
    return base
  }, [rows, query, hideDelivered, sort, colFilters])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const stuckIds = useMemo(
    () => rows.filter((r) => !isDelivered(r)).map((r) => r.codigo),
    [rows],
  )

  async function copyIds() {
    try {
      await navigator.clipboard.writeText(stuckIds.join("\n"))
      toast.success(`${stuckIds.length} IDs copiados`, { description: "Cole com Ctrl+V onde quiser." })
    } catch {
      toast.error("Não foi possível copiar", { description: "Permita o acesso ao clipboard." })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0) }}
            placeholder="Buscar por Order ID…"
            className="pl-8"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={hideDelivered} onCheckedChange={(c) => { setHideDelivered(c === true); setPage(0) }} />
          Esconder entregues
        </label>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={copyIds} disabled={!stuckIds.length}>
          <ClipboardCopyIcon className="size-4" />
          Copiar IDs ({stuckIds.length})
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Order ID — sem filtro de coluna, só ordena */}
              <SortOnlyTh label="Order ID" k="codigo" sort={sort} onSort={toggleSort} />
              <FilterTh
                label="Status" k="status" sort={sort} onSort={toggleSort}
                options={colOptions.status ?? []} selected={colFilters.status}
                onToggle={(v) => toggleOption("status", v)} onClear={() => clearFilter("status")}
              />
              <FilterTh
                label="Dias parados" k="dias_preso" sort={sort} onSort={toggleSort} align="right"
                options={colOptions.dias_preso ?? []} selected={colFilters.dias_preso}
                onToggle={(v) => toggleOption("dias_preso", v)} onClear={() => clearFilter("dias_preso")}
              />
              <FilterTh
                label="Range" k="range" sort={sort} onSort={toggleSort} align="right"
                options={colOptions.range ?? []} selected={colFilters.range}
                onToggle={(v) => toggleOption("range", v)} onClear={() => clearFilter("range")}
              />
              <FilterTh
                label="Motorista" k="driver_name" sort={sort} onSort={toggleSort}
                options={colOptions.driver_name ?? []} selected={colFilters.driver_name}
                onToggle={(v) => toggleOption("driver_name", v)} onClear={() => clearFilter("driver_name")}
              />
              <FilterTh
                label="Cidade" k="cidade" sort={sort} onSort={toggleSort}
                options={colOptions.cidade ?? []} selected={colFilters.cidade}
                onToggle={(v) => toggleOption("cidade", v)} onClear={() => clearFilter("cidade")}
              />
              <FilterTh
                label="Base" k="base_label" sort={sort} onSort={toggleSort}
                options={colOptions.base_label ?? []} selected={colFilters.base_label}
                onToggle={(v) => toggleOption("base_label", v)} onClear={() => clearFilter("base_label")}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                  Nenhum pacote encontrado.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => (
                <TableRow key={`${r.base_slug}-${r.codigo}`}>
                  <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                  <TableCell>
                    <Badge variant={isDelivered(r) ? "secondary" : "outline"} className="font-normal">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.dias_preso == null ? "—" : Math.floor(r.dias_preso)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {diasToRange(r.dias_preso) ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">{r.driver_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.cidade ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.base_label}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm">{filtered.length} pacote(s)</span>
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
    </div>
  )
}

// Cabeçalho só com ordenação (Order ID).
function SortOnlyTh({ label, k, sort, onSort }: { label: string; k: SortKey; sort: Sort; onSort: (k: SortKey) => void }) {
  const active = sort.key === k
  return (
    <TableHead>
      <button type="button" onClick={() => onSort(k)} className="hover:text-foreground inline-flex items-center gap-1 transition-colors">
        {label}
        {active
          ? sort.dir === "asc" ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />
          : <ChevronsUpDownIcon className="size-3 opacity-40" />}
      </button>
    </TableHead>
  )
}

// Cabeçalho com ordenação + filtro de coluna.
function FilterTh({
  label, k, sort, onSort, align, options, selected, onToggle, onClear,
}: {
  label: string
  k: SortKey
  sort: Sort
  onSort: (k: SortKey) => void
  align?: "right"
  options: string[]
  selected: Set<string> | undefined
  onToggle: (v: string) => void
  onClear: () => void
}) {
  const active = sort.key === k
  const hasFilter = !!selected?.size

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <div className={cn("inline-flex items-center gap-0.5", align === "right" && "flex-row-reverse")}>
        <button
          type="button"
          onClick={() => onSort(k)}
          className={cn("hover:text-foreground inline-flex items-center gap-1 transition-colors")}
        >
          {label}
          {active
            ? sort.dir === "asc" ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />
            : <ChevronsUpDownIcon className="size-3 opacity-40" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "ml-1 rounded p-0.5 transition-colors hover:bg-accent",
              hasFilter ? "text-primary" : "text-muted-foreground",
            )}
          >
            <ListFilterIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto min-w-[10rem] max-w-[18rem] [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            {hasFilter && (
              <DropdownMenuItem onClick={onClear} className="text-muted-foreground text-xs">
                Limpar filtro
              </DropdownMenuItem>
            )}
            {options.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt}
                checked={selected?.has(opt) ?? false}
                onCheckedChange={() => onToggle(opt)}
                closeOnClick={false}
                className="pr-2 pl-7 [&>[data-slot=dropdown-menu-checkbox-item-indicator]]:left-1.5 [&>[data-slot=dropdown-menu-checkbox-item-indicator]]:right-auto"
              >
                <span className="truncate">{opt}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableHead>
  )
}

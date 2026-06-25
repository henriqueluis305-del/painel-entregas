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
  SearchIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { DELIVERED_STATUS } from "@/lib/shopee/stuck"
import type { StuckRow } from "@/lib/shopee/stuck"

const PAGE_SIZE = 50

function isDelivered(r: StuckRow) {
  return r.delivered_at != null || r.status === DELIVERED_STATUS
}

type SortKey = "codigo" | "status" | "dias_preso" | "driver_name" | "base_label" | "agency"
type Sort = { key: SortKey; dir: "asc" | "desc" }

function val(r: StuckRow, key: SortKey): string | number {
  switch (key) {
    case "dias_preso":
      return r.dias_preso ?? -1
    case "driver_name":
      return r.driver_name ?? ""
    case "agency":
      return r.agency ?? ""
    default:
      return r[key] ?? ""
  }
}

export function StuckTable({ rows }: { rows: StuckRow[] }) {
  const [query, setQuery] = useState("")
  const [hideDelivered, setHideDelivered] = useState(true)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<Sort>({ key: "dias_preso", dir: "desc" })

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }))
    setPage(0)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = rows.filter((r) => {
      if (hideDelivered && isDelivered(r)) return false
      if (!q) return true
      return (
        r.codigo.toLowerCase().includes(q) ||
        (r.driver_name ?? "").toLowerCase().includes(q) ||
        (r.driver_id ?? "").toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        r.base_label.toLowerCase().includes(q) ||
        (r.agency ?? "").toLowerCase().includes(q)
      )
    })
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
  }, [rows, query, hideDelivered, sort])

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
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar código, motorista, status…"
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
              <SortTh label="Código" k="codigo" sort={sort} onSort={toggleSort} />
              <SortTh label="Status" k="status" sort={sort} onSort={toggleSort} />
              <SortTh label="Dias" k="dias_preso" sort={sort} onSort={toggleSort} align="right" />
              <SortTh label="Motorista" k="driver_name" sort={sort} onSort={toggleSort} />
              <SortTh label="Base" k="base_label" sort={sort} onSort={toggleSort} />
              <SortTh label="Agency" k="agency" sort={sort} onSort={toggleSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
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
                  <TableCell className="max-w-[220px] truncate">
                    {r.driver_name ? (
                      <span>
                        <span className="text-muted-foreground">[{r.driver_id}]</span> {r.driver_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.base_label}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.agency ?? "—"}</TableCell>
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

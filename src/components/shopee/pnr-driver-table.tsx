"use client"

import { useMemo, useState } from "react"
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, SearchIcon } from "lucide-react"

import { useDriverPerformanceDialog } from "@/components/shopee/driver-performance-dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { type PnrDriverRow } from "@/lib/shopee/pnr-queries"

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

type SortKey = keyof Omit<PnrDriverRow, "driverId" | "driverName"> | "driverName"
type SortDir = "asc" | "desc"

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "driverName", label: "Motorista", numeric: false },
  { key: "count", label: "PNRs", numeric: true },
  { key: "valor", label: "Valor", numeric: true },
  { key: "faturadas", label: "Para faturamento", numeric: true },
  { key: "revertidas", label: "Revertidas", numeric: true },
]

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDownIcon className="ml-1 inline size-3 opacity-40" />
  return dir === "asc"
    ? <ArrowUpIcon className="ml-1 inline size-3" />
    : <ArrowDownIcon className="ml-1 inline size-3" />
}

export function PnrDriverTable({
  rows,
  operacaoId,
  baseSlugs = [],
  referenceDay,
}: {
  rows: PnrDriverRow[]
  operacaoId?: string
  baseSlugs?: string[]
  referenceDay: string
}) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("valor")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const { openDriver, dialogElement } = useDriverPerformanceDialog({
    operacaoId,
    baseSlugs,
    referenceDay,
    description: `Desempenho até ${referenceDay} no recorte atual de PNR.`,
  })

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q
      ? rows.filter((r) => r.driverName.toLowerCase().includes(q))
      : rows
  }, [rows, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv, "pt-BR")
          : (av as number) - (bv as number)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-xs">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder="Buscar motorista…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className={`cursor-pointer select-none ${col.numeric ? "text-right" : ""}`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon col={col.key} sortKey={sortKey} dir={sortDir} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                  Nenhum motorista encontrado.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((d, i) => (
                <TableRow
                  key={`${d.driverId ?? d.driverName}-${i}`}
                  role={d.driverId ? "button" : undefined}
                  tabIndex={d.driverId ? 0 : undefined}
                  onClick={() => d.driverId && openDriver(d.driverId, d.driverName)}
                  onKeyDown={(event) => {
                    if (!d.driverId) return
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openDriver(d.driverId, d.driverName)
                    }
                  }}
                  className={cn(d.driverId && "cursor-pointer outline-none focus-visible:bg-muted/60")}
                >
                  <TableCell className="font-medium">{d.driverName}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.count.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(d.valor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.faturadas.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.revertidas.toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-xs">
        {sorted.length} de {rows.length} motoristas
        {rows.length >= 200 ? " (top 200 por valor)" : ""}
        {" · clique no motorista para ver o desempenho"}
      </p>

      {dialogElement}
    </div>
  )
}

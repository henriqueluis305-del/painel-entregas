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
import { type PnrDrill } from "@/lib/shopee/pnr-drill"
import { type PnrDriverRow } from "@/lib/shopee/pnr-queries"

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

type SortKey = keyof Omit<PnrDriverRow, "driverId" | "driverName"> | "driverName"
type SortDir = "asc" | "desc"

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "driverName", label: "Motorista", numeric: false },
  { key: "baseLabel", label: "Base", numeric: false },
  { key: "count", label: "PNR", numeric: true },
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

/** Drill com identidade do motorista (id quando há; senão casa por nome).
 *  `focusWeek` amarra o drill à semana em foco, casando com a listagem exibida. */
function driverDrill(d: PnrDriverRow, focusWeek: string | null, extra: Partial<PnrDrill>): PnrDrill {
  return {
    label: `Motorista: ${d.driverName}`,
    driverId: d.driverId,
    driverName: d.driverName,
    ...(focusWeek ? { weekStart: focusWeek } : {}),
    ...extra,
  }
}

/** Valor clicável → drill; sem onDrill vira texto simples. Para o clique na
 *  linha (que abre o diálogo de desempenho), usa stopPropagation. */
function DrillCell({ text, drill, onDrill }: { text: string; drill: PnrDrill; onDrill?: (d: PnrDrill) => void }) {
  if (!onDrill) return <span>{text}</span>
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onDrill(drill) }}
      className="hover:text-primary cursor-pointer hover:underline"
    >
      {text}
    </button>
  )
}

export function PnrDriverTable({
  rows,
  operacaoId,
  baseSlugs = [],
  referenceDay,
  focusWeek = null,
  onDrill,
}: {
  rows: PnrDriverRow[]
  operacaoId?: string
  baseSlugs?: string[]
  referenceDay: string
  /** Semana em foco ("YYYY-MM-DD") — amarra os drills à semana exibida. */
  focusWeek?: string | null
  /** Clique num valor → abre a visão "Pacotes" filtrada por aquele motorista. */
  onDrill?: (drill: PnrDrill) => void
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
      const av = a[sortKey] ?? ""
      const bv = b[sortKey] ?? ""
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
            <TableRow className="bg-muted/50">
              {COLUMNS.map((col, i) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "cursor-pointer select-none font-semibold",
                    i > 0 && "border-l text-center",
                  )}
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
                <TableCell colSpan={COLUMNS.length} className="text-muted-foreground py-8 text-center text-sm">
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
                  <TableCell className="border-l text-center">
                    {d.baseLabel ?? <span className="text-muted-foreground italic">Sem base</span>}
                  </TableCell>
                  <TableCell className="border-l text-center tabular-nums">
                    <DrillCell text={d.count.toLocaleString("pt-BR")} onDrill={onDrill} drill={driverDrill(d, focusWeek, {})} />
                  </TableCell>
                  <TableCell className="border-l text-center tabular-nums">
                    <DrillCell text={brl(d.valor)} onDrill={onDrill} drill={driverDrill(d, focusWeek, { bucket: "forbilling", label: `Motorista: ${d.driverName} · Para faturamento` })} />
                  </TableCell>
                  <TableCell className="border-l text-center tabular-nums">
                    <DrillCell text={d.faturadas.toLocaleString("pt-BR")} onDrill={onDrill} drill={driverDrill(d, focusWeek, { bucket: "forbilling", label: `Motorista: ${d.driverName} · Para faturamento` })} />
                  </TableCell>
                  <TableCell className="border-l text-center tabular-nums">
                    <DrillCell text={d.revertidas.toLocaleString("pt-BR")} onDrill={onDrill} drill={driverDrill(d, focusWeek, { bucket: "reversed", label: `Motorista: ${d.driverName} · Revertidas` })} />
                  </TableCell>
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

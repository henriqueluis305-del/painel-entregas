"use client"

import { useMemo, useState } from "react"
import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { diasToRange, isPackageDelivered, STUCK_RANGES, stuckDimValue } from "@/lib/shopee/stuck"
import type { StuckDim, StuckRange, StuckRow } from "@/lib/shopee/stuck"
import type { StuckDrill } from "@/components/shopee/stuck-view-tabs"

const RANGES = STUCK_RANGES
type Range = StuckRange

// Coluna ordenável: nome da linha, uma das faixas, ou o total geral.
type SortCol = "name" | Range | "total"
type Sort = { col: SortCol; dir: "asc" | "desc" }

/** Cabeçalho clicável que ordena por aquela coluna (asc/desc, com indicador). */
function SortHeader({
  label,
  active,
  dir,
  onClick,
  center,
}: {
  label: string
  active: boolean
  dir: Sort["dir"]
  onClick: () => void
  center?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("hover:text-foreground inline-flex items-center gap-1 transition-colors", center && "mx-auto")}
    >
      {/* Espaçador-espelho do ícone: mantém o rótulo centralizado sobre os números. */}
      {center && <span aria-hidden className="size-3 shrink-0" />}
      {label}
      {active ? (
        dir === "asc" ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />
      ) : (
        <ChevronsUpDownIcon className="size-3 opacity-40" />
      )}
    </button>
  )
}

/** Número do pivô; clicável (drill-down) só quando há onClick. Vazio se count = 0. */
function CountButton({
  count,
  onClick,
  className,
}: {
  count: number
  onClick?: () => void
  className?: string
}) {
  if (!count) return <span className="text-muted-foreground">&nbsp;</span>
  if (!onClick) return <span className={cn("tabular-nums", className)}>{count}</span>
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("hover:text-primary hover:underline cursor-pointer tabular-nums", className)}
    >
      {count}
    </button>
  )
}

export function StuckRangeTable({
  rows,
  dimension,
  rowKeyLabel,
  onCellClick,
  onRowClick,
}: {
  rows: StuckRow[]
  dimension: StuckDim
  rowKeyLabel: string
  onCellClick?: (drill: StuckDrill) => void
  /** Clique no nome da linha (ex.: cidade/bairro → re-tabula por status). */
  onRowClick?: (key: string) => void
}) {
  const { bases, pivot, totals, grandTotal } = useMemo(() => {
    const pivot = new Map<string, Partial<Record<Range, number>>>()
    const totals: Partial<Record<Range, number>> = {}
    let grandTotal = 0

    for (const r of rows) {
      if (isPackageDelivered(r)) continue
      const range = diasToRange(r.dias_preso)
      if (!range) continue
      const key = stuckDimValue(r, dimension)
      const map = pivot.get(key) ?? {}
      map[range] = (map[range] ?? 0) + 1
      pivot.set(key, map)
      totals[range] = (totals[range] ?? 0) + 1
      grandTotal++
    }

    const bases = [...pivot.keys()]
    return { bases, pivot, totals, grandTotal }
  }, [rows, dimension])

  // Ordenação das linhas: padrão alfabético; clicar numa faixa/total ordena por contagem.
  const [sort, setSort] = useState<Sort>({ col: "name", dir: "asc" })

  function toggleSort(col: SortCol) {
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "name" ? "asc" : "desc" },
    )
  }

  const sortedBases = useMemo(() => {
    const totalOf = (b: string) => RANGES.reduce((s, r) => s + (pivot.get(b)?.[r] ?? 0), 0)
    const valOf = (b: string) => (sort.col === "total" ? totalOf(b) : pivot.get(b)?.[sort.col as Range] ?? 0)
    return [...bases].sort((a, b) => {
      if (sort.col === "name") {
        const c = a.localeCompare(b, "pt-BR")
        return sort.dir === "asc" ? c : -c
      }
      const diff = valOf(a) - valOf(b)
      const c = sort.dir === "asc" ? diff : -diff
      return c !== 0 ? c : a.localeCompare(b, "pt-BR") // desempate sempre A→Z
    })
  }, [bases, pivot, sort])

  // Sem onCellClick (ex.: modo comparação) → células estáticas, sem drill.
  const drill = onCellClick ? (d: StuckDrill) => () => onCellClick(d) : () => undefined

  if (bases.length === 0) {
    return (
      <div className="text-muted-foreground flex h-24 items-center justify-center text-sm">
        Nenhum pacote stuck ativo.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="italic font-semibold">
              <SortHeader label={rowKeyLabel} active={sort.col === "name"} dir={sort.dir} onClick={() => toggleSort("name")} />
            </TableHead>
            {RANGES.map((r) => (
              <TableHead key={r} className="border-l text-center font-semibold">
                <SortHeader label={r} active={sort.col === r} dir={sort.dir} onClick={() => toggleSort(r)} center />
              </TableHead>
            ))}
            <TableHead className="border-l text-center font-semibold">
              <SortHeader label="Total geral" active={sort.col === "total"} dir={sort.dir} onClick={() => toggleSort("total")} center />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedBases.map((base) => {
            const map = pivot.get(base) ?? {}
            const rowTotal = RANGES.reduce((s, r) => s + (map[r] ?? 0), 0)
            return (
              <TableRow key={base}>
                <TableCell className="text-xs">
                  {onRowClick ? (
                    <button
                      type="button"
                      onClick={() => onRowClick(base)}
                      className="hover:text-primary cursor-pointer text-left hover:underline"
                    >
                      {base}
                    </button>
                  ) : (
                    base
                  )}
                </TableCell>
                {RANGES.map((r) => (
                  <TableCell key={r} className="border-l text-center text-sm">
                    <CountButton count={map[r] ?? 0} onClick={drill({ mode: dimension, key: base, range: r })} className="mx-auto block" />
                  </TableCell>
                ))}
                <TableCell className="border-l text-center text-sm font-medium">
                  <CountButton count={rowTotal} onClick={drill({ mode: dimension, key: base, range: null })} className="mx-auto block" />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableHeader>
          <TableRow className="bg-muted/50 border-t-2">
            <TableHead className="font-bold text-foreground">Total geral</TableHead>
            {RANGES.map((r) => (
              <TableHead key={r} className="border-l text-center font-bold text-foreground">
                <CountButton count={totals[r] ?? 0} onClick={drill({ mode: dimension, key: null, range: r })} className="mx-auto block" />
              </TableHead>
            ))}
            <TableHead className="border-l text-center font-bold text-foreground">
              <CountButton count={grandTotal} onClick={drill({ mode: dimension, key: null, range: null })} className="mx-auto block" />
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    </div>
  )
}

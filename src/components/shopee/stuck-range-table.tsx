"use client"

import { useMemo } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { isPackageDelivered } from "@/lib/shopee/stuck"
import type { StuckRow } from "@/lib/shopee/stuck"

const RANGES = ["1", "2-4", "5-7", "8-14", ">=15"] as const
type Range = (typeof RANGES)[number]

function diasToRange(dias: number | null): Range | null {
  if (dias == null) return null
  const d = Math.floor(dias)
  if (d < 1) return null
  if (d < 2) return "1"
  if (d < 5) return "2-4"
  if (d < 8) return "5-7"
  if (d < 15) return "8-14"
  return ">=15"
}

export function StuckRangeTable({ rows }: { rows: StuckRow[] }) {
  const { bases, pivot, totals, grandTotal } = useMemo(() => {
    const pivot = new Map<string, Partial<Record<Range, number>>>()
    const totals: Partial<Record<Range, number>> = {}
    let grandTotal = 0

    for (const r of rows) {
      if (isPackageDelivered(r)) continue
      const range = diasToRange(r.dias_preso)
      if (!range) continue
      const map = pivot.get(r.base_label) ?? {}
      map[range] = (map[range] ?? 0) + 1
      pivot.set(r.base_label, map)
      totals[range] = (totals[range] ?? 0) + 1
      grandTotal++
    }

    const bases = [...pivot.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"))
    return { bases, pivot, totals, grandTotal }
  }, [rows])

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
            <TableHead className="italic font-semibold">BASE</TableHead>
            {RANGES.map((r) => (
              <TableHead key={r} className="text-right font-semibold">
                {r}
              </TableHead>
            ))}
            <TableHead className="text-right font-semibold">Total geral</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bases.map((base) => {
            const map = pivot.get(base) ?? {}
            const rowTotal = RANGES.reduce((s, r) => s + (map[r] ?? 0), 0)
            return (
              <TableRow key={base}>
                <TableCell className="text-xs">{base}</TableCell>
                {RANGES.map((r) => (
                  <TableCell key={r} className="text-right tabular-nums text-sm">
                    {map[r] ?? ""}
                  </TableCell>
                ))}
                <TableCell className="text-right tabular-nums text-sm font-medium">
                  {rowTotal}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableHeader>
          <TableRow className="bg-muted/50 border-t-2">
            <TableHead className="font-bold text-foreground">Total geral</TableHead>
            {RANGES.map((r) => (
              <TableHead key={r} className="text-right font-bold text-foreground tabular-nums">
                {totals[r] ?? ""}
              </TableHead>
            ))}
            <TableHead className="text-right font-bold text-foreground tabular-nums">
              {grandTotal}
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    </div>
  )
}

"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type ResultadosPivotDay = {
  iso: string
  /** "DD/MM/AAAA" — chave usada em `values` e nas queries (data_pt_br). */
  day: string
  /** Rótulo curto do cabeçalho, ex. "Seg 05/01". */
  label: string
}

export type ResultadosPivotBase = { slug: string; label: string }

/**
 * Pivô Base (linha) × Data (coluna), célula = só a porcentagem. Mesmo molde
 * visual do `PnrWeeklyTables` (coluna "Base" sticky, uma coluna por período).
 */
export function ResultadosPivotTable({
  title,
  description,
  days,
  bases,
  values,
  selected,
  onCellClick,
}: {
  title: string
  description: string
  days: ResultadosPivotDay[]
  bases: ResultadosPivotBase[]
  /** chave `${baseSlug}|${day}` → pct; ausente = sem registro naquele dia. */
  values: Map<string, number>
  selected?: { baseSlug: string; day: string } | null
  onCellClick: (baseSlug: string, baseLabel: string, day: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="bg-muted sticky left-0 min-w-[140px] border-r font-semibold">
                  Base
                </TableHead>
                {days.map((d) => (
                  <TableHead
                    key={d.iso}
                    className="min-w-[84px] border-l text-center font-semibold"
                  >
                    {d.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={days.length + 1} className="text-muted-foreground h-24 text-center">
                    Nenhuma base no filtro atual.
                  </TableCell>
                </TableRow>
              ) : (
                bases.map((b) => (
                  <TableRow key={b.slug}>
                    <TableCell className="bg-card sticky left-0 border-r font-medium">
                      {b.label}
                    </TableCell>
                    {days.map((d) => {
                      const v = values.get(`${b.slug}|${d.day}`)
                      const isSelected = selected?.baseSlug === b.slug && selected?.day === d.day
                      return (
                        <TableCell
                          key={d.iso}
                          className={cn("border-l text-center tabular-nums", isSelected && "bg-primary/10")}
                        >
                          {v == null ? (
                            <span className="text-muted-foreground/40">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onCellClick(b.slug, b.label, d.day)}
                              className="hover:text-primary cursor-pointer font-medium hover:underline"
                            >
                              {v}%
                            </button>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

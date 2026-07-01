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
import { type PnrDrill } from "@/lib/shopee/pnr-drill"
import { type PnrWeeklyData, type PnrWeeklyEntry } from "@/lib/shopee/pnr-queries"
import { weekLabel, weekRange } from "@/lib/shopee/pnr-week"
import { type ReactNode } from "react"

type Field = "total" | "revertidas" | "faturadas"

const TABLES: { field: Field; title: string; description: string; bucket?: PnrDrill["bucket"] }[] = [
  { field: "total", title: "Geradas", description: "PNRs criadas por semana e base" },
  { field: "revertidas", title: "Revertidas", description: "PNRs com status Reversed por semana e base", bucket: "reversed" },
  { field: "faturadas", title: "Para faturamento", description: "PNRs com status ForBilling por semana e base", bucket: "forbilling" },
]

/** Número clicável → drill (some o clique quando não há onClick ou valor = 0). */
function WeekNum({ value, onClick }: { value: number; onClick?: () => void }): ReactNode {
  const text = value.toLocaleString("pt-BR")
  if (!onClick || value <= 0) return text
  return (
    <button type="button" onClick={onClick} className="hover:text-primary cursor-pointer hover:underline">
      {text}
    </button>
  )
}

export function PnrWeeklyTables({
  data,
  onDrill,
}: {
  data: PnrWeeklyData
  /** Clique num valor → abre a visão "Pacotes" filtrada por base × semana × status. */
  onDrill?: (drill: PnrDrill) => void
}) {
  const lookup = new Map<string, PnrWeeklyEntry>()
  for (const e of data.entries) {
    lookup.set(`${e.baseSlug ?? "__"}|${e.weekStart}`, e)
  }

  function get(baseSlug: string | null, weekStart: string, field: Field): number {
    return lookup.get(`${baseSlug ?? "__"}|${weekStart}`)?.[field] ?? 0
  }

  return (
    <div className="flex flex-col gap-4">
      {TABLES.map(({ field, title, description, bucket }) => {
        const grandTotal = data.bases.reduce(
          (s, b) => s + data.weeks.reduce((ws, w) => ws + get(b.slug, w, field), 0),
          0,
        )
        return (
        <Card key={field}>
          <CardHeader>
            <CardTitle className="text-base">{title} — por semana</CardTitle>
            <CardDescription>
              {description} · {data.bases.length} base(s) · {data.weeks.length} semana(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="bg-muted sticky left-0 min-w-[120px] border-r font-semibold">
                      Base
                    </TableHead>
                    {data.weeks.map((w) => (
                      <TableHead
                        key={w}
                        className="min-w-[72px] border-l text-center font-semibold"
                        title={weekRange(w)}
                      >
                        {weekLabel(w)}
                      </TableHead>
                    ))}
                    <TableHead className="bg-muted/40 min-w-[72px] border-l text-center font-semibold">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bases.map((b) => {
                    const rowTotal = data.weeks.reduce(
                      (s, w) => s + get(b.slug, w, field),
                      0,
                    )
                    return (
                      <TableRow key={b.slug ?? "__null__"}>
                        <TableCell className="bg-card sticky left-0 border-r font-medium">
                          {b.label ?? (
                            <span className="text-muted-foreground italic">Sem base</span>
                          )}
                        </TableCell>
                        {data.weeks.map((w) => {
                          const v = get(b.slug, w, field)
                          return (
                            <TableCell key={w} className="border-l text-center tabular-nums">
                              {v > 0 ? (
                                <WeekNum
                                  value={v}
                                  onClick={onDrill ? () => onDrill({ label: `${title} · ${b.label ?? "Sem base"} · ${weekLabel(w)}`, baseSlug: b.slug, weekStart: w, bucket }) : undefined}
                                />
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell className="bg-muted/40 border-l text-center tabular-nums font-semibold">
                          {rowTotal.toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {/* Linha de totais por coluna */}
                  <TableRow className="bg-muted/50 border-t-2">
                    <TableCell className="bg-muted sticky left-0 border-r font-bold">
                      Total geral
                    </TableCell>
                    {data.weeks.map((w) => {
                      const colTotal = data.bases.reduce(
                        (s, b) => s + get(b.slug, w, field),
                        0,
                      )
                      return (
                        <TableCell key={w} className="border-l text-center tabular-nums font-bold">
                          <WeekNum
                            value={colTotal}
                            onClick={onDrill ? () => onDrill({ label: `${title} · ${weekLabel(w)}`, weekStart: w, bucket }) : undefined}
                          />
                        </TableCell>
                      )
                    })}
                    <TableCell className="bg-muted/40 border-l text-center tabular-nums font-bold">
                      {grandTotal.toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        )
      })}
    </div>
  )
}

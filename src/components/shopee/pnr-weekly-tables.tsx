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
import { type PnrWeeklyData, type PnrWeeklyEntry } from "@/lib/shopee/pnr-queries"

/** "2026-06-15" → número da semana ISO no ano (ex.: 25) */
function isoWeekNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  // week_start é sempre segunda-feira; quinta da mesma semana = +3 dias
  const thursday = new Date(Date.UTC(y, m - 1, d + 3))
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  return Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
}

/** "2026-06-15" → "W25" */
function weekLabel(iso: string): string {
  return `W${isoWeekNumber(iso)}`
}

/** "2026-06-15" → "15/06 – 21/06" */
function weekRange(iso: string): string {
  const start = new Date(`${iso}T12:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  return `${fmt(start)} – ${fmt(end)}`
}

type Field = "total" | "revertidas" | "faturadas"

const TABLES: { field: Field; title: string; description: string }[] = [
  { field: "total", title: "Geradas", description: "PNRs criadas por semana e base" },
  { field: "revertidas", title: "Revertidas", description: "PNRs com status Reversed por semana e base" },
  { field: "faturadas", title: "Para faturamento", description: "PNRs com status ForBilling por semana e base" },
]

export function PnrWeeklyTables({ data }: { data: PnrWeeklyData }) {
  const lookup = new Map<string, PnrWeeklyEntry>()
  for (const e of data.entries) {
    lookup.set(`${e.baseSlug ?? "__"}|${e.weekStart}`, e)
  }

  function get(baseSlug: string | null, weekStart: string, field: Field): number {
    return lookup.get(`${baseSlug ?? "__"}|${weekStart}`)?.[field] ?? 0
  }

  return (
    <div className="flex flex-col gap-4">
      {TABLES.map(({ field, title, description }) => (
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
                  <TableRow>
                    <TableHead className="bg-card sticky left-0 min-w-[120px] border-r">
                      Base
                    </TableHead>
                    {data.weeks.map((w) => (
                      <TableHead
                        key={w}
                        className="min-w-[72px] text-right"
                        title={weekRange(w)}
                      >
                        {weekLabel(w)}
                      </TableHead>
                    ))}
                    <TableHead className="bg-muted/40 min-w-[72px] text-right font-semibold">
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
                            <TableCell key={w} className="text-right tabular-nums">
                              {v > 0 ? (
                                v.toLocaleString("pt-BR")
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell className="bg-muted/40 text-right tabular-nums font-semibold">
                          {rowTotal.toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {/* Linha de totais por coluna */}
                  <TableRow className="border-t-2">
                    <TableCell className="bg-card sticky left-0 border-r font-semibold">
                      Total
                    </TableCell>
                    {data.weeks.map((w) => {
                      const colTotal = data.bases.reduce(
                        (s, b) => s + get(b.slug, w, field),
                        0,
                      )
                      return (
                        <TableCell key={w} className="text-right tabular-nums font-semibold">
                          {colTotal.toLocaleString("pt-BR")}
                        </TableCell>
                      )
                    })}
                    <TableCell className="bg-muted/40 text-right tabular-nums font-bold">
                      {data.bases
                        .reduce(
                          (s, b) =>
                            s + data.weeks.reduce((ws, w) => ws + get(b.slug, w, field), 0),
                          0,
                        )
                        .toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

"use client"

import { useMemo, useState, type ReactNode } from "react"
import { XIcon } from "lucide-react"

import { PnrDriverTable } from "@/components/shopee/pnr-driver-table"
import { PnrPackageTable } from "@/components/shopee/pnr-package-table"
import { PnrWeeklyTables } from "@/components/shopee/pnr-weekly-tables"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PnrDrill } from "@/lib/shopee/pnr-drill"
import type {
  PnrBaseRow,
  PnrDriverRow,
  PnrPackageRow,
  PnrStatusRow,
  PnrWeeklyData,
} from "@/lib/shopee/pnr-queries"

const REVERSED = "Reversed"
const FOR_BILLING = "ForBilling"

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

// Data local (Brasília) de um timestamp — reusado p/ casar a semana do pacote.
const SP_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** ISO (UTC) → segunda-feira da semana em Brasília ("YYYY-MM-DD"), igual ao
 *  date_trunc('week', … at time zone 'America/Sao_Paulo') usado na query. */
function spWeekStart(iso: string): string {
  const [y, m, d] = SP_DATE_FMT.format(new Date(iso)).split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0=Dom..6=Sáb
  dt.setUTCDate(dt.getUTCDate() - (dow === 0 ? 6 : dow - 1)) // recua até segunda
  return dt.toISOString().slice(0, 10)
}

function matchesDrill(p: PnrPackageRow, d: PnrDrill): boolean {
  if ("baseSlug" in d && (p.baseSlug ?? null) !== d.baseSlug) return false
  if ("driverId" in d) {
    if (d.driverId !== null) {
      if (p.driverId !== d.driverId) return false
    } else if (p.driverId !== null || p.driverName !== d.driverName) {
      return false
    }
  }
  if (d.weekStart !== undefined) {
    if (!p.createdTime || spWeekStart(p.createdTime) !== d.weekStart) return false
  }
  if (d.status !== undefined && p.status !== d.status) return false
  if (d.bucket === "reversed" && p.status !== REVERSED) return false
  if (d.bucket === "forbilling" && p.status !== FOR_BILLING) return false
  if (d.bucket === "open" && (p.status === REVERSED || p.status === FOR_BILLING)) return false
  return true
}

/** Número clicável que dispara um drill (some quando count = 0). */
function DrillNum({ value, money, onClick }: { value: number; money?: boolean; onClick: () => void }) {
  const text = money ? brl(value) : value.toLocaleString("pt-BR")
  if (!money && value === 0) return <span className="text-muted-foreground">{text}</span>
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:text-primary cursor-pointer tabular-nums hover:underline"
    >
      {text}
    </button>
  )
}

export function PnrTabs({
  porStatus,
  porBase,
  porMotorista,
  packages,
  weekly,
  total,
  selectedWeek = null,
  operacaoId,
  baseSlugs,
  referenceDay,
}: {
  porStatus: PnrStatusRow[]
  porBase: PnrBaseRow[]
  porMotorista: PnrDriverRow[]
  packages: PnrPackageRow[]
  weekly: PnrWeeklyData | null
  total: number
  /** Semana em foco ("YYYY-MM-DD") — restringe pacotes e drills de motorista. */
  selectedWeek?: string | null
  operacaoId?: string
  baseSlugs: string[]
  referenceDay: string
}) {
  const [tab, setTab] = useState("operacoes")
  const [drill, setDrill] = useState<PnrDrill | null>(null)

  function openDrill(d: PnrDrill) {
    setDrill(d)
    setTab("pacotes")
  }

  // Com drill ativo, o drill manda. Senão, se há semana em foco, mostra só ela;
  // caso contrário, todos os pacotes do recorte atual.
  const drilledPackages = useMemo(() => {
    if (drill) return packages.filter((p) => matchesDrill(p, drill))
    if (selectedWeek)
      return packages.filter(
        (p) => p.createdTime != null && spWeekStart(p.createdTime) === selectedWeek,
      )
    return packages
  }, [packages, drill, selectedWeek])

  const statusValorTotal = porStatus.reduce((s, r) => s + r.valor, 0)

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="operacoes">Operações</TabsTrigger>
        <TabsTrigger value="motoristas">Motoristas</TabsTrigger>
        <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
      </TabsList>

      {/* ── Operações ──────────────────────────────────────────────── */}
      <TabsContent value="operacoes" className="mt-4 flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por status</CardTitle>
            <CardDescription>{porStatus.length} status no conjunto · clique num valor para ver os pacotes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="border-l text-center font-semibold">Qtd</TableHead>
                    <TableHead className="border-l text-center font-semibold">Valor</TableHead>
                    <TableHead className="border-l text-center font-semibold">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porStatus.map((s) => (
                    <TableRow key={s.status}>
                      <TableCell>{s.statusPt}</TableCell>
                      <TableCell className="border-l text-center tabular-nums">
                        <DrillNum value={s.count} onClick={() => openDrill({ label: `Status: ${s.statusPt}`, status: s.status })} />
                      </TableCell>
                      <TableCell className="border-l text-center tabular-nums">
                        <DrillNum value={s.valor} money onClick={() => openDrill({ label: `Status: ${s.statusPt}`, status: s.status })} />
                      </TableCell>
                      <TableCell className="border-l text-center tabular-nums">
                        {total ? ((s.count / total) * 100).toFixed(1) : "0.0"}%
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 border-t-2">
                    <TableCell className="font-bold">Total geral</TableCell>
                    <TableCell className="border-l text-center tabular-nums font-bold">
                      {total.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="border-l text-center tabular-nums font-bold">{brl(statusValorTotal)}</TableCell>
                    <TableCell className="border-l text-center tabular-nums font-bold">100.0%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {weekly ? (
          <PnrWeeklyTables data={weekly} onDrill={openDrill} />
        ) : (
          porBase.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por base</CardTitle>
                <CardDescription>{porBase.length} base(s) no conjunto · clique num valor para ver os pacotes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Base</TableHead>
                        <TableHead className="border-l text-center font-semibold">PNRs</TableHead>
                        <TableHead className="border-l text-center font-semibold">Valor</TableHead>
                        <TableHead className="border-l text-center font-semibold">Para faturamento</TableHead>
                        <TableHead className="border-l text-center font-semibold">Revertidas</TableHead>
                        <TableHead className="border-l text-center font-semibold">Em aberto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porBase.map((b, i) => {
                        const baseLabel = b.baseLabel ?? "Sem base"
                        const baseDrill = (extra: Partial<PnrDrill>): PnrDrill => ({
                          label: `Base: ${baseLabel}`,
                          baseSlug: b.baseSlug,
                          ...extra,
                        })
                        return (
                          <TableRow key={`${b.baseSlug ?? "sem-base"}-${i}`}>
                            <TableCell>
                              {b.baseLabel ?? <span className="text-muted-foreground italic">Sem base</span>}
                            </TableCell>
                            <TableCell className="border-l text-center tabular-nums">
                              <DrillNum value={b.count} onClick={() => openDrill(baseDrill({}))} />
                            </TableCell>
                            <TableCell className="border-l text-center tabular-nums">
                              <DrillNum value={b.valor} money onClick={() => openDrill(baseDrill({ bucket: "forbilling", label: `Base: ${baseLabel} · Para faturamento` }))} />
                            </TableCell>
                            <TableCell className="border-l text-center tabular-nums">
                              <DrillNum value={b.faturadas} onClick={() => openDrill(baseDrill({ bucket: "forbilling", label: `Base: ${baseLabel} · Para faturamento` }))} />
                            </TableCell>
                            <TableCell className="border-l text-center tabular-nums">
                              <DrillNum value={b.revertidas} onClick={() => openDrill(baseDrill({ bucket: "reversed", label: `Base: ${baseLabel} · Revertidas` }))} />
                            </TableCell>
                            <TableCell className="border-l text-center tabular-nums font-medium">
                              <DrillNum value={b.emAberto} onClick={() => openDrill(baseDrill({ bucket: "open", label: `Base: ${baseLabel} · Em aberto` }))} />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      <TableRow className="bg-muted/50 border-t-2">
                        <TableCell className="font-bold">Total geral</TableCell>
                        <TableCell className="border-l text-center tabular-nums font-bold">
                          {porBase.reduce((s, b) => s + b.count, 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="border-l text-center tabular-nums font-bold">
                          {brl(porBase.reduce((s, b) => s + b.valor, 0))}
                        </TableCell>
                        <TableCell className="border-l text-center tabular-nums font-bold">
                          {porBase.reduce((s, b) => s + b.faturadas, 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="border-l text-center tabular-nums font-bold">
                          {porBase.reduce((s, b) => s + b.revertidas, 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="border-l text-center tabular-nums font-bold">
                          {porBase.reduce((s, b) => s + b.emAberto, 0).toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </TabsContent>

      {/* ── Motoristas ─────────────────────────────────────────────── */}
      <TabsContent value="motoristas" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prejuízo por motorista</CardTitle>
            <CardDescription>
              {porMotorista.length} motoristas · clique num valor para ver os pacotes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PnrDriverTable
              rows={porMotorista}
              operacaoId={operacaoId}
              baseSlugs={baseSlugs}
              referenceDay={referenceDay}
              focusWeek={selectedWeek}
              onDrill={openDrill}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Pacotes ────────────────────────────────────────────────── */}
      <TabsContent value="pacotes" className="mt-4 flex flex-col gap-3">
        {drill && (
          <DrillChip label={drill.label} onClear={() => setDrill(null)} />
        )}
        <PnrPackageTable rows={drilledPackages} />
      </TabsContent>
    </Tabs>
  )
}

function DrillChip({ label, onClear }: { label: string; onClear: () => void }): ReactNode {
  return (
    <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <span className="text-muted-foreground">Filtrando pelo pivô:</span>
      <span className="font-medium">{label}</span>
      <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 px-2" onClick={onClear}>
        <XIcon className="size-3.5" />
        Limpar
      </Button>
    </div>
  )
}

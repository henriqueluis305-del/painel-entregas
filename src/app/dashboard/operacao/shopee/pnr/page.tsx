import {
  BanknoteIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
  Undo2Icon,
  WalletIcon,
} from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { PnrDriverTable } from "@/components/shopee/pnr-driver-table"
import { PnrWeeklyTables } from "@/components/shopee/pnr-weekly-tables"
import { ShopeeSubtabShell } from "@/components/shopee/subtab-shell"
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
import { getOperacaoBySlug } from "@/lib/queries"
import {
  effectiveBases,
  parseShopeeFilters,
  SHOPEE_PNR_DEFAULT_PERIOD,
  SHOPEE_SLUG,
} from "@/lib/shopee"
import { getPnrBases, getPnrData, getPnrWeeklyData } from "@/lib/shopee/pnr-queries"

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const todayBr = () =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())

export default async function PnrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseShopeeFilters(await searchParams, SHOPEE_PNR_DEFAULT_PERIOD)
  const slugs = effectiveBases(filters)
  const isSemanal = filters.period === "semanal"
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const referenceDay = todayBr()

  const [pnr, weekly, pnrBases] = await Promise.all([
    getPnrData(slugs, isSemanal ? "tudo" : filters.period, filters.from, filters.to),
    isSemanal ? getPnrWeeklyData(slugs) : Promise.resolve(null),
    getPnrBases(),
  ])

  return (
    <ShopeeSubtabShell
      title="PNR"
      description="Prejuízos de PNR por motorista e status (1 PNR por SPXTN)."
      defaultPeriod={SHOPEE_PNR_DEFAULT_PERIOD}
      bases={pnrBases}
    >
      {pnr.total === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Nenhuma PNR importada ainda. Suba o CSV em Uploads.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
            <KpiCard icon={ReceiptTextIcon} label="PNRs (únicas)" value={pnr.total} color="#a78bfa" />
            <KpiCard icon={WalletIcon} label="Valor total" value={brl(pnr.valorTotal)} color="#ef4444" />
            <KpiCard icon={BanknoteIcon} label="Para faturamento" value={pnr.faturadas} color="#0ea5e9" />
            <KpiCard icon={Undo2Icon} label="Revertidas" value={pnr.revertidas} color="#22c55e" />
            <KpiCard icon={TriangleAlertIcon} label="Em aberto" value={pnr.emAberto} color="#f59e0b" />
          </div>

          <Tabs defaultValue="operacoes">
            <TabsList>
              <TabsTrigger value="operacoes">Operações</TabsTrigger>
              <TabsTrigger value="motoristas">Motoristas</TabsTrigger>
            </TabsList>

            {/* ── Sub-aba 1: Operações ──────────────────────────────────── */}
            <TabsContent value="operacoes" className="mt-4 flex flex-col gap-4">
              {/* Por status — sempre visível */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Por status</CardTitle>
                  <CardDescription>{pnr.porStatus.length} status no conjunto</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pnr.porStatus.map((s) => (
                          <TableRow key={s.status}>
                            <TableCell>{s.statusPt}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {s.count.toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{brl(s.valor)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {pnr.total ? ((s.count / pnr.total) * 100).toFixed(1) : "0.0"}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Visão semanal (3 tabelas pivô) ou visão normal (por base) */}
              {isSemanal && weekly ? (
                <PnrWeeklyTables data={weekly} />
              ) : (
                pnr.porBase.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Por base</CardTitle>
                      <CardDescription>{pnr.porBase.length} base(s) no conjunto</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-hidden rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Base</TableHead>
                              <TableHead className="text-right">PNRs</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead className="text-right">Para faturamento</TableHead>
                              <TableHead className="text-right">Revertidas</TableHead>
                              <TableHead className="text-right">Em aberto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pnr.porBase.map((b, i) => (
                              <TableRow key={`${b.baseSlug ?? "sem-base"}-${i}`}>
                                <TableCell>
                                  {b.baseLabel ?? (
                                    <span className="text-muted-foreground italic">Sem base</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {b.count.toLocaleString("pt-BR")}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{brl(b.valor)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {b.faturadas.toLocaleString("pt-BR")}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {b.revertidas.toLocaleString("pt-BR")}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {b.emAberto.toLocaleString("pt-BR")}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )
              )}
            </TabsContent>

            {/* ── Sub-aba 2: Motoristas ─────────────────────────────────── */}
            <TabsContent value="motoristas" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Prejuízo por motorista</CardTitle>
                  <CardDescription>
                    {pnr.motoristas} motoristas · clique no cabeçalho para ordenar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PnrDriverTable
                    rows={pnr.porMotorista}
                    operacaoId={op?.id}
                    baseSlugs={slugs}
                    referenceDay={referenceDay}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </ShopeeSubtabShell>
  )
}

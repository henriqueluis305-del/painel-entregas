import { BurnDownChart } from "@/components/shopee/burn-down-chart"
import { HalfGauge } from "@/components/shopee/half-gauge"
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
import { getOperacaoBySlug } from "@/lib/queries"
import { effectiveBases, parseShopeeFilters, SHOPEE_SLUG } from "@/lib/shopee"
import { faltamMeta } from "@/lib/shopee/sla"
import { getSlaData, getSlaEvolution } from "@/lib/shopee/sla-queries"

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card rounded-lg border px-3 py-2 text-center">
      <div className="text-lg font-bold tabular-nums" style={color ? { color } : undefined}>
        {value.toLocaleString("pt-BR")}
      </div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  )
}

export default async function SlaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseShopeeFilters(await searchParams)
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const slugs = effectiveBases(filters)
  const [sla, evo] = op
    ? await Promise.all([getSlaData(op.id, slugs), getSlaEvolution(op.id, slugs)])
    : [
        { day: null, total: 0, entregues: 0, emRota: 0, ocorrencias: 0, faltantes: 0, outros: 0, pct: 0, perBase: [] },
        [],
      ]
  const meta = faltamMeta(sla.total, sla.entregues)

  return (
    <ShopeeSubtabShell title="SLA" description="Nível de serviço — entregues / total do dia.">
      {sla.day == null ? (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Sem SLA importado para as bases selecionadas.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SLA — Nível de serviço</CardTitle>
                <CardDescription>entregues / total</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <HalfGauge pct={sla.pct} sub={`${sla.total.toLocaleString("pt-BR")} pacotes`} />
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Entregues" value={sla.entregues} color="#22c55e" />
                  <Stat label="Em rota" value={sla.emRota} color="#0ea5e9" />
                  <Stat label="Ocorrências" value={sla.ocorrencias} color="#ef4444" />
                  <Stat label="Faltantes" value={sla.faltantes} />
                  <Stat label="Faltam p/ 98%" value={meta} color="#f59e0b" />
                  <Stat label="Outros" value={sla.outros} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução SLA</CardTitle>
                <CardDescription>SLA% por dia (snapshots)</CardDescription>
              </CardHeader>
              <CardContent>
                <BurnDownChart points={evo} />
              </CardContent>
            </Card>
          </div>

          {sla.perBase.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SLA por base</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Base</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Entregues</TableHead>
                        <TableHead className="text-right">SLA%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sla.perBase.map((b) => (
                        <TableRow key={b.base_slug}>
                          <TableCell>{b.base_label}</TableCell>
                          <TableCell className="text-right tabular-nums">{b.total.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right tabular-nums">{b.entregues.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{b.pct}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </ShopeeSubtabShell>
  )
}

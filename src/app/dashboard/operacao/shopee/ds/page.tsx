import {
  CheckCircle2Icon,
  TriangleAlertIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { BurnDownChart } from "@/components/shopee/burn-down-chart"
import { HalfGauge } from "@/components/shopee/half-gauge"
import { DsTable } from "@/components/shopee/ds-table"
import { DonutLegend, MiniDonut, type DonutSegment } from "@/components/shopee/mini-donut"
import { ShopeeSubtabShell } from "@/components/shopee/subtab-shell"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getOperacaoBySlug } from "@/lib/queries"
import { effectiveBases, parseShopeeFilters, SHOPEE_SLUG } from "@/lib/shopee"
import { getDsCheckpoints, getDsData } from "@/lib/shopee/ds-queries"

export default async function DsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseShopeeFilters(await searchParams)
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const slugs = effectiveBases(filters)
  const [ds, checkpoints] = op
    ? await Promise.all([getDsData(op.id, slugs), getDsCheckpoints(op.id, slugs)])
    : [
        { rows: [], totals: { motoristas: 0, saiu: 0, entregues: 0, emRota: 0, ocorrencias: 0, pct: 0 }, isDemo: false, day: null },
        [],
      ]
  const t = ds.totals

  const segments: DonutSegment[] = [
    { key: "ent", label: "Entregues", value: t.entregues, color: "#22c55e" },
    { key: "rota", label: "Em rota", value: t.emRota, color: "#0ea5e9" },
    { key: "oc", label: "Ocorrências", value: t.ocorrencias, color: "#ef4444" },
  ]

  return (
    <ShopeeSubtabShell
      title="DS"
      description="Encaminhados vs. entregues do dia, por motorista."
    >
      {ds.isDemo && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          <TriangleAlertIcon className="size-4 shrink-0" />
          Protótipo com <strong>dados de exemplo</strong>.
        </div>
      )}

      {ds.day == null ? (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Sem DS importado para as bases selecionadas.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Burn-down DS</CardTitle>
                <CardDescription>% ainda não entregue por upload</CardDescription>
              </CardHeader>
              <CardContent>
                <BurnDownChart points={checkpoints.map((c) => ({ label: c.label, pct: c.pct }))} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">DS — Mesmo dia</CardTitle>
                <CardDescription>entregues / encaminhados</CardDescription>
              </CardHeader>
              <CardContent>
                <HalfGauge pct={t.pct} sub={`${t.saiu.toLocaleString("pt-BR")} encaminhados`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Composição do dia</CardTitle>
                <CardDescription>{t.saiu.toLocaleString("pt-BR")} encaminhados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <MiniDonut
                    segments={segments}
                    centerValue={t.saiu.toLocaleString("pt-BR")}
                    centerSub="saíram"
                  />
                  <DonutLegend segments={segments} total={t.saiu} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={CheckCircle2Icon} label="Entregues" value={t.entregues} color="#22c55e" />
            <KpiCard icon={TruckIcon} label="Em rota" value={t.emRota} color="#0ea5e9" />
            <KpiCard icon={TriangleAlertIcon} label="Ocorrências" value={t.ocorrencias} color="#ef4444" />
            <KpiCard icon={UsersIcon} label="Motoristas" value={t.motoristas} color="#a78bfa" />
          </div>

          <DsTable rows={ds.rows} />
        </>
      )}
    </ShopeeSubtabShell>
  )
}

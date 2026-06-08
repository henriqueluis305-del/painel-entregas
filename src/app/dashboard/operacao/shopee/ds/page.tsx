import {
  CheckCircle2Icon,
  TriangleAlertIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { DsGauge } from "@/components/shopee/ds-gauge"
import { DsTable } from "@/components/shopee/ds-table"
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
import { getDsData } from "@/lib/shopee/ds-queries"

export default async function DsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseShopeeFilters(await searchParams)
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const ds = op
    ? await getDsData(op.id, effectiveBases(filters))
    : { rows: [], totals: { motoristas: 0, saiu: 0, entregues: 0, emRota: 0, ocorrencias: 0, pct: 0 }, isDemo: false, day: null }
  const t = ds.totals

  return (
    <ShopeeSubtabShell
      title="DS"
      description="Encaminhados vs. entregues do dia, por motorista."
    >
      {ds.isDemo && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          <TriangleAlertIcon className="size-4 shrink-0" />
          Protótipo com <strong>dados de exemplo</strong> — o arquivo de DS real
          (com as colunas de quantidade) substitui isso quando você enviar.
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
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">DS — Mesmo dia</CardTitle>
                <CardDescription>entregues / encaminhados</CardDescription>
              </CardHeader>
              <CardContent>
                <DsGauge pct={t.pct} saiu={t.saiu} />
              </CardContent>
            </Card>

            <div className="grid content-start gap-4 sm:grid-cols-2">
              <KpiCard icon={CheckCircle2Icon} label="Entregues" value={t.entregues} color="#22c55e" />
              <KpiCard icon={TruckIcon} label="Em rota" value={t.emRota} color="#0ea5e9" />
              <KpiCard icon={TriangleAlertIcon} label="Ocorrências" value={t.ocorrencias} color="#ef4444" />
              <KpiCard icon={UsersIcon} label="Motoristas" value={t.motoristas} color="#a78bfa" />
            </div>
          </div>

          <DsTable rows={ds.rows} />
        </>
      )}
    </ShopeeSubtabShell>
  )
}

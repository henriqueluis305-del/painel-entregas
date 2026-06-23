import Link from "next/link"
import {
  ArrowRightIcon,
  BoxesIcon,
  GaugeIcon,
  TruckIcon,
  WalletIcon,
} from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { HalfGauge } from "@/components/shopee/half-gauge"
import { DonutLegend, MiniDonut, type DonutSegment } from "@/components/shopee/mini-donut"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShopeeSubtabShell } from "@/components/shopee/subtab-shell"
import { getOperacaoBySlug } from "@/lib/queries"
import { effectiveBases, parseShopeeFilters, SHOPEE_BASE_PATH, SHOPEE_SLUG } from "@/lib/shopee"
import { getShopeeConfig } from "@/lib/shopee/config"
import { getDsData } from "@/lib/shopee/ds-queries"
import { getPnrData } from "@/lib/shopee/pnr-queries"
import { getSlaData } from "@/lib/shopee/sla-queries"
import { computeStuckKpis, getStuckPackages } from "@/lib/shopee/stuck-queries"

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

function qsFrom(sp: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x))
    else if (v != null) params.set(k, v)
  }
  const s = params.toString()
  return s ? `?${s}` : ""
}

export default async function GeralPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const filters = parseShopeeFilters(sp)
  const qs = qsFrom(sp)
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const slugs = effectiveBases(filters)
  const config = await getShopeeConfig()

  const [sla, ds, stuckRows, pnr] = op
    ? await Promise.all([
        getSlaData(op.id, slugs),
        getDsData(op.id, slugs),
        getStuckPackages(op.id, slugs, { dailyReset: config.stuckDailyReset }),
        getPnrData(slugs, "tudo"), // PNR é cumulativo: sempre mostra todos os prejuízos abertos
      ])
    : [
        { day: null, pct: 0, total: 0, entregues: 0 } as Awaited<ReturnType<typeof getSlaData>>,
        { day: null, totals: { motoristas: 0, saiu: 0, entregues: 0, emRota: 0, ocorrencias: 0, pct: 0 } } as Awaited<ReturnType<typeof getDsData>>,
        [],
        { total: 0, valorTotal: 0, revertidas: 0, faturadas: 0, emAberto: 0, motoristas: 0, porStatus: [], porMotorista: [], porBase: [] } as Awaited<ReturnType<typeof getPnrData>>,
      ]
  const stuck = computeStuckKpis(stuckRows)
  const stuckResolvPct = stuck.total ? Math.round((stuck.entregues / stuck.total) * 100) : 0
  const stuckSegments: DonutSegment[] = [
    { key: "ativos", label: "Stuck ativos", value: stuck.ativos, color: "#f59e0b" },
    { key: "resolv", label: "Resolvidos", value: stuck.entregues, color: "#22c55e" },
  ]

  return (
    <ShopeeSubtabShell title="Geral" description="Consolidado de toda a operação Shopee.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={GaugeIcon} label="SLA" value={sla.day ? `${sla.pct}%` : "—"} color="#22c55e" />
        <KpiCard icon={TruckIcon} label="DS" value={ds.day ? `${ds.totals.pct}%` : "—"} color="#0ea5e9" />
        <KpiCard icon={BoxesIcon} label="Stuck ativos" value={stuck.ativos} color="#f59e0b" />
        <KpiCard icon={WalletIcon} label="PNR" value={brl(pnr.valorTotal)} color="#a78bfa" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <SummaryCard href={`${SHOPEE_BASE_PATH}/sla${qs}`} title="SLA" subtitle="Nível de serviço">
          {sla.day ? (
            <HalfGauge pct={sla.pct} sub={`${sla.total.toLocaleString("pt-BR")} pacotes`} />
          ) : (
            <Empty />
          )}
        </SummaryCard>

        <SummaryCard href={`${SHOPEE_BASE_PATH}/ds${qs}`} title="DS" subtitle="Encaminhados vs entregues">
          {ds.day ? (
            <HalfGauge pct={ds.totals.pct} sub={`${ds.totals.saiu.toLocaleString("pt-BR")} encaminhados`} />
          ) : (
            <Empty />
          )}
        </SummaryCard>

        <SummaryCard href={`${SHOPEE_BASE_PATH}/stuck${qs}`} title="Stuck" subtitle={`${stuck.total.toLocaleString("pt-BR")} pacotes do dia`}>
          {stuck.total ? (
            <div className="flex flex-wrap items-center justify-center gap-4">
              <MiniDonut segments={stuckSegments} centerValue={`${stuckResolvPct}%`} centerSub="resolvidos" />
              <DonutLegend segments={stuckSegments} total={stuck.total} />
            </div>
          ) : (
            <Empty />
          )}
        </SummaryCard>

        <SummaryCard href={`${SHOPEE_BASE_PATH}/pnr${qs}`} title="PNR" subtitle={`${pnr.total.toLocaleString("pt-BR")} PNRs no total`}>
          {pnr.total ? (
            <dl className="flex flex-col gap-2 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Prejuízo total</dt>
                <dd className="font-medium tabular-nums">{brl(pnr.valorTotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Para faturamento</dt>
                <dd className="font-medium tabular-nums">{pnr.faturadas.toLocaleString("pt-BR")}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Revertidas</dt>
                <dd className="font-medium tabular-nums">{pnr.revertidas.toLocaleString("pt-BR")}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Em aberto</dt>
                <dd className="font-medium tabular-nums">{pnr.emAberto.toLocaleString("pt-BR")}</dd>
              </div>
            </dl>
          ) : (
            <Empty />
          )}
        </SummaryCard>
      </div>
    </ShopeeSubtabShell>
  )
}

function SummaryCard({
  href,
  title,
  subtitle,
  children,
}: {
  href: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className="group block">
      <Card className="hover:border-primary/50 h-full transition-colors">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{subtitle}</CardDescription>
            </div>
            <ArrowRightIcon className="text-muted-foreground group-hover:text-foreground size-4 transition-colors" />
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </Link>
  )
}

function Empty() {
  return (
    <p className="text-muted-foreground py-10 text-center text-sm">
      Sem dados para o filtro atual.
    </p>
  )
}

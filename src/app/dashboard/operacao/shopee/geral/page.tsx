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
import { getSlaData } from "@/lib/shopee/sla-queries"
import { computeStuckKpis, getStuckPackages } from "@/lib/shopee/stuck-queries"

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

  const [sla, ds, stuckRows] = op
    ? await Promise.all([
        getSlaData(op.id, slugs),
        getDsData(op.id, slugs),
        getStuckPackages(op.id, slugs, { dailyReset: config.stuckDailyReset }),
      ])
    : [
        { day: null, pct: 0, total: 0, entregues: 0 } as Awaited<ReturnType<typeof getSlaData>>,
        { day: null, totals: { motoristas: 0, saiu: 0, entregues: 0, emRota: 0, ocorrencias: 0, pct: 0 } } as Awaited<ReturnType<typeof getDsData>>,
        [],
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
        <KpiCard icon={WalletIcon} label="PNR (WIP)" value="—" color="#a78bfa" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
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
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WalletIcon className="text-muted-foreground size-4" />
            PNR — Prejuízos (WIP)
          </CardTitle>
          <CardDescription>
            Espaço reservado. Entra quando você enviar os dados de PNR — prejuízo
            por motorista, status e reclamações.
          </CardDescription>
        </CardHeader>
      </Card>
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

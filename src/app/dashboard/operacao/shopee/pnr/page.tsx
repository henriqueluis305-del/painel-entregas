import {
  BanknoteIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
  Undo2Icon,
  WalletIcon,
} from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { PnrKindToggle } from "@/components/shopee/pnr-kind-toggle"
import { PnrTabs } from "@/components/shopee/pnr-tabs"
import { PnrWeekSelect } from "@/components/shopee/pnr-week-select"
import { ShopeeSubtabShell } from "@/components/shopee/subtab-shell"
import { Card, CardContent } from "@/components/ui/card"
import { getOperacaoBySlug } from "@/lib/queries"
import {
  effectiveBases,
  parseShopeeFilters,
  SHOPEE_PNR_DEFAULT_PERIOD,
  SHOPEE_SLUG,
} from "@/lib/shopee"
import {
  getPnrBases,
  getPnrData,
  getPnrPackages,
  getPnrWeeklyData,
  getPnrWeeklyFrom,
  type PnrKind,
} from "@/lib/shopee/pnr-queries"
import { addDaysIso } from "@/lib/shopee/pnr-week"

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const todayBr = () =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())

export default async function PnrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const filters = parseShopeeFilters(sp, SHOPEE_PNR_DEFAULT_PERIOD)
  const slugs = effectiveBases(filters)
  const isSemanal = filters.period === "semanal"
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const referenceDay = todayBr()

  // Toggle XPT × HUB: limita TODO o painel (KPIs, tabelas, motoristas, pacotes).
  const tipoParam = Array.isArray(sp.tipo) ? sp.tipo[0] : sp.tipo
  const kind: PnrKind = tipoParam === "xpt" || tipoParam === "hub" ? tipoParam : "both"

  // No modo semanal, KPIs / motoristas / pacotes usam o mesmo recorte de
  // 4 semanas das tabelas semanais (intervalo a partir da semana mais recente
  // com dados − 3 semanas), em vez de "tudo".
  const weeklyFrom = isSemanal ? await getPnrWeeklyFrom(slugs, kind) : null
  const period = isSemanal ? (weeklyFrom ? "intervalo" : "tudo") : filters.period
  const dataFrom = isSemanal ? (weeklyFrom ?? undefined) : filters.from
  const dataTo = isSemanal ? undefined : filters.to

  // Foco opcional numa única semana da janela (só re-escopa KPIs, motoristas e
  // pacotes; "Por status" e as tabelas semanais seguem a janela de 4 semanas).
  const windowWeeks = weeklyFrom ? [0, 7, 14, 21].map((d) => addDaysIso(weeklyFrom, d)) : []
  const semanaParam = Array.isArray(sp.semana) ? sp.semana[0] : sp.semana
  const selectedWeek =
    isSemanal && semanaParam && windowWeeks.includes(semanaParam) ? semanaParam : null

  const [pnr, weekly, pnrBases, packages, pnrWeek] = await Promise.all([
    getPnrData(slugs, period, dataFrom, dataTo, kind),
    isSemanal ? getPnrWeeklyData(slugs, kind) : Promise.resolve(null),
    getPnrBases(),
    getPnrPackages(slugs, period, dataFrom, dataTo, kind),
    selectedWeek
      ? getPnrData(slugs, "intervalo", selectedWeek, addDaysIso(selectedWeek, 6), kind)
      : Promise.resolve(null),
  ])

  // KPIs e listagem de motoristas seguem o foco de semana (quando ativo).
  const kpi = pnrWeek ?? pnr

  return (
    <ShopeeSubtabShell
      title="PNR"
      description="Prejuízos de PNR por motorista e status (1 PNR por SPXTN)."
      defaultPeriod={SHOPEE_PNR_DEFAULT_PERIOD}
      bases={pnrBases}
      filterExtra={
        <>
          <PnrKindToggle value={kind} />
          {isSemanal && weekly && weekly.weeks.length > 0 && (
            <PnrWeekSelect weeks={weekly.weeks} value={selectedWeek} />
          )}
        </>
      }
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
            <KpiCard icon={ReceiptTextIcon} label="PNRs (únicas)" value={kpi.total} color="#a78bfa" />
            <KpiCard icon={WalletIcon} label="Valor total" value={brl(kpi.valorTotal)} color="#ef4444" />
            <KpiCard icon={BanknoteIcon} label="Para faturamento" value={kpi.faturadas} color="#0ea5e9" />
            <KpiCard icon={Undo2Icon} label="Revertidas" value={kpi.revertidas} color="#22c55e" />
            <KpiCard icon={TriangleAlertIcon} label="Em aberto" value={kpi.emAberto} color="#f59e0b" />
          </div>

          <PnrTabs
            porStatus={pnr.porStatus}
            porBase={pnr.porBase}
            porMotorista={kpi.porMotorista}
            packages={packages}
            weekly={weekly}
            total={pnr.total}
            selectedWeek={selectedWeek}
            operacaoId={op?.id}
            baseSlugs={slugs}
            referenceDay={referenceDay}
          />
        </>
      )}
    </ShopeeSubtabShell>
  )
}

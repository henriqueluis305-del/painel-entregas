import { BoxesIcon, CheckCircle2Icon, MapPinIcon, UsersIcon } from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { ShopeeSubtabShell } from "@/components/shopee/subtab-shell"
import { StuckTable } from "@/components/shopee/stuck-table"
import { getOperacaoBySlug } from "@/lib/queries"
import { effectiveBases, parseShopeeFilters, SHOPEE_SLUG } from "@/lib/shopee"
import { computeStuckKpis, getStuckPackages } from "@/lib/shopee/stuck-queries"

export default async function StuckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseShopeeFilters(await searchParams)
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const rows = op ? await getStuckPackages(op.id, effectiveBases(filters)) : []
  const kpi = computeStuckKpis(rows)

  return (
    <ShopeeSubtabShell
      title="Stuck"
      description="Pacotes presos: floor(LM Hub Days) ≥ 1 e status ≠ Delivered."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={BoxesIcon} label="Stuck ativos" value={kpi.ativos} color="#f59e0b" />
        <KpiCard icon={CheckCircle2Icon} label="Entregues" value={kpi.entregues} color="#22c55e" />
        <KpiCard icon={UsersIcon} label="Motoristas" value={kpi.motoristas} color="#0ea5e9" />
        <KpiCard icon={MapPinIcon} label="Bases" value={kpi.bases} color="#a78bfa" />
      </div>

      <StuckTable rows={rows} />
    </ShopeeSubtabShell>
  )
}

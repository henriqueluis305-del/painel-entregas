import {
  BoxesIcon,
  GaugeIcon,
  TruckIcon,
  WalletIcon,
} from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { SubtabPlaceholder } from "@/components/shopee/subtab-placeholder"

export default function GeralPage() {
  return (
    <SubtabPlaceholder
      title="Geral"
      description="Consolidado de toda a operação Shopee."
      planned={[
        "Agregar SLA, DS e Stuck do período/base selecionados",
        "Mini-gráficos de tendência (histórico)",
        "Espaço de PNR liberado quando os dados chegarem",
      ]}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={GaugeIcon} label="SLA" value="—" color="#22c55e" />
        <KpiCard icon={TruckIcon} label="DS" value="—" color="#0ea5e9" />
        <KpiCard icon={BoxesIcon} label="Stuck" value="—" color="#f59e0b" />
        <KpiCard
          icon={WalletIcon}
          label="PNR (WIP)"
          value="—"
          color="#a78bfa"
        />
      </div>
    </SubtabPlaceholder>
  )
}

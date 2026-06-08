import { SubtabPlaceholder } from "@/components/shopee/subtab-placeholder"

export default function StuckPage() {
  return (
    <SubtabPlaceholder
      title="Stuck"
      description="Pacotes presos: floor(LM Hub Days) ≥ 1 e status ≠ Delivered."
      sources={[
        "Inicial: backlogs.xlsx (Shipment ID, LM Hub Days, Latest Status, Latest User Name)",
        "Atualização: export_return_order_*.csv (tracking)",
      ]}
      planned={[
        "Criar tabelas shopee_package / _event / _stuck_snapshot (aguarda OK)",
        "Upload incremental com diff + confirmação",
        "Tabela paginada + busca + esconder entregues",
        "Export dos IDs de stuck direto pro clipboard",
      ]}
    />
  )
}

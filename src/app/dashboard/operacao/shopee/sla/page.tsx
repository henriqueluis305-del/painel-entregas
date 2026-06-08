import { SubtabPlaceholder } from "@/components/shopee/subtab-placeholder"

export default function SlaPage() {
  return (
    <SubtabPlaceholder
      title="SLA"
      description="Percentual de entregas dentro do SLA por base/dia."
      sources={["CSV export_return_order_*.csv (status na coluna Status)"]}
      planned={[
        "Validar o fluxo de cálculo com o Pedro (Fase 4)",
        "Parser + dedupe por Order ID + resolução de base",
        "SLA% = Delivered / total, categorias via STATUS_MAP",
      ]}
    />
  )
}

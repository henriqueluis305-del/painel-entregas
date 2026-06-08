import { SubtabPlaceholder } from "@/components/shopee/subtab-placeholder"

export default function DsPage() {
  return (
    <SubtabPlaceholder
      title="DS"
      description="Pacotes encaminhados vs. entregues no dia."
      sources={[
        "XLSX de DS (formato real a confirmar)",
        "fleets.xlsx → cadastro de motoristas",
      ]}
      planned={[
        "Obter o xlsx real de DS e mapear colunas",
        "Validar o fluxo de cálculo com o Pedro (Fase 4)",
        "DS% = entregues / encaminhados, agregado e por motorista",
      ]}
    />
  )
}

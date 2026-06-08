import { SubtabPlaceholder } from "@/components/shopee/subtab-placeholder"

export default function PnrPage() {
  return (
    <SubtabPlaceholder
      title="PNR (WIP)"
      description="Prejuízos de PNR por motorista, status e reclamações."
      planned={[
        "Aguardando os dados de PNR do Pedro",
        "Modelo shopee_pnr (driver, valor, status, motivo, data)",
        "Dashboard de prejuízos + evolução por motorista",
      ]}
    />
  )
}

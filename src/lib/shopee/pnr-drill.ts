// Recorte ativo da visão "Pacotes" do PNR (clique num valor agregado).
// Tipo puro, compartilhado entre as tabelas agregadas e o wrapper de abas —
// fica fora dos componentes para evitar import circular.

export type PnrDrill = {
  label: string
  baseSlug?: string | null // null = "sem base"
  driverId?: string | null // null = motorista sem id (casado por nome)
  driverName?: string
  status?: string // status cru exato (visão Por status)
  bucket?: "reversed" | "forbilling" | "open" // colunas derivadas de Por base/motorista
  weekStart?: string // "YYYY-MM-DD" (segunda-feira, Brasília) — visão Semanal
}

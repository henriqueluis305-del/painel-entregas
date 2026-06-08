// SLA — lógica pura portada do app antigo (calcSLA + STATUS_MAP).
// SLA% = entregues / total. Categorias só pra contexto. "Faltam p/ meta" = 98%.

// status Shopee cru → categoria PT (portado de js/constants.js)
export const STATUS_MAP: Record<string, string> = {
  Delivered: "Entregue",
  Hub_Received: "Recebido",
  OnHold: "Ocorrência",
  Hub_Assigned: "Sem atribuição",
  LMHub_LHTransported: "Faltante",
  Delivering: "Em rota",
  Return_LMHub_LHTransporting: "Devolução em LH",
  Hub_LHArrived: "Faltante",
  SOC_LHTransported: "Faltante",
  SOC_Packing: "Faltante",
  SOC_Staging: "Faltante",
  Hub_Packing: "Faltante",
  SOC_LHArrived: "Faltante",
  SOC_Packed: "Faltante",
  SOC_Received: "Faltante",
  Return_Hub_Received: "Interceptado",
  Return_Hub_Packing: "Devolução",
}

export type SlaCat = "entregue" | "em_rota" | "ocorrencia" | "faltante" | "outros"

export function slaCategory(status: string): SlaCat {
  switch (STATUS_MAP[(status ?? "").trim()]) {
    case "Entregue":
      return "entregue"
    case "Em rota":
      return "em_rota"
    case "Ocorrência":
      return "ocorrencia"
    case "Faltante":
      return "faltante"
    default:
      return "outros"
  }
}

export type SlaBreakdown = {
  total: number
  entregues: number
  emRota: number
  ocorrencias: number
  faltantes: number
  outros: number
  pct: number
}

export function calcSla(statuses: string[]): SlaBreakdown {
  let entregues = 0, emRota = 0, ocorrencias = 0, faltantes = 0
  for (const s of statuses) {
    switch (slaCategory(s)) {
      case "entregue": entregues++; break
      case "em_rota": emRota++; break
      case "ocorrencia": ocorrencias++; break
      case "faltante": faltantes++; break
    }
  }
  const total = statuses.length
  const outros = total - entregues - emRota - ocorrencias - faltantes
  return {
    total,
    entregues,
    emRota,
    ocorrencias,
    faltantes,
    outros,
    pct: total > 0 ? Number(((entregues / total) * 100).toFixed(1)) : 0,
  }
}

/** Quantos faltam para atingir a meta (padrão 98%). */
export function faltamMeta(total: number, entregues: number, meta = 0.98): number {
  return total > 0 ? Math.max(0, Math.ceil(meta * total) - entregues) : 0
}

// Domínio do PNR da Shopee — regras puras (parsing + status PT).
// A unidade de PNR é o SPXTN (coluna C). O CSV traz vários tickets por SPXTN;
// colapsa-se por SPXTN mantendo a linha de maior Created Time.

import { parseCsvObjects } from "@/lib/shopee/csv"
import { resolveDriver, dedupeById, type ParsedDriver } from "@/lib/shopee/drivers"
import { resolveBaseSlug } from "@/lib/shopee/stuck"

// status Shopee cru → rótulo PT (fornecido pelo Pedro/Luiz).
export const PNR_STATUS_PT: Record<string, string> = {
  Created: "Criada",
  Reversed: "Revertida",
  "Pending Driver Reply": "Resposta de driver pendente",
  "Review Driver Reply": "Resposta de driver em revisão",
  ForBilling: "Para Faturamento",
  Reviewing: "Em revisão",
}

/** Status cru → PT (cai no próprio status quando não mapeado). */
export function pnrStatusPt(status: string): string {
  const s = (status ?? "").trim()
  return PNR_STATUS_PT[s] ?? s
}

export type PnrRow = {
  spxtn: string
  driverId: string | null
  driverName: string
  baseSlug: string
  station: string
  valor: number | null
  status: string
  motivo: string | null
  prazo: string | null
  createdTime: string
}

/** Aceita "5.34" ou "5,34". null se vazio/inválido. */
export function parsePnrValor(v: unknown): number | null {
  const s = (v == null ? "" : String(v)).trim()
  if (!s) return null
  const n = parseFloat(s.replace(",", "."))
  return Number.isFinite(n) ? n : null
}

/**
 * Lê os CSVs e colapsa por SPXTN, mantendo a linha de maior `Created Time`
 * (formato "YYYY-MM-DD HH:MM:SS" → comparação lexicográfica funciona).
 * `total` = linhas lidas; `rows` = PNRs únicas (1 por SPXTN).
 */
export function parsePnr(texts: string[]): {
  rows: PnrRow[]
  drivers: ParsedDriver[]
  total: number
} {
  const byCode = new Map<string, PnrRow>()
  const drivers: ParsedDriver[] = []
  let total = 0

  for (const t of texts) {
    for (const o of parseCsvObjects(t)) {
      const spxtn = (o["SPXTN"] || "").trim()
      if (!spxtn) continue
      total++
      const drv = resolveDriver(o["Driver"] || "")
      if (drv) drivers.push(drv)
      const station = (o["Station"] || "").trim()
      const row: PnrRow = {
        spxtn,
        driverId: drv?.id ?? null,
        driverName: drv?.name ?? (o["Driver"] || "").trim(),
        baseSlug: station ? resolveBaseSlug(station) : "",
        station,
        valor: parsePnrValor(o["PNR Order Value"]),
        status: (o["Status"] || "").trim(),
        motivo: (o["Rejection Reason"] || "").trim() || null,
        prazo: (o["SLA Deadline"] || "").trim() || null,
        createdTime: (o["Created Time"] || "").trim(),
      }
      const prev = byCode.get(spxtn)
      if (!prev || row.createdTime > prev.createdTime) byCode.set(spxtn, row)
    }
  }

  return { rows: [...byCode.values()], drivers: dedupeById(drivers), total }
}

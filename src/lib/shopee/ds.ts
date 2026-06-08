// DS (encaminhados vs entregues) — lógica pura portada do app antigo (calcDS).
// xlsx por motorista, colunas fixas (0-based): A=0 driver, F=5 saiu,
// I=8 entregues, K=10 em rota, M=12 ocorrências. DS% = Σentregues / Σsaiu.

export type DsDriverRow = {
  driverRaw: string
  saiu: number
  entregues: number
  emRota: number
  ocorrencias: number
}

const DS_COL = { driver: 0, saiu: 5, entregues: 8, emRota: 10, ocorrencias: 12 }

function num(v: unknown): number {
  if (v == null || v === "") return 0
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."))
  return Number.isFinite(n) ? Math.round(n) : 0
}

/** Lê uma linha (array de células por índice) → DsDriverRow, ou null se sem motorista. */
export function parseDsCells(cells: unknown[]): DsDriverRow | null {
  const driverRaw = String(cells[DS_COL.driver] ?? "").trim()
  if (!driverRaw) return null
  return {
    driverRaw,
    saiu: num(cells[DS_COL.saiu]),
    entregues: num(cells[DS_COL.entregues]),
    emRota: num(cells[DS_COL.emRota]),
    ocorrencias: num(cells[DS_COL.ocorrencias]),
  }
}

export type DsTotals = {
  motoristas: number
  saiu: number
  entregues: number
  emRota: number
  ocorrencias: number
  pct: number
}

export function calcDs(
  rows: Pick<DsDriverRow, "saiu" | "entregues" | "emRota" | "ocorrencias">[],
): DsTotals {
  let saiu = 0, entregues = 0, emRota = 0, ocorrencias = 0
  for (const r of rows) {
    saiu += r.saiu
    entregues += r.entregues
    emRota += r.emRota
    ocorrencias += r.ocorrencias
  }
  return {
    motoristas: rows.length,
    saiu,
    entregues,
    emRota,
    ocorrencias,
    pct: saiu > 0 ? Number(((entregues / saiu) * 100).toFixed(1)) : 0,
  }
}

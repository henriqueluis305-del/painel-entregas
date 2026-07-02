// Helpers puros para rótulos de semana (segunda-feira, Brasília) — compartilhados
// entre as tabelas semanais e o seletor de foco de semana. Sem I/O; server-safe.

/** "2026-06-15" → número da semana ISO no ano (ex.: 25) */
export function isoWeekNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  // week_start é sempre segunda-feira; quinta da mesma semana = +3 dias
  const thursday = new Date(Date.UTC(y, m - 1, d + 3))
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  return Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
}

/** "2026-06-15" → "W25" */
export function weekLabel(iso: string): string {
  return `W${isoWeekNumber(iso)}`
}

/** "2026-06-15" → "15/06 – 21/06" */
export function weekRange(iso: string): string {
  const start = new Date(`${iso}T12:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  return `${fmt(start)} – ${fmt(end)}`
}

/** "2026-06-15" → "15/06/2026" (formato usado em data_pt_br). */
export function isoToBr(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

/** Soma `days` a uma data "YYYY-MM-DD" (aritmética em UTC, sem DST). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/**
 * Segundas-feiras (ISO) cujo início cai dentro do mês "YYYY-MM" — no máximo 4
 * (mês com 5 segundas descarta a mais antiga, pra sempre fechar em 4 colunas).
 */
export function mondaysInMonth(monthIso: string): string[] {
  const [y, m] = monthIso.split("-").map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const last = new Date(Date.UTC(y, m, 0)) // último dia do mês
  const dow = first.getUTCDay() || 7 // segunda=1 .. domingo=7
  const monday = new Date(first)
  monday.setUTCDate(monday.getUTCDate() - (dow - 1))

  const mondays: string[] = []
  for (const d = new Date(monday); d <= last; d.setUTCDate(d.getUTCDate() + 7)) {
    if (d >= first) mondays.push(d.toISOString().slice(0, 10))
  }
  return mondays.slice(-4)
}

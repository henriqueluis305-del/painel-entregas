// Resolver de motorista da Shopee.
// Regra (verificada 2026-06-08): o "Driver ID" do CSV é o MESMO número que vem
// entre colchetes no nome ("[14698] CLEBER"). Um único sistema de ID — sem
// match por nome. Contas de sistema/admin são descartadas.

export type ParsedDriver = {
  /** ID externo (= [colchetes] = coluna Driver ID). Sempre o ID no DB. */
  id: string
  name: string
  /** Chave normalizada (lower, sem acento, espaços colapsados) p/ dedupe/busca. */
  key: string
}

const BRACKET_RE = /^\s*\[\s*(\d+)\s*\]\s*(.+)$/
const DRIVER_CONFIRM_RE = /^driver\s*confirm$/i

/** Conta de sistema/admin (não é motorista): emails e rótulos do sistema. */
export function isSystemAccount(name: string): boolean {
  const n = (name ?? "").trim()
  if (!n) return true
  if (n.includes("@")) return true // adm.*@shopeemobile-external.com, spx@shopee.com, ...
  if (DRIVER_CONFIRM_RE.test(n)) return true
  return false
}

/** lower + remove acentos + colapsa espaços + trim. */
export function normalizeDriverKey(name: string): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** "[14698] CLEBER MOURA" → { id: "14698", name: "CLEBER MOURA" }. */
export function parseBracketedName(
  raw: string,
): { id: string; name: string } | null {
  const m = BRACKET_RE.exec(raw ?? "")
  if (!m) return null
  return { id: m[1], name: m[2].trim() }
}

/**
 * Resolve um motorista a partir de:
 *  - nome bracketado "[id] nome" (fleets / backlog `Latest User Name`), OU
 *  - id + nome separados (CSV: `Driver ID` + `Driver Name`).
 * Retorna null quando: sem id, id "0"/vazio, sem nome, ou conta de sistema.
 */
export function resolveDriver(
  rawName: string,
  explicitId?: string | number | null,
): ParsedDriver | null {
  const name0 = (rawName ?? "").trim()

  const bracket = parseBracketedName(name0)
  let id: string | null = null
  let name = name0

  if (bracket) {
    id = bracket.id
    name = bracket.name
  } else {
    const ex = explicitId == null ? "" : String(explicitId).trim()
    if (ex && ex !== "0") id = ex
  }

  if (!id) return null
  if (!name || isSystemAccount(name)) return null
  return { id, name, key: normalizeDriverKey(name) }
}

/** Deduplica por id (último nome visto vence). */
export function dedupeById(drivers: ParsedDriver[]): ParsedDriver[] {
  const map = new Map<string, ParsedDriver>()
  for (const d of drivers) map.set(d.id, d)
  return [...map.values()]
}

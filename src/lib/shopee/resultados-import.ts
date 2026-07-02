// Parser puro (sem DB) do import em massa de resultados antigos de SLA/DS —
// cola uma lista "BASE  SLA%  DS%  DATA" (uma linha por base/dia) pra
// preencher o histórico de dias anteriores ao rastreio automático do app.
import { resolveBaseSlug } from "@/lib/shopee/stuck"

export type ParsedResultadoLine = {
  line: number
  raw: string
  baseRaw: string
  baseSlug: string
  day: string | null // "DD/MM/AAAA" — null se a data não pôde ser interpretada
  slaPct: number | null
  dsPct: number | null
  error: string | null
}

// Tab/vírgula são delimitadores explícitos — preservam célula vazia (SLA ou DS
// não contabilizado naquele dia). O fallback por espaços não tem como
// distinguir "coluna vazia" de "espaçamento", então aí sim ignora vazios.
function splitFields(raw: string): string[] {
  if (raw.includes("\t")) return raw.split("\t").map((s) => s.trim())
  const bySpaces = raw.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean)
  if (bySpaces.length >= 4) return bySpaces
  return raw.split(",").map((s) => s.trim())
}

/**
 * null = "não contabilizado" naquele dia (célula vazia, "domingo", "feriado"
 * ou qualquer texto que não seja percentual) — não é erro, só não gera import
 * daquela métrica pra aquele dia/base.
 */
function parsePct(raw: string): number | null {
  const cleaned = raw.replace("%", "").trim().replace(",", ".")
  if (!cleaned) return null // célula vazia — Number("") seria 0, não é isso que queremos
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n
}

const pad2 = (n: number) => String(n).padStart(2, "0")

function parseDay(raw: string, defaultYear: number): string | null {
  const parts = raw.split("/").map((s) => s.trim())
  if (parts.length < 2 || parts.length > 3) return null
  const day = Number(parts[0])
  const month = Number(parts[1])
  let year = parts.length === 3 ? Number(parts[2]) : defaultYear
  if (parts.length === 3 && parts[2].length === 2) year += 2000
  if (!Number.isInteger(day) || day < 1 || day > 31) return null
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null
  return `${pad2(day)}/${pad2(month)}/${year}`
}

/** Interpreta o texto colado; cada linha inválida vem com `error` preenchido, sem travar as outras. */
export function parseResultadosBulkText(text: string, defaultYear: number): ParsedResultadoLine[] {
  const lines = text.split(/\r?\n/)
  const out: ParsedResultadoLine[] = []
  lines.forEach((raw, i) => {
    const trimmed = raw.trim()
    if (!trimmed) return

    const fields = splitFields(trimmed)
    const base: ParsedResultadoLine = {
      line: i + 1,
      raw: trimmed,
      baseRaw: fields[0] ?? "",
      baseSlug: fields[0] ? resolveBaseSlug(fields[0]) : "",
      day: null,
      slaPct: null,
      dsPct: null,
      error: null,
    }

    if (fields.length < 4) {
      base.error = "Esperado 4 campos: BASE, SLA%, DS%, DATA"
      out.push(base)
      return
    }

    base.slaPct = parsePct(fields[1])
    base.dsPct = parsePct(fields[2])
    base.day = parseDay(fields[3], defaultYear)

    if (!base.baseRaw) base.error = "Base vazia"
    else if (base.day == null) base.error = `Data inválida: "${fields[3]}"`

    out.push(base)
  })
  return out
}

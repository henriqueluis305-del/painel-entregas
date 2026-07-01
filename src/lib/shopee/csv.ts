// Parser de CSV robusto (aspas, vírgula dentro de aspas, CRLF, BOM).
// Usado pela ingestão da Shopee (exports export_return_order_*.csv).

export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // BOM
  const rows: string[][] = []
  let row: string[] = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ",") {
      row.push(cur)
      cur = ""
    } else if (c === "\n") {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ""
    } else if (c !== "\r") cur += c
  }
  if (cur !== "" || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

/** Header que parece guardar CEP (cep / postal code / zip). */
export const CEP_HEADER_RE = /cep|postal|zip/i

/** Extrai 8 dígitos de um valor de CEP. null se não tiver 8 dígitos. */
export function cepDigits(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D+/g, "")
  return d.length === 8 ? d : null
}

/** Acha o 1º valor de CEP válido num registro {header: valor}. */
export function pickCep(o: Record<string, string>): string | null {
  for (const k of Object.keys(o)) {
    if (CEP_HEADER_RE.test(k)) {
      const cep = cepDigits(o[k])
      if (cep) return cep
    }
  }
  return null
}

/** Lê CSV como lista de objetos {header: valor}. Header = 1ª linha. */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  if (!rows.length) return []
  const header = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {}
    header.forEach((h, i) => (o[h] = (r[i] ?? "").trim()))
    return o
  })
}

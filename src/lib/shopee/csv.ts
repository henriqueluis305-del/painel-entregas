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

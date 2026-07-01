"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCopyIcon,
  SearchIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type PnrPackageRow } from "@/lib/shopee/pnr-queries"

const PAGE_SIZE = 50

const brl = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

/** "2026-06-22T15:59:00.000Z" → "22/06/2026 15:59" — ecoa o horário exato da
 *  planilha (a Shopee já exporta no fuso correto); sem conversão de fuso. */
function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso)
  if (!m) return "—"
  const [, y, mo, d, h, mi] = m
  return `${d}/${mo}/${y} ${h}:${mi}`
}

export function PnrPackageTable({ rows }: { rows: PnrPackageRow[] }) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.spxtn.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q),
    )
  }, [rows, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const ids = useMemo(() => filtered.map((r) => r.spxtn), [filtered])

  async function copyIds() {
    try {
      await navigator.clipboard.writeText(ids.join("\n"))
      toast.success(`${ids.length} IDs copiados`, { description: "Cole com Ctrl+V onde quiser." })
    } catch {
      toast.error("Não foi possível copiar", { description: "Permita o acesso ao clipboard." })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0) }}
            placeholder="Buscar por SPXTN ou motorista…"
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={copyIds} disabled={!ids.length}>
          <ClipboardCopyIcon className="size-4" />
          Copiar IDs ({ids.length})
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">SPXTN</TableHead>
              <TableHead className="border-l text-center font-semibold">Motorista</TableHead>
              <TableHead className="border-l text-center font-semibold">Base</TableHead>
              <TableHead className="border-l text-center font-semibold">Status</TableHead>
              <TableHead className="border-l text-center font-semibold">Valor</TableHead>
              <TableHead className="border-l text-center font-semibold">Criada em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  Nenhum pacote encontrado.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => (
                <TableRow key={r.spxtn}>
                  <TableCell className="font-mono text-xs">{r.spxtn}</TableCell>
                  <TableCell className="border-l text-center text-sm">{r.driverName}</TableCell>
                  <TableCell className="border-l text-center text-sm">
                    {r.baseLabel ?? <span className="text-muted-foreground italic">Sem base</span>}
                  </TableCell>
                  <TableCell className="border-l text-center">
                    <Badge variant="outline" className="font-normal">{r.statusPt}</Badge>
                  </TableCell>
                  <TableCell className="border-l text-center tabular-nums text-sm">{brl(r.valor)}</TableCell>
                  <TableCell className="border-l text-center tabular-nums text-xs">{fmtDate(r.createdTime)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm">{filtered.length} pacote(s)</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Página {safePage + 1} de {pageCount}</span>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

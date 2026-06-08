"use client"

import { useMemo, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DsRow } from "@/lib/shopee/ds-queries"

const PAGE_SIZE = 25

function pct(entregues: number, saiu: number) {
  return saiu > 0 ? Math.round((entregues / saiu) * 100) : 0
}

export function DsTable({ rows }: { rows: DsRow[] }) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.driver_name.toLowerCase().includes(q) ||
        (r.driver_id ?? "").includes(q),
    )
  }, [rows, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative sm:max-w-xs">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          placeholder="Buscar motorista…"
          className="pl-8"
        />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Motorista</TableHead>
              <TableHead className="text-right">Saiu</TableHead>
              <TableHead className="text-right">Entregues</TableHead>
              <TableHead className="text-right">Em rota</TableHead>
              <TableHead className="text-right">Ocorrências</TableHead>
              <TableHead className="text-right">DS%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  Nenhum motorista encontrado.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => {
                const p = pct(r.entregues, r.saiu)
                return (
                  <TableRow key={`${r.base_slug}-${r.driver_id}`}>
                    <TableCell className="max-w-[260px] truncate">
                      <span className="text-muted-foreground">[{r.driver_id}]</span>{" "}
                      {r.driver_name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.saiu}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-500">
                      {r.entregues}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.em_rota}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-500">
                      {r.ocorrencias}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {p}%
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm">
          {filtered.length} motorista(s)
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            Página {safePage + 1} de {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

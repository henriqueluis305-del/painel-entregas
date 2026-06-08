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
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { StuckRow } from "@/lib/shopee/stuck-queries"
import { DELIVERED_STATUS } from "@/lib/shopee/stuck"

const PAGE_SIZE = 50

function isDelivered(r: StuckRow) {
  return r.delivered_at != null || r.status === DELIVERED_STATUS
}

export function StuckTable({ rows }: { rows: StuckRow[] }) {
  const [query, setQuery] = useState("")
  const [hideDelivered, setHideDelivered] = useState(true)
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (hideDelivered && isDelivered(r)) return false
      if (!q) return true
      return (
        r.codigo.toLowerCase().includes(q) ||
        (r.driver_name ?? "").toLowerCase().includes(q) ||
        (r.driver_id ?? "").toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        r.base_label.toLowerCase().includes(q) ||
        (r.agency ?? "").toLowerCase().includes(q)
      )
    })
  }, [rows, query, hideDelivered])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  // IDs em stuck (não entregues) — independe de busca/paginação.
  const stuckIds = useMemo(
    () => rows.filter((r) => !isDelivered(r)).map((r) => r.codigo),
    [rows],
  )

  async function copyIds() {
    try {
      await navigator.clipboard.writeText(stuckIds.join("\n"))
      toast.success(`${stuckIds.length} IDs copiados`, {
        description: "Cole com Ctrl+V onde quiser.",
      })
    } catch {
      toast.error("Não foi possível copiar", {
        description: "Permita o acesso ao clipboard no navegador.",
      })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar código, motorista, status…"
            className="pl-8"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={hideDelivered}
            onCheckedChange={(c) => {
              setHideDelivered(c === true)
              setPage(0)
            }}
          />
          Esconder entregues
        </label>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={copyIds}
          disabled={!stuckIds.length}
        >
          <ClipboardCopyIcon className="size-4" />
          Copiar IDs ({stuckIds.length})
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Dias</TableHead>
              <TableHead>Motorista</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Agency</TableHead>
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
                <TableRow key={`${r.base_slug}-${r.codigo}`}>
                  <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                  <TableCell>
                    <Badge
                      variant={isDelivered(r) ? "secondary" : "outline"}
                      className="font-normal"
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.dias_preso == null ? "—" : Math.floor(r.dias_preso)}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {r.driver_name ? (
                      <span>
                        <span className="text-muted-foreground">[{r.driver_id}]</span>{" "}
                        {r.driver_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.base_label}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {r.agency ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm">
          {filtered.length} pacote(s)
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

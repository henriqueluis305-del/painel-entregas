"use client"

import { useState } from "react"
import { CheckIcon, ChevronRightIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { SlaCidadeRow, SlaOutrosCidade } from "@/lib/shopee/cidade-queries"

const n = (v: number) => v.toLocaleString("pt-BR")
const cidadeLabel = (c: string) => c || "Sem cidade"

/**
 * Tabela por cidade do SLA. A coluna "Outros" é clicável e abre os pacotes
 * desse balde agrupados por cidade; ao abrir uma cidade vê-se a lista de
 * códigos BR com botão de copiar.
 */
export function SlaCidadeTable({
  rows,
  outros,
}: {
  rows: SlaCidadeRow[]
  outros: SlaOutrosCidade[]
}) {
  const [open, setOpen] = useState(false)

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Nenhuma cidade visível. Ligue cidades na aba Config.
      </p>
    )
  }

  const sum = rows.reduce(
    (a, r) => ({
      total: a.total + r.total,
      entregues: a.entregues + r.entregues,
      emRota: a.emRota + r.emRota,
      insucessos: a.insucessos + r.insucessos,
      outros: a.outros + r.outros,
    }),
    { total: 0, entregues: 0, emRota: 0, insucessos: 0, outros: 0 },
  )

  const outrosTotal = outros.reduce((a, c) => a + c.total, 0)
  const canDrill = outrosTotal > 0

  const outrosTrigger = (children: React.ReactNode, className?: string) =>
    canDrill ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "underline decoration-dotted underline-offset-4 hover:text-foreground",
          className,
        )}
        title="Ver os pacotes de Outros por cidade"
      >
        {children}
      </button>
    ) : (
      <span className={className}>{children}</span>
    )

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cidade</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Entregue</TableHead>
              <TableHead className="text-right">Em rota</TableHead>
              <TableHead className="text-right">Insucessos</TableHead>
              <TableHead className="text-right">{outrosTrigger("Outros")}</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.cidade}>
                <TableCell className="font-medium">{r.cidade}</TableCell>
                <TableCell className="text-right tabular-nums">{n(r.total)}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-500">{n(r.entregues)}</TableCell>
                <TableCell className="text-right tabular-nums">{n(r.emRota)}</TableCell>
                <TableCell className="text-right tabular-nums text-red-500">{n(r.insucessos)}</TableCell>
                <TableCell className="text-right tabular-nums">{n(r.outros)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{r.pct}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="text-muted-foreground text-xs">Cidades visíveis</TableCell>
              <TableCell className="text-right tabular-nums">{n(sum.total)}</TableCell>
              <TableCell className="text-right tabular-nums">{n(sum.entregues)}</TableCell>
              <TableCell className="text-right tabular-nums">{n(sum.emRota)}</TableCell>
              <TableCell className="text-right tabular-nums">{n(sum.insucessos)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {outrosTrigger(n(sum.outros), "font-medium")}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {sum.total ? Number(((sum.entregues / sum.total) * 100).toFixed(1)) : 0}%
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Outros por cidade</DialogTitle>
            <DialogDescription>
              Pacotes que não são Entregue, Em rota nem Ocorrência
              ({n(outrosTotal)} no total). Clique numa cidade para ver e copiar os IDs.
            </DialogDescription>
          </DialogHeader>
          <OutrosPorCidade cidades={outros} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function OutrosPorCidade({ cidades }: { cidades: SlaOutrosCidade[] }) {
  const [aberta, setAberta] = useState<string | null>(null)

  if (cidades.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">Nada em Outros.</p>
  }

  return (
    <div className="max-h-[60vh] divide-y overflow-auto rounded-lg border">
      {cidades.map((c) => {
        const isOpen = aberta === c.cidade
        return (
          <div key={c.cidade}>
            <button
              type="button"
              onClick={() => setAberta(isOpen ? null : c.cidade)}
              className="hover:bg-muted/60 flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
            >
              <ChevronRightIcon
                className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-90")}
              />
              <span className="flex-1 font-medium">{cidadeLabel(c.cidade)}</span>
              <span className="text-muted-foreground tabular-nums">{n(c.total)}</span>
            </button>
            {isOpen && <CidadeItens cidade={c} />}
          </div>
        )
      })}
    </div>
  )
}

function CidadeItens({ cidade }: { cidade: SlaOutrosCidade }) {
  const [copied, setCopied] = useState(false)
  const codigos = cidade.itens.map((i) => i.codigo)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigos.join("\n"))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard indisponível */
    }
  }

  return (
    <div className="bg-muted/30 flex flex-col gap-2 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">{n(codigos.length)} ID(s)</span>
        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={copiar}>
          {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          {copied ? "Copiado!" : "Copiar IDs"}
        </Button>
      </div>
      <div className="max-h-48 overflow-auto rounded-md border bg-background">
        <ul className="divide-y font-mono text-xs">
          {cidade.itens.map((i) => (
            <li key={i.codigo} className="flex items-center justify-between gap-2 px-2 py-1">
              <span className="truncate">{i.codigo}</span>
              <span className="text-muted-foreground shrink-0 font-sans">{i.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

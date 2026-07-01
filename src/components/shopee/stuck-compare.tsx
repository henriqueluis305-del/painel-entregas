"use client"

import { useMemo, useState } from "react"
import { CheckIcon, ListPlusIcon, SearchIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StuckRangeTable } from "@/components/shopee/stuck-range-table"
import { cn } from "@/lib/utils"
import { diasToRange, isPackageDelivered, stuckDimValue } from "@/lib/shopee/stuck"
import type { StuckDim, StuckRow } from "@/lib/shopee/stuck"

const DIM_SINGULAR: Record<StuckDim, string> = {
  base: "Base",
  status: "Status",
  cidade: "Cidade",
  bairro: "Bairro",
}
const DIM_PLURAL: Record<StuckDim, string> = {
  base: "bases",
  status: "status",
  cidade: "cidades",
  bairro: "bairros",
}

/**
 * Modo comparação: escolhe uma dimensão (cidade/bairro/base) e várias chaves
 * dela; renderiza um pivô status×range por chave, empilhados, pra comparar.
 * Default depende do contexto: base única → compara cidades; várias → compara bases.
 */
export function StuckCompare({
  rows,
  singleBase,
  menuOpen,
  onMenuOpenChange,
}: {
  rows: StuckRow[]
  singleBase: boolean
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}) {
  const dimChoices: StuckDim[] = singleBase ? ["cidade", "bairro"] : ["base", "cidade", "bairro"]
  const [dim, setDim] = useState<StuckDim>(singleBase ? "cidade" : "base")
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const open = menuOpen

  // Valores distintos da dimensão (só stuck ativo) + contagem, ordenados por volume.
  const options = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      if (isPackageDelivered(r)) continue
      if (!diasToRange(r.dias_preso)) continue
      const k = stuckDimValue(r, dim)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "pt-BR"))
  }, [rows, dim])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.value.toLowerCase().includes(q)) : options
  }, [options, query])

  function changeDim(d: StuckDim) {
    if (d === dim) return
    setDim(d)
    setSelected([])
    setQuery("")
  }

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border p-3">
        {/* Dimensão a comparar */}
        {dimChoices.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">Comparar por:</span>
            {dimChoices.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={d === dim ? "secondary" : "ghost"}
                onClick={() => changeDim(d)}
              >
                {DIM_SINGULAR[d]}
              </Button>
            ))}
          </div>
        )}

        {/* Gatilho do menu de seleção + chips dos selecionados */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onMenuOpenChange(!open)}>
            <ListPlusIcon className="size-4" />
            Selecionar {DIM_PLURAL[dim]}
            {selected.length > 0 && (
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {selected.length}
              </Badge>
            )}
          </Button>
          {selected.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1 font-normal">
              {v}
              <button
                type="button"
                onClick={() => toggle(v)}
                className="hover:bg-foreground/10 rounded-sm p-0.5"
                aria-label={`Remover ${v}`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          {selected.length > 0 && (
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setSelected([])}>
              Limpar
            </Button>
          )}
        </div>

        {/* Menu de busca/seleção */}
        {open && (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Buscar ${DIM_PLURAL[dim]}…`}
                className="pl-8"
              />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border">
              {filtered.length === 0 ? (
                <div className="text-muted-foreground p-3 text-center text-sm">
                  Nada encontrado.
                </div>
              ) : (
                filtered.map((o) => {
                  const isSel = selected.includes(o.value)
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggle(o.value)}
                      className={cn(
                        "hover:bg-accent flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm",
                        isSel && "bg-accent/50",
                      )}
                    >
                      <span className={cn("flex size-4 items-center justify-center rounded border", isSel ? "bg-primary border-primary text-primary-foreground" : "border-input")}>
                        {isSel && <CheckIcon className="size-3" />}
                      </span>
                      <span className="flex-1 truncate">{o.value}</span>
                      <span className="text-muted-foreground tabular-nums">{o.count}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabelas empilhadas, uma por chave selecionada */}
      {selected.length === 0 ? (
        <div className="text-muted-foreground flex h-24 items-center justify-center text-sm">
          Selecione {DIM_PLURAL[dim]} acima para comparar.
        </div>
      ) : (
        selected.map((value) => {
          const subset = rows.filter((r) => stuckDimValue(r, dim) === value)
          return (
            <section key={value} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold tracking-wide">
                <span className="text-muted-foreground">{DIM_SINGULAR[dim]}: </span>
                {value}
              </h3>
              <StuckRangeTable rows={subset} dimension="status" rowKeyLabel="STATUS" />
            </section>
          )
        })
      )}
    </div>
  )
}

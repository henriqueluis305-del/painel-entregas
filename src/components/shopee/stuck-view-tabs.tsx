"use client"

import { useMemo, useState } from "react"
import { ChevronDownIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StuckCompare } from "@/components/shopee/stuck-compare"
import { StuckRangeTable } from "@/components/shopee/stuck-range-table"
import { StuckTable } from "@/components/shopee/stuck-table"
import { diasToRange, isPackageDelivered, stuckDimValue } from "@/lib/shopee/stuck"
import type { StuckDim, StuckRange, StuckRow } from "@/lib/shopee/stuck"

/** Recorte ativo do pivô (ex.: clicou numa cidade → só pacotes daquela cidade). */
type StuckScope = { dim: StuckDim; value: string }

/** Drill-down disparado por clique numa célula do pivô. */
export type StuckDrill = {
  mode: StuckDim
  key: string | null // null = todas as linhas (ex.: clicou no total da coluna)
  range: StuckRange | null // null = todas as faixas (ex.: clicou no total da linha)
  scope?: StuckScope // recorte herdado do pivô (ex.: dentro de uma cidade)
}

// Rótulos por dimensão (label do botão, cabeçalho da coluna e texto do drill).
const DIM_TAB_LABEL: Record<StuckDim, string> = {
  base: "Por Base",
  status: "Por Status",
  cidade: "Por Cidade",
  bairro: "Por Bairro",
}
const DIM_HEAD: Record<StuckDim, string> = {
  base: "BASE",
  status: "STATUS",
  cidade: "CIDADE",
  bairro: "BAIRRO",
}
const DIM_ALL: Record<StuckDim, string> = {
  base: "todas as bases",
  status: "todos os status",
  cidade: "todas as cidades",
  bairro: "todos os bairros",
}

// Rótulo amigável de uma dimensão no singular (para chips de recorte).
const DIM_SINGULAR: Record<StuckDim, string> = {
  base: "Base",
  status: "Status",
  cidade: "Cidade",
  bairro: "Bairro",
}

function drillLabel(d: StuckDrill): string {
  const linha = d.key ?? DIM_ALL[d.mode]
  const faixa = d.range ? `range ${d.range}` : "todas as faixas"
  const recorte = d.scope ? `${DIM_SINGULAR[d.scope.dim]} ${d.scope.value} · ` : ""
  return `${recorte}${linha} · ${faixa}`
}

export function StuckViewTabs({ rows }: { rows: StuckRow[] }) {
  const [tab, setTab] = useState("por-base")
  const [drill, setDrill] = useState<StuckDrill | null>(null)
  const [dimOverride, setDimOverride] = useState<StuckDim | null>(null)
  const [scope, setScope] = useState<StuckScope | null>(null)
  const [compareMenuOpen, setCompareMenuOpen] = useState(true)

  // Base única filtrada → visão padrão por status. Senão → por base.
  const singleBase = useMemo(() => {
    const bases = new Set<string>()
    for (const r of rows) {
      if (isPackageDelivered(r)) continue
      if (diasToRange(r.dias_preso)) bases.add(r.base_label)
    }
    return bases.size <= 1
  }, [rows])

  // "Por Base" só faz sentido com mais de uma base; status/cidade/bairro sempre.
  const dimOptions: StuckDim[] = singleBase
    ? ["status", "cidade", "bairro"]
    : ["base", "status", "cidade", "bairro"]
  const autoDim: StuckDim = singleBase ? "status" : "base"
  const dim = dimOverride && dimOptions.includes(dimOverride) ? dimOverride : autoDim

  // Linhas do pivô, recortadas pela cidade/bairro escolhido (quando há escopo).
  const pivotRows = useMemo(
    () => (scope ? rows.filter((r) => stuckDimValue(r, scope.dim) === scope.value) : rows),
    [rows, scope],
  )

  // Clique no nome de uma cidade/bairro → re-tabula por status, recortado nela.
  function handleRowClick(key: string) {
    setScope({ dim, value: key })
    setDimOverride("status")
  }

  function clearScope() {
    if (scope) setDimOverride(scope.dim)
    setScope(null)
  }

  function pickDimension(d: StuckDim) {
    setScope(null)
    setDimOverride(d)
    setTab("por-base")
  }

  function handleCellClick(d: StuckDrill) {
    setDrill(scope ? { ...d, scope } : d)
    setTab("detalhe")
  }

  const detailRows = useMemo(() => {
    if (!drill) return rows
    return rows.filter((r) => {
      if (isPackageDelivered(r)) return false
      const rg = diasToRange(r.dias_preso)
      if (!rg) return false
      if (drill.range && rg !== drill.range) return false
      if (drill.key != null && stuckDimValue(r, drill.mode) !== drill.key) return false
      if (drill.scope && stuckDimValue(r, drill.scope.dim) !== drill.scope.value) return false
      return true
    })
  }, [rows, drill])

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v)
        if (v === "comparar") setCompareMenuOpen(true) // entrar no modo já abre o menu
      }}
    >
      <TabsList>
        <DropdownMenu>
          <DropdownMenuTrigger render={<TabsTrigger value="por-base" />}>
            {DIM_TAB_LABEL[dim]}
            <ChevronDownIcon className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={dim}
              onValueChange={(v) => pickDimension(v as StuckDim)}
            >
              {dimOptions.map((d) => (
                <DropdownMenuRadioItem key={d} value={d}>
                  {DIM_TAB_LABEL[d]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <TabsTrigger value="detalhe">Detalhe</TabsTrigger>
        <TabsTrigger
          value="comparar"
          onClick={() => {
            // Já no modo comparação → alterna só o menu de seleção (sem sair do modo).
            if (tab === "comparar") setCompareMenuOpen((o) => !o)
          }}
        >
          {singleBase ? "Comparar cidades" : "Comparar bases"}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="por-base">
        {scope && (
          <div className="bg-muted/50 mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground">{DIM_SINGULAR[scope.dim]}:</span>
            <span className="font-medium">{scope.value}</span>
            <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 px-2" onClick={clearScope}>
              <XIcon className="size-3.5" />
              Voltar
            </Button>
          </div>
        )}
        <StuckRangeTable
          rows={pivotRows}
          dimension={dim}
          rowKeyLabel={DIM_HEAD[dim]}
          onCellClick={handleCellClick}
          onRowClick={dim === "cidade" || dim === "bairro" ? handleRowClick : undefined}
        />
      </TabsContent>
      <TabsContent value="detalhe">
        {drill && (
          <div className="bg-muted/50 mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Filtrando pelo pivô:</span>
            <span className="font-medium">{drillLabel(drill)}</span>
            <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 px-2" onClick={() => setDrill(null)}>
              <XIcon className="size-3.5" />
              Limpar
            </Button>
          </div>
        )}
        <StuckTable rows={detailRows} />
      </TabsContent>
      <TabsContent value="comparar">
        <StuckCompare
          rows={rows}
          singleBase={singleBase}
          menuOpen={compareMenuOpen}
          onMenuOpenChange={setCompareMenuOpen}
        />
      </TabsContent>
    </Tabs>
  )
}

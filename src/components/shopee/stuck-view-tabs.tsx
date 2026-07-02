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
  scope?: StuckScope[] // recortes herdados do pivô (cadeia base → cidade → …)
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
  const recorte = d.scope?.length
    ? d.scope.map((s) => `${DIM_SINGULAR[s.dim]} ${s.value}`).join(" · ") + " · "
    : ""
  return `${recorte}${linha} · ${faixa}`
}

export function StuckViewTabs({ rows }: { rows: StuckRow[] }) {
  const [tab, setTab] = useState("por-base")
  const [drill, setDrill] = useState<StuckDrill | null>(null)
  const [dimOverride, setDimOverride] = useState<StuckDim | null>(null)
  const [scopeStack, setScopeStack] = useState<StuckScope[]>([])
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

  // Linhas do pivô, recortadas pela cadeia de escopos (ex.: base → cidade).
  const pivotRows = useMemo(
    () =>
      scopeStack.length
        ? rows.filter((r) => scopeStack.every((s) => stuckDimValue(r, s.dim) === s.value))
        : rows,
    [rows, scopeStack],
  )

  // Recorte atual é uma base (dim = cidade)? → mostramos também o status daquela
  // base numa segunda tabela, logo abaixo das cidades.
  const scopedBase =
    scopeStack.length > 0 && scopeStack[scopeStack.length - 1].dim === "base"
      ? scopeStack[scopeStack.length - 1]
      : null

  // Clique no nome de uma linha → aprofunda a visão, recortando por aquele valor:
  // base → cidades daquela base; cidade/bairro → status daquele recorte.
  function handleRowClick(key: string) {
    const nextDim: StuckDim = dim === "base" ? "cidade" : "status"
    setScopeStack((prev) => [...prev, { dim, value: key }])
    setDimOverride(nextDim)
  }

  // "Voltar" desfaz um nível do recorte, retornando ao pivô daquela dimensão.
  function popScope() {
    const last = scopeStack[scopeStack.length - 1]
    if (!last) return
    setDimOverride(last.dim)
    setScopeStack((prev) => prev.slice(0, -1))
  }

  function pickDimension(d: StuckDim) {
    setScopeStack([])
    setDimOverride(d)
    setTab("por-base")
  }

  function handleCellClick(d: StuckDrill) {
    setDrill(scopeStack.length ? { ...d, scope: scopeStack } : d)
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
      if (drill.scope && !drill.scope.every((s) => stuckDimValue(r, s.dim) === s.value)) return false
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
        {scopeStack.length > 0 && (
          <div className="bg-muted/50 mb-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
            {scopeStack.map((s, i) => (
              <span key={`${s.dim}-${s.value}`} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground">›</span>}
                <span className="text-muted-foreground">{DIM_SINGULAR[s.dim]}:</span>
                <span className="font-medium">{s.value}</span>
              </span>
            ))}
            <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 px-2" onClick={popScope}>
              <XIcon className="size-3.5" />
              Voltar
            </Button>
          </div>
        )}
        {scopedBase && (
          <div className="text-muted-foreground mb-2 text-sm font-medium">Por cidade</div>
        )}
        <StuckRangeTable
          rows={pivotRows}
          dimension={dim}
          rowKeyLabel={DIM_HEAD[dim]}
          onCellClick={handleCellClick}
          onRowClick={dim === "status" ? undefined : handleRowClick}
        />
        {scopedBase && (
          <div className="mt-6">
            <div className="text-muted-foreground mb-2 text-sm font-medium">Por status</div>
            <StuckRangeTable
              rows={pivotRows}
              dimension="status"
              rowKeyLabel={DIM_HEAD.status}
              onCellClick={handleCellClick}
            />
          </div>
        )}
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

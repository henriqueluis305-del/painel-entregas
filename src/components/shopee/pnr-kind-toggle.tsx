"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { PnrKind } from "@/lib/shopee/pnr-queries"

/**
 * Alterna o painel de PNR entre XPT, HUB ou ambos. Grava `tipo` na URL
 * (ausente = ambos); o servidor aplica o filtro a TUDO — KPIs, tabelas,
 * motoristas e pacotes. Sempre fica ao menos um lado ativo.
 */
export function PnrKindToggle({ value }: { value: PnrKind }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // "both" → ambos os pills ativos; senão só o lado selecionado.
  const active = value === "both" ? ["xpt", "hub"] : [value]

  const onChange = useCallback(
    (next: string[]) => {
      // Deselecionar o último ativo cairia em "nenhum" — ignora (mantém o atual).
      if (next.length === 0) return
      const kind: PnrKind = next.length >= 2 ? "both" : (next[0] as PnrKind)
      const params = new URLSearchParams(searchParams.toString())
      if (kind === "both") params.delete("tipo")
      else params.set("tipo", kind)
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams],
  )

  return (
    <ToggleGroup
      multiple
      value={active}
      onValueChange={onChange}
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Filtrar por XPT ou HUB"
    >
      <ToggleGroupItem value="xpt" className="px-3">
        XPT
      </ToggleGroupItem>
      <ToggleGroupItem value="hub" className="px-3">
        HUB
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

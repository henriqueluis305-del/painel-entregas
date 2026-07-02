"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type ResultadosVisao = "semanal" | "mensal"

/** Alterna a aba Resultados entre pivô por dia (Semanal) e por semana (Mensal). Grava `visao` na URL. */
export function ResultadosViewToggle({ value }: { value: ResultadosVisao }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = useCallback(
    (next: string[]) => {
      // Deselecionar o único ativo cairia em "nenhum" — ignora (mantém o atual).
      if (next.length === 0) return
      const visao = next[0] as ResultadosVisao
      const params = new URLSearchParams(searchParams.toString())
      if (visao === "semanal") params.delete("visao")
      else params.set("visao", visao)
      params.delete("semana")
      params.delete("mes")
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams],
  )

  return (
    <ToggleGroup
      value={[value]}
      onValueChange={onChange}
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Visão semanal ou mensal"
    >
      <ToggleGroupItem value="semanal" className="px-3">
        Semanal
      </ToggleGroupItem>
      <ToggleGroupItem value="mensal" className="px-3">
        Mensal
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

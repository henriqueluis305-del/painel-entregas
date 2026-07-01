"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarRangeIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { weekLabel, weekRange } from "@/lib/shopee/pnr-week"

const ALL = "__all__"

/**
 * Seletor de foco de semana (modo Semanal do PNR). Escolher uma semana escreve
 * `semana` na URL; o servidor re-escopa apenas KPIs, motoristas e pacotes para
 * ela. "Todas as semanas" remove o parâmetro e volta à janela de 4 semanas.
 */
export function PnrWeekSelect({
  weeks,
  value,
}: {
  weeks: string[]
  /** Semana em foco ("YYYY-MM-DD") ou null quando exibindo todas. */
  value: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = useCallback(
    (v: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!v || v === ALL) params.delete("semana")
      else params.set("semana", v)
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams],
  )

  if (weeks.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <CalendarRangeIcon className="text-muted-foreground size-4" />
      <Select value={value ?? ALL} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-[220px]">
          <SelectValue placeholder="Semana" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as semanas ({weeks.length})</SelectItem>
          {weeks.map((w) => (
            <SelectItem key={w} value={w}>
              {weekLabel(w)} · {weekRange(w)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

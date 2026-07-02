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

/**
 * Seletor de semana da aba Resultados — troca as colunas de data das duas
 * tabelas (SLA e DS). Ao contrário do `PnrWeekSelect`, sempre tem uma semana
 * selecionada (o pivô precisa de 7 colunas fixas, não faz sentido "todas").
 */
export function ResultadosWeekSelect({
  weeks,
  value,
}: {
  weeks: string[]
  /** Semana em foco ("YYYY-MM-DD", segunda-feira). */
  value: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = useCallback(
    (v: string | null) => {
      if (!v) return
      const params = new URLSearchParams(searchParams.toString())
      params.set("semana", v)
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams],
  )

  return (
    <div className="flex items-center gap-2">
      <CalendarRangeIcon className="text-muted-foreground size-4" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-[220px]">
          <SelectValue placeholder="Semana" />
        </SelectTrigger>
        <SelectContent>
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

"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

function monthLabel(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** Seletor de mês da visão Mensal — define de qual mês vêm as (até 4) semanas mostradas. */
export function ResultadosMonthSelect({
  months,
  value,
}: {
  months: string[]
  /** Mês em foco ("YYYY-MM"). */
  value: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = useCallback(
    (v: string | null) => {
      if (!v) return
      const params = new URLSearchParams(searchParams.toString())
      params.set("mes", v)
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams],
  )

  return (
    <div className="flex items-center gap-2">
      <CalendarIcon className="text-muted-foreground size-4" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-[180px]">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={m}>
              {monthLabel(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

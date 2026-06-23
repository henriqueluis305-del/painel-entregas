"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BuildingIcon, CalendarIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OpLite } from "@/lib/live-queries"

export function LiveSelectors({
  operacoes,
  currentOp,
  days,
  currentDia,
}: {
  operacoes: OpLite[]
  currentOp: string
  days: string[]
  currentDia: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  function go(patch: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    const qs = p.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <BuildingIcon className="text-muted-foreground size-4" />
        <Select
          value={currentOp}
          onValueChange={(v) => v && go({ op: v, dia: null })} // troca op → reseta dia
          disabled={operacoes.length <= 1}
        >
          <SelectTrigger size="sm" className="w-[200px]">
            <SelectValue placeholder="Operação" />
          </SelectTrigger>
          <SelectContent>
            {operacoes.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <CalendarIcon className="text-muted-foreground size-4" />
        <Select
          value={currentDia}
          onValueChange={(v) => v && go({ dia: v })}
          disabled={days.length === 0}
        >
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue placeholder="Dia" />
          </SelectTrigger>
          <SelectContent>
            {days.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

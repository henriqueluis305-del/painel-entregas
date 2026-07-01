"use client"

import { useState } from "react"

import { Uploader } from "@/components/shopee/uploader"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ShopeeBaseOption } from "@/lib/shopee"

/** Uploads de SLA e DS com um único seletor de base, compartilhado pelos dois. */
export function MonitoramentoUploads({
  bases,
  canSla,
  canDs,
}: {
  bases: ShopeeBaseOption[]
  canSla: boolean
  canDs: boolean
}) {
  const [base, setBase] = useState("")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Base do export</span>
        <Select value={base} onValueChange={(v) => setBase(v ?? "")}>
          <SelectTrigger size="sm" className="w-[260px]">
            <SelectValue placeholder="Escolha a base (vale p/ SLA e DS)" />
          </SelectTrigger>
          <SelectContent>
            {bases.map((b) => (
              <SelectItem key={b.slug} value={b.slug}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {canSla && (
          <Uploader
            kind="sla"
            label="SLA"
            description="CSV export_return_order. O arquivo inteiro conta para a base escolhida acima; a cidade vem do CEP."
            accept=".csv"
            needsBase
            fixedBase={base}
          />
        )}
        {canDs && (
          <Uploader
            kind="ds"
            label="DS (fleets)"
            description="xlsx de DS por motorista. Todas as linhas contam para a base escolhida acima. Cada upload vira um ponto no Crescimento DS."
            accept=".xlsx"
            needsBase
            fixedBase={base}
          />
        )}
      </div>
    </div>
  )
}

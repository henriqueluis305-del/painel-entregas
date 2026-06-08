"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Switch } from "@/components/ui/switch"
import { setStuckDailyReset } from "@/app/dashboard/operacao/shopee/config/actions"

export function StuckDailyResetToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial)
  const [pending, startTransition] = useTransition()

  function onChange(next: boolean) {
    const prev = enabled
    setEnabled(next) // otimista
    startTransition(async () => {
      try {
        await setStuckDailyReset(next)
        toast.success(
          next ? "Limpeza diária ativada" : "Limpeza diária desativada",
        )
      } catch {
        setEnabled(prev) // reverte
        toast.error("Não foi possível salvar")
      }
    })
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="grid gap-1">
        <span className="text-sm font-medium">Limpeza diária da visão</span>
        <span className="text-muted-foreground text-sm">
          O painel mostra só o backlog do dia mais recente. Os dados antigos
          continuam no banco (nunca são apagados) — é só a visualização que
          “zera” a cada dia. Desligado, o painel mostra o acumulado.
        </span>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={(c) => onChange(c === true)}
        disabled={pending}
      />
    </div>
  )
}

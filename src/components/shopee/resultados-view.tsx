"use client"

import { useState } from "react"
import { LoaderCircleIcon } from "lucide-react"

import {
  getDsDriversForDay,
  getDsDriversForWeek,
} from "@/app/dashboard/operacao/shopee/resultados/actions"
import { DsTable } from "@/components/shopee/ds-table"
import {
  ResultadosPivotTable,
  type ResultadosPivotBase,
  type ResultadosPivotDay,
} from "@/components/shopee/resultados-pivot-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DsRow } from "@/lib/shopee/ds-queries"
import { addDaysIso, isoToBr } from "@/lib/shopee/pnr-week"

type Selected = { baseSlug: string; baseLabel: string; key: string }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg border px-3 py-2 text-center">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  )
}

/**
 * Junta as duas pivôs (SLA e DS) com o drill inline: clicar numa célula (de
 * qualquer uma das duas tabelas) mostra, abaixo, os motoristas de DS daquele
 * recorte — sempre DS, porque é quem tem detalhe por motorista (SLA não tem).
 * No modo Semanal o recorte é um dia; no Mensal é a semana inteira
 * (consolidado: total de pacotes + motoristas somados nos 7 dias, pior
 * primeiro). Clicar de novo na mesma célula fecha o painel.
 */
export function ResultadosView({
  operacaoId,
  mode,
  days,
  bases,
  slaValues,
  dsValues,
}: {
  operacaoId: string
  mode: "semanal" | "mensal"
  days: ResultadosPivotDay[]
  bases: ResultadosPivotBase[]
  slaValues: Map<string, number>
  dsValues: Map<string, number>
}) {
  const [selected, setSelected] = useState<Selected | null>(null)
  const [drivers, setDrivers] = useState<DsRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openCell(baseSlug: string, baseLabel: string, key: string) {
    if (selected?.baseSlug === baseSlug && selected?.key === key) {
      setSelected(null)
      return
    }
    setSelected({ baseSlug, baseLabel, key })
    setLoading(true)
    setError(null)
    setDrivers([])
    const request =
      mode === "semanal"
        ? getDsDriversForDay({ operacaoId, baseSlugs: [baseSlug], day: key })
        : getDsDriversForWeek({ operacaoId, baseSlug, weekStart: key })
    request
      .then(setDrivers)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Não foi possível carregar os motoristas.")
      })
      .finally(() => setLoading(false))
  }

  const pivotSelected = selected ? { baseSlug: selected.baseSlug, day: selected.key } : null
  const consolidado =
    mode === "mensal" && drivers.length > 0
      ? drivers.reduce(
          (a, r) => ({ saiu: a.saiu + r.saiu, entregues: a.entregues + r.entregues }),
          { saiu: 0, entregues: 0 },
        )
      : null
  const referenceDay = selected
    ? mode === "semanal"
      ? selected.key
      : isoToBr(addDaysIso(selected.key, 6)) // âncora = domingo da semana consolidada
    : ""

  return (
    <div className="flex flex-col gap-4">
      <ResultadosPivotTable
        title="SLA"
        description={
          mode === "semanal"
            ? "% de entregues sobre o total, por base e dia."
            : "% de entregues sobre o total, por base e semana."
        }
        days={days}
        bases={bases}
        values={slaValues}
        selected={pivotSelected}
        onCellClick={openCell}
      />
      <ResultadosPivotTable
        title="DS"
        description={
          mode === "semanal"
            ? "% de entregues sobre encaminhados, por base e dia."
            : "% de entregues sobre encaminhados, por base e semana."
        }
        days={days}
        bases={bases}
        values={dsValues}
        selected={pivotSelected}
        onCellClick={openCell}
      />

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Motoristas{!loading && drivers.length ? ` (${drivers.length})` : ""}
            </CardTitle>
            <CardDescription>
              {selected.baseLabel} · {mode === "semanal" ? selected.key : `semana de ${isoToBr(selected.key)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loading && (
              <div className="text-muted-foreground flex min-h-[160px] items-center justify-center gap-2 text-sm">
                <LoaderCircleIcon className="size-4 animate-spin" />
                Carregando motoristas...
              </div>
            )}
            {!loading && error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
                {error}
              </div>
            )}
            {!loading && !error && drivers.length === 0 && (
              <p className="text-muted-foreground py-10 text-center text-sm">
                Nenhum motorista de DS registrado nesse recorte.
              </p>
            )}
            {!loading && !error && consolidado && (
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Encaminhados na semana" value={consolidado.saiu.toLocaleString("pt-BR")} />
                <Stat label="Entregues na semana" value={consolidado.entregues.toLocaleString("pt-BR")} />
                <Stat
                  label="DS% da semana"
                  value={`${consolidado.saiu ? Math.round((consolidado.entregues / consolidado.saiu) * 100) : 0}%`}
                />
              </div>
            )}
            {!loading && !error && drivers.length > 0 && (
              <DsTable
                key={`${mode}-${selected.baseSlug}-${selected.key}`}
                rows={drivers}
                operacaoId={operacaoId}
                baseSlugs={[selected.baseSlug]}
                referenceDay={referenceDay}
                initialSort={mode === "mensal" ? { key: "ds", dir: "asc" } : undefined}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

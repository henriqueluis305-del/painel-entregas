import { redirect } from "next/navigation"

import { DriverRanking } from "@/components/live/driver-ranking"
import { LiveSelectors } from "@/components/live/live-selectors"
import { HalfGauge } from "@/components/shopee/half-gauge"
import { SiteHeader } from "@/components/site-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getSessionProfile } from "@/lib/auth"
import {
  computeHealthcheck,
  getAllowedOperacoes,
  getAvailableDays,
  getDriverRanking,
  getDsDay,
  getSlaDay,
  type HealthLevel,
} from "@/lib/live-queries"

const DOT: Record<HealthLevel, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
}
const GERAL: Record<HealthLevel, { label: string; cls: string }> = {
  ok: { label: "Saudável", cls: "text-emerald-500" },
  warn: { label: "Atenção", cls: "text-amber-500" },
  bad: { label: "Crítico", cls: "text-red-500" },
}

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSessionProfile()
  if (!session) redirect("/login")
  if (!session.profile) redirect("/dashboard")

  const sp = await searchParams
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

  const { operacoes, defaultId } = await getAllowedOperacoes(session.profile)
  const op = operacoes.find((o) => o.id === pick(sp.op))?.id ?? defaultId

  if (!op) {
    return (
      <>
        <SiteHeader title="Visão 360" />
        <div className="text-muted-foreground p-6 text-sm">
          Você não tem nenhuma operação disponível.
        </div>
      </>
    )
  }

  const days = await getAvailableDays(op)
  const dia = days.includes(pick(sp.dia) ?? "") ? (pick(sp.dia) as string) : days[0]

  if (!dia) {
    return (
      <>
        <SiteHeader title="Visão 360" />
        <div className="flex flex-col gap-6 p-4 lg:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Visão 360 — Operação do dia</h2>
              <p className="text-muted-foreground text-sm">SLA, DS e saúde da operação.</p>
            </div>
            <LiveSelectors operacoes={operacoes} currentOp={op} days={days} currentDia="" />
          </div>
          <Card className="border-dashed">
            <CardContent className="text-muted-foreground py-12 text-center text-sm">
              Sem dados para esta operação ainda.
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const [sla, ds, ranking] = await Promise.all([
    getSlaDay(op, dia),
    getDsDay(op, dia),
    getDriverRanking(op, dia),
  ])
  const health = computeHealthcheck(sla, ds)

  return (
    <>
      <SiteHeader title="Visão 360" />
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Visão 360 — Operação do dia</h2>
            <p className="text-muted-foreground text-sm">SLA, DS e saúde da operação · {dia}</p>
          </div>
          <LiveSelectors operacoes={operacoes} currentOp={op} days={days} currentDia={dia} />
        </div>

        {/* Healthcheck */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              Saúde geral:
              <span className={GERAL[health.geral].cls}>{GERAL[health.geral].label}</span>
            </span>
            <div className="bg-border h-5 w-px" />
            {health.itens.map((it) => (
              <span key={it.label} className="flex items-center gap-2 text-sm">
                <span className={`size-2.5 rounded-full ${DOT[it.level]}`} />
                <span className="text-muted-foreground">{it.label}</span>
                <span className="font-medium tabular-nums">{it.value}</span>
              </span>
            ))}
          </CardContent>
        </Card>

        {/* SLA / DS */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SLA do dia</CardTitle>
              <CardDescription>entregues / total · {sla.total.toLocaleString("pt-BR")} pacotes</CardDescription>
            </CardHeader>
            <CardContent>
              <HalfGauge pct={sla.pct} sub={`${sla.entregues.toLocaleString("pt-BR")} entregues`} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">DS do dia</CardTitle>
              <CardDescription>entregues / encaminhados · {ds.motoristas} motoristas</CardDescription>
            </CardHeader>
            <CardContent>
              <HalfGauge pct={ds.pct} sub={`${ds.entregues.toLocaleString("pt-BR")} de ${ds.saiu.toLocaleString("pt-BR")}`} />
            </CardContent>
          </Card>
        </div>

        {/* Ranking de motoristas */}
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">Motoristas — ofensão & prejuízo</h3>
          <DriverRanking drivers={ranking} />
        </div>
      </div>
    </>
  )
}

import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRightIcon, ChartSplineIcon, TriangleAlertIcon } from "lucide-react"

import { HalfGauge } from "@/components/shopee/half-gauge"
import { SiteHeader } from "@/components/site-header"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
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

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSessionProfile()
  if (!session) redirect("/login")
  const nome = session.profile?.empresa || session.email || ""

  const { operacoes, defaultId } = session.profile
    ? await getAllowedOperacoes(session.profile)
    : { operacoes: [], defaultId: null }
  const sp = await searchParams
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const op = operacoes.find((o) => o.id === pick(sp.op))?.id ?? defaultId

  return (
    <>
      <SiteHeader title="Início" />
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-2xl font-bold">
            Bem-vindo, <span className="text-primary">{nome}</span>
          </h2>
          <p className="text-muted-foreground text-sm">Resumo do dia por operação.</p>
        </div>

        {operacoes.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Nenhuma operação liberada para você.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* navbar de operações */}
            <nav className="flex flex-wrap items-center gap-1 border-b">
              {operacoes.map((o) => {
                const active = o.id === op
                return (
                  <Link
                    key={o.id}
                    href={`/dashboard?op=${o.id}`}
                    className={cn(
                      "relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-primary text-foreground"
                        : "text-muted-foreground hover:text-foreground border-transparent",
                    )}
                  >
                    {o.label}
                  </Link>
                )
              })}
            </nav>

            {op && <OpResumo op={op} />}
          </>
        )}
      </div>
    </>
  )
}

async function OpResumo({ op }: { op: string }) {
  const days = await getAvailableDays(op)
  const dia = days[0]

  if (!dia) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <ChartSplineIcon className="text-muted-foreground size-8" />
          <div>
            <p className="font-medium">Sem dados desta operação ainda</p>
            <p className="text-muted-foreground text-sm">
              Importe planilhas em “SLA &amp; DS Hoje” para ver aqui.
            </p>
          </div>
          <Link href={`/dashboard/live?op=${op}`} className={buttonVariants({ size: "sm" })}>
            Ir para SLA &amp; DS Hoje
          </Link>
        </CardContent>
      </Card>
    )
  }

  const [sla, ds, ranking] = await Promise.all([
    getSlaDay(op, dia),
    getDsDay(op, dia),
    getDriverRanking(op, dia),
  ])
  const health = computeHealthcheck(sla, ds)

  return (
    <div className="flex flex-col gap-4">
      {/* healthcheck + link */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="text-sm font-medium">
            {dia} · <span className={GERAL[health.geral].cls}>{GERAL[health.geral].label}</span>
          </span>
          <div className="bg-border h-5 w-px" />
          {health.itens.map((it) => (
            <span key={it.label} className="flex items-center gap-2 text-sm">
              <span className={`size-2.5 rounded-full ${DOT[it.level]}`} />
              <span className="text-muted-foreground">{it.label}</span>
              <span className="font-medium tabular-nums">{it.value}</span>
            </span>
          ))}
          <Link
            href={`/dashboard/live?op=${op}`}
            className="text-primary ml-auto inline-flex items-center gap-1 text-sm hover:underline"
          >
            Ver completo <ArrowRightIcon className="size-3.5" />
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">SLA</CardTitle>
            <CardDescription>{sla.total.toLocaleString("pt-BR")} pacotes</CardDescription>
          </CardHeader>
          <CardContent>
            <HalfGauge pct={sla.pct} sub={`${sla.entregues.toLocaleString("pt-BR")} entregues`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">DS</CardTitle>
            <CardDescription>{ds.motoristas} motoristas</CardDescription>
          </CardHeader>
          <CardContent>
            <HalfGauge pct={ds.pct} sub={`${ds.entregues.toLocaleString("pt-BR")} de ${ds.saiu.toLocaleString("pt-BR")}`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Maiores ofensores</CardTitle>
            <CardDescription>por ocorrências do dia</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {ranking.slice(0, 4).map((d) => (
              <div key={d.driver_id} className="flex items-center gap-2 text-sm">
                <TriangleAlertIcon className="size-3.5 shrink-0 text-red-500" />
                <span className="truncate">{d.name}</span>
                <span className="ml-auto shrink-0 tabular-nums">
                  <span className="text-red-500 font-medium">{d.ocorrencias}</span>{" "}
                  <span className="text-muted-foreground">· DS {d.ds_pct}%</span>
                </span>
              </div>
            ))}
            {ranking.length === 0 && (
              <p className="text-muted-foreground text-sm">Sem motoristas no dia.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

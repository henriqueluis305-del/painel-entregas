import "server-only"

import { withPgClient } from "@/lib/pg"
import { pnrStatusPt } from "@/lib/shopee/pnr"

export type PnrStatusRow = { status: string; statusPt: string; count: number; valor: number }
export type PnrWeeklyEntry = {
  baseSlug: string | null
  baseLabel: string | null
  weekStart: string // "YYYY-MM-DD" (segunda-feira, horário de Brasília)
  total: number
  revertidas: number
  faturadas: number
}
export type PnrWeeklyData = {
  entries: PnrWeeklyEntry[]
  weeks: string[]
  bases: Array<{ slug: string | null; label: string | null }>
}
export type PnrDriverRow = {
  driverName: string
  count: number
  valor: number
  faturadas: number
  revertidas: number
}
export type PnrBaseRow = {
  baseSlug: string | null
  baseLabel: string | null
  count: number
  valor: number
  faturadas: number
  revertidas: number
  emAberto: number
}

export type PnrData = {
  total: number
  valorTotal: number
  revertidas: number
  faturadas: number
  emAberto: number
  motoristas: number
  porStatus: PnrStatusRow[]
  porMotorista: PnrDriverRow[]
  porBase: PnrBaseRow[]
}

const REVERSED = "Reversed"
const FOR_BILLING = "ForBilling"
const TZ = "America/Sao_Paulo"

/**
 * Traduz o valor do filtro de período para uma cláusula SQL sobre `created_time`.
 * Usa somente valores SQL fixos (current_date, now()) — sem interpolação de input.
 */
function periodClause(period: string, col = "created_time"): string {
  switch (period) {
    case "hoje":
      return `and date_trunc('day', ${col} at time zone '${TZ}') = current_date`
    case "ontem":
      return `and date_trunc('day', ${col} at time zone '${TZ}') = current_date - interval '1 day'`
    case "7d":
      return `and ${col} >= now() - interval '7 days'`
    case "30d":
      return `and ${col} >= now() - interval '30 days'`
    default: // "tudo" ou desconhecido → sem filtro
      return ""
  }
}

/** Agrega o conjunto de PNRs, opcionalmente filtrado por base slugs e período. */
export async function getPnrData(slugs: string[] = [], period = "tudo"): Promise<PnrData> {
  return withPgClient(async (c) => {
    const hasBase = slugs.length > 0
    // Returns an extra param placeholder at position n for the base slug array
    const bf = (n: number, alias = "") =>
      hasBase
        ? `and ${alias ? alias + "." : ""}base_id in (select id from base where slug = any($${n}::text[]))`
        : ""

    const pc = periodClause(period)
    const pcp = (alias: string) => periodClause(period, `${alias}.created_time`)

    // 1) Totais globais
    const tRow = (
      await c.query(
        `select count(*)::int                                     as total,
                coalesce(sum(valor),0)::float8                    as valor_total,
                count(*) filter (where status=$1)::int            as revertidas,
                count(*) filter (where status=$2)::int            as faturadas,
                count(distinct driver_id)::int                    as motoristas
         from shopee_pnr
         where 1=1 ${pc} ${bf(3)}`,
        hasBase ? [REVERSED, FOR_BILLING, slugs] : [REVERSED, FOR_BILLING],
      )
    ).rows[0] as {
      total: number
      valor_total: number
      revertidas: number
      faturadas: number
      motoristas: number
    }

    // 2) Por status
    const porStatus = (
      await c.query(
        `select status, count(*)::int as count, coalesce(sum(valor),0)::float8 as valor
         from shopee_pnr
         where 1=1 ${pc} ${bf(1)}
         group by status order by count desc`,
        hasBase ? [slugs] : [],
      )
    ).rows.map((r: { status: string; count: number; valor: number }) => ({
      status: r.status,
      statusPt: pnrStatusPt(r.status),
      count: r.count,
      valor: r.valor,
    }))

    // 3) Por motorista (top 200 por valor)
    const porMotorista = (
      await c.query(
        `select coalesce(max(driver_name), '—')           as driver_name,
                count(*)::int                              as count,
                coalesce(sum(valor),0)::float8             as valor,
                count(*) filter (where status=$1)::int     as revertidas,
                count(*) filter (where status=$2)::int     as faturadas
         from shopee_pnr
         where 1=1 ${pc} ${bf(3)}
         group by driver_id order by valor desc limit 200`,
        hasBase ? [REVERSED, FOR_BILLING, slugs] : [REVERSED, FOR_BILLING],
      )
    ).rows.map(
      (r: {
        driver_name: string
        count: number
        valor: number
        revertidas: number
        faturadas: number
      }) => ({
        driverName: r.driver_name,
        count: r.count,
        valor: r.valor,
        revertidas: r.revertidas,
        faturadas: r.faturadas,
      }),
    )

    // 4) Por base
    const porBase = (
      await c.query(
        `select b.slug                                             as base_slug,
                b.label                                            as base_label,
                count(p.spxtn)::int                               as count,
                coalesce(sum(p.valor),0)::float8                  as valor,
                count(p.spxtn) filter (where p.status=$1)::int   as revertidas,
                count(p.spxtn) filter (where p.status=$2)::int   as faturadas
         from shopee_pnr p
         left join base b on b.id = p.base_id
         where 1=1 ${pcp("p")} ${bf(3, "p")}
         group by b.slug, b.label order by count desc`,
        hasBase ? [REVERSED, FOR_BILLING, slugs] : [REVERSED, FOR_BILLING],
      )
    ).rows.map(
      (r: {
        base_slug: string | null
        base_label: string | null
        count: number
        valor: number
        revertidas: number
        faturadas: number
      }) => ({
        baseSlug: r.base_slug,
        baseLabel: r.base_label,
        count: r.count,
        valor: r.valor,
        revertidas: r.revertidas,
        faturadas: r.faturadas,
        emAberto: r.count - r.revertidas,
      }),
    )

    return {
      total: tRow.total,
      valorTotal: tRow.valor_total,
      revertidas: tRow.revertidas,
      faturadas: tRow.faturadas,
      emAberto: tRow.total - tRow.revertidas,
      motoristas: tRow.motoristas,
      porStatus,
      porMotorista,
      porBase,
    }
  })
}

/**
 * Agrega PNRs por semana (segunda-feira, horário de Brasília) × base.
 * Usado exclusivamente pelo modo "Semanal" — sem filtro de período (mostra tudo).
 */
export async function getPnrWeeklyData(slugs: string[] = []): Promise<PnrWeeklyData> {
  return withPgClient(async (c) => {
    const hasBase = slugs.length > 0
    const baseFilter = hasBase
      ? `and p.base_id in (select id from base where slug = any($3::text[]))`
      : ""

    // 4 semanas mais recentes nos dados (semana máxima − 3 semanas anteriores)
    const weekFilter = `
      and date_trunc('week', p.created_time at time zone '${TZ}')::date >= (
        select max(date_trunc('week', created_time at time zone '${TZ}')::date) - interval '3 weeks'
        from shopee_pnr
        where created_time is not null ${baseFilter.replace(/\bp\./g, "")}
      )`

    const raw = (
      await c.query(
        `select b.slug                                                           as base_slug,
                b.label                                                          as base_label,
                date_trunc('week', p.created_time at time zone '${TZ}')::date   as week_start,
                count(*)::int                                                    as total,
                count(*) filter (where p.status = $1)::int                      as revertidas,
                count(*) filter (where p.status = $2)::int                      as faturadas
         from shopee_pnr p
         left join base b on b.id = p.base_id
         where p.created_time is not null ${baseFilter} ${weekFilter}
         group by b.slug, b.label, week_start
         order by week_start, b.label nulls last`,
        hasBase ? [REVERSED, FOR_BILLING, slugs] : [REVERSED, FOR_BILLING],
      )
    ).rows as Array<{
      base_slug: string | null
      base_label: string | null
      week_start: string // pg retorna ::date como "YYYY-MM-DD"
      total: number
      revertidas: number
      faturadas: number
    }>

    const entries: PnrWeeklyEntry[] = raw.map((r) => ({
      baseSlug: r.base_slug,
      baseLabel: r.base_label,
      weekStart:
        typeof r.week_start === "string"
          ? r.week_start
          : (r.week_start as Date).toISOString().slice(0, 10),
      total: r.total,
      revertidas: r.revertidas,
      faturadas: r.faturadas,
    }))

    const weeks = [...new Set(entries.map((e) => e.weekStart))].sort()

    // Bases ordenadas por total decrescente
    const baseTotals = new Map<string, number>()
    const baseMeta = new Map<string, { slug: string | null; label: string | null }>()
    for (const e of entries) {
      const key = e.baseSlug ?? "__null__"
      baseTotals.set(key, (baseTotals.get(key) ?? 0) + e.total)
      if (!baseMeta.has(key)) baseMeta.set(key, { slug: e.baseSlug, label: e.baseLabel })
    }
    const bases = [...baseMeta.values()].sort(
      (a, b) => (baseTotals.get(b.slug ?? "__null__") ?? 0) - (baseTotals.get(a.slug ?? "__null__") ?? 0),
    )

    return { entries, weeks, bases }
  })
}

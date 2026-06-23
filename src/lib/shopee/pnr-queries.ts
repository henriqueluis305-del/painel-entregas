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
  driverId: string | null
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
const SP_OFFSET = "-03:00" // Brasil sem horário de verão desde 2019 — offset fixo

type PeriodRange = { from: Date | null; to: Date | null }

/** Início (UTC-3) do dia atual, voltando `daysAgo` dias; fim = início + 1 dia - 1ms. */
function spDayBounds(daysAgo = 0): PeriodRange {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date())
  const from = new Date(`${ymd}T00:00:00${SP_OFFSET}`)
  from.setUTCDate(from.getUTCDate() - daysAgo)
  return { from, to: new Date(from.getTime() + 86400000 - 1) }
}

/**
 * Resolve o filtro de período em um intervalo concreto [from, to] (UTC-3,
 * fuso de Brasília). `from`/`to` (quando usados) são datas "YYYY-MM-DD" vindas
 * da UI — sempre amarradas como parâmetro do pg, nunca interpoladas em SQL.
 */
function resolvePeriodRange(period: string, from?: string, to?: string): PeriodRange {
  if (period === "hoje") return spDayBounds(0)
  if (period === "ontem") return spDayBounds(1)
  if (period === "dia" && from) {
    const f = new Date(`${from}T00:00:00${SP_OFFSET}`)
    return { from: f, to: new Date(f.getTime() + 86400000 - 1) }
  }
  if (period === "intervalo" && from) {
    const f = new Date(`${from}T00:00:00${SP_OFFSET}`)
    const t = to ? new Date(`${to}T00:00:00${SP_OFFSET}`) : null
    return { from: f, to: t ? new Date(t.getTime() + 86400000 - 1) : null }
  }
  const dias = /^(\d+)d$/.exec(period)
  if (dias) return { from: new Date(Date.now() - Number(dias[1]) * 86400000), to: null }
  return { from: null, to: null } // "tudo" / "semanal" / desconhecido
}

/** `from`/`to` sempre como $1/$2 (timestamptz nulável) — uniforme em todas as queries. */
function rangeClause(col: string): string {
  return `and ($1::timestamptz is null or ${col} >= $1) and ($2::timestamptz is null or ${col} <= $2)`
}

/** Agrega o conjunto de PNRs, opcionalmente filtrado por base slugs e período. */
export async function getPnrData(
  slugs: string[] = [],
  period = "tudo",
  periodFrom?: string,
  periodTo?: string,
): Promise<PnrData> {
  return withPgClient(async (c) => {
    const hasBase = slugs.length > 0
    const range = resolvePeriodRange(period, periodFrom, periodTo)

    // 1) Totais globais
    const tParams: unknown[] = [range.from, range.to, REVERSED, FOR_BILLING]
    let tSql = `select count(*)::int                                     as total,
                coalesce(sum(valor),0)::float8                    as valor_total,
                count(*) filter (where status=$3)::int            as revertidas,
                count(*) filter (where status=$4)::int            as faturadas,
                count(distinct driver_id)::int                    as motoristas
         from shopee_pnr
         where 1=1 ${rangeClause("created_time")}`
    if (hasBase) {
      tParams.push(slugs)
      tSql += ` and base_id in (select id from base where slug = any($${tParams.length}::text[]))`
    }
    const tRow = (await c.query(tSql, tParams)).rows[0] as {
      total: number
      valor_total: number
      revertidas: number
      faturadas: number
      motoristas: number
    }

    // 2) Por status
    const sParams: unknown[] = [range.from, range.to]
    let sSql = `select status, count(*)::int as count, coalesce(sum(valor),0)::float8 as valor
         from shopee_pnr
         where 1=1 ${rangeClause("created_time")}`
    if (hasBase) {
      sParams.push(slugs)
      sSql += ` and base_id in (select id from base where slug = any($${sParams.length}::text[]))`
    }
    sSql += ` group by status order by count desc`
    const porStatus = (await c.query(sSql, sParams)).rows.map(
      (r: { status: string; count: number; valor: number }) => ({
        status: r.status,
        statusPt: pnrStatusPt(r.status),
        count: r.count,
        valor: r.valor,
      }),
    )

    // 3) Por motorista (top 200 por valor)
    const mParams: unknown[] = [range.from, range.to, REVERSED, FOR_BILLING]
    let mSql = `select driver_id,
                coalesce(max(driver_name), '—')           as driver_name,
                count(*)::int                              as count,
                coalesce(sum(valor),0)::float8             as valor,
                count(*) filter (where status=$3)::int     as revertidas,
                count(*) filter (where status=$4)::int     as faturadas
         from shopee_pnr
         where 1=1 ${rangeClause("created_time")}`
    if (hasBase) {
      mParams.push(slugs)
      mSql += ` and base_id in (select id from base where slug = any($${mParams.length}::text[]))`
    }
    mSql += ` group by driver_id order by valor desc limit 200`
    const porMotorista = (await c.query(mSql, mParams)).rows.map(
      (r: {
        driver_id: string | null
        driver_name: string
        count: number
        valor: number
        revertidas: number
        faturadas: number
      }) => ({
        driverId: r.driver_id,
        driverName: r.driver_name,
        count: r.count,
        valor: r.valor,
        revertidas: r.revertidas,
        faturadas: r.faturadas,
      }),
    )

    // 4) Por base
    const bParams: unknown[] = [range.from, range.to, REVERSED, FOR_BILLING]
    let bSql = `select b.slug                                             as base_slug,
                b.label                                            as base_label,
                count(p.spxtn)::int                               as count,
                coalesce(sum(p.valor),0)::float8                  as valor,
                count(p.spxtn) filter (where p.status=$3)::int   as revertidas,
                count(p.spxtn) filter (where p.status=$4)::int   as faturadas
         from shopee_pnr p
         left join base b on b.id = p.base_id
         where 1=1 ${rangeClause("p.created_time")}`
    if (hasBase) {
      bParams.push(slugs)
      bSql += ` and p.base_id in (select id from base where slug = any($${bParams.length}::text[]))`
    }
    bSql += ` group by b.slug, b.label order by count desc`
    const porBase = (await c.query(bSql, bParams)).rows.map(
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

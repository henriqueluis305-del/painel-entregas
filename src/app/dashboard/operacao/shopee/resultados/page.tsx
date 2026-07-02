import { BulkImportResultados } from "@/components/shopee/bulk-import-resultados"
import { ResultadosMonthSelect } from "@/components/shopee/resultados-month-select"
import type { ResultadosPivotDay } from "@/components/shopee/resultados-pivot-table"
import { ResultadosView } from "@/components/shopee/resultados-view"
import { ResultadosViewToggle, type ResultadosVisao } from "@/components/shopee/resultados-view-toggle"
import { ResultadosWeekSelect } from "@/components/shopee/resultados-week-select"
import { ShopeeSubtabShell } from "@/components/shopee/subtab-shell"
import { getSessionProfile } from "@/lib/auth"
import { getOperacaoBySlug } from "@/lib/queries"
import { effectiveBases, parseShopeeFilters, SHOPEE_SLUG } from "@/lib/shopee"
import { addDaysIso, isoToBr, mondaysInMonth, weekLabel, weekRange } from "@/lib/shopee/pnr-week"
import { getDsWeekEntries, getDsWeeklyPct, getDsWeeks } from "@/lib/shopee/ds-queries"
import { getSlaWeekEntries, getSlaWeeklyPct, getSlaWeeks } from "@/lib/shopee/sla-queries"

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

/** Segunda-feira (UTC) da semana atual — usada só quando ainda não há nenhum dado. */
function currentWeekStartIso(): string {
  const now = new Date()
  const dow = now.getUTCDay() // 0=domingo .. 6=sábado
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday))
  return monday.toISOString().slice(0, 10)
}

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const filters = parseShopeeFilters(sp)
  const [session, op] = await Promise.all([getSessionProfile(), getOperacaoBySlug(SHOPEE_SLUG)])
  const isAdmin = !!session?.profile?.is_admin
  const slugs = effectiveBases(filters)
  const visao: ResultadosVisao = pick(sp.visao) === "mensal" ? "mensal" : "semanal"

  const [slaWeeks, dsWeeks] = op
    ? await Promise.all([getSlaWeeks(op.id, slugs), getDsWeeks(op.id, slugs)])
    : [[], []]
  const weeks = [...new Set([...slaWeeks, ...dsWeeks])].sort((a, b) => (a < b ? 1 : -1))

  const bases = (op?.bases ?? [])
    .filter((b) => b.active && (slugs.length === 0 || slugs.includes(b.slug)))
    .map((b) => ({ slug: b.slug, label: b.label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))

  let days: ResultadosPivotDay[]
  let slaValues: Map<string, number>
  let dsValues: Map<string, number>
  let filterExtra: React.ReactNode

  if (visao === "mensal") {
    const months = [...new Set(weeks.map((w) => w.slice(0, 7)))]
    const mesParam = pick(sp.mes)
    const selectedMonth = mesParam && months.includes(mesParam) ? mesParam : (months[0] ?? currentWeekStartIso().slice(0, 7))
    const weekStarts = mondaysInMonth(selectedMonth)

    const [slaEntries, dsEntries] = op
      ? await Promise.all([getSlaWeeklyPct(op.id, slugs, weekStarts), getDsWeeklyPct(op.id, slugs, weekStarts)])
      : [[], []]

    days = weekStarts.map((iso) => ({ iso, day: iso, label: `${weekLabel(iso)} · ${weekRange(iso)}` }))
    slaValues = new Map(slaEntries.map((e) => [`${e.baseSlug}|${e.weekStart}`, e.pct]))
    dsValues = new Map(dsEntries.map((e) => [`${e.baseSlug}|${e.weekStart}`, e.pct]))

    filterExtra = (
      <>
        <ResultadosViewToggle value={visao} />
        <ResultadosMonthSelect months={months.length ? months : [selectedMonth]} value={selectedMonth} />
      </>
    )
  } else {
    const semanaParam = pick(sp.semana)
    const selectedWeek = semanaParam && weeks.includes(semanaParam) ? semanaParam : (weeks[0] ?? currentWeekStartIso())
    const isoDays = Array.from({ length: 7 }, (_, i) => addDaysIso(selectedWeek, i))

    const [slaEntries, dsEntries] = op
      ? await Promise.all([getSlaWeekEntries(op.id, slugs, isoDays), getDsWeekEntries(op.id, slugs, isoDays)])
      : [[], []]

    days = isoDays.map((iso, i) => ({
      iso,
      day: isoToBr(iso),
      label: `${WEEKDAY_LABELS[i]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
    }))
    slaValues = new Map(slaEntries.map((e) => [`${e.baseSlug}|${e.day}`, e.pct]))
    dsValues = new Map(dsEntries.map((e) => [`${e.baseSlug}|${e.day}`, e.pct]))

    filterExtra = (
      <>
        <ResultadosViewToggle value={visao} />
        <ResultadosWeekSelect weeks={weeks.length ? weeks : [selectedWeek]} value={selectedWeek} />
      </>
    )
  }

  return (
    <ShopeeSubtabShell
      title="Resultados"
      description={
        visao === "mensal"
          ? "SLA e DS por base, semana a semana do mês selecionado."
          : "SLA e DS por base, dia a dia da semana selecionada."
      }
      actions={isAdmin ? <BulkImportResultados /> : undefined}
      filterExtra={<div className="flex flex-wrap items-center gap-2">{filterExtra}</div>}
    >
      {op && (
        <ResultadosView
          operacaoId={op.id}
          mode={visao}
          days={days}
          bases={bases}
          slaValues={slaValues}
          dsValues={dsValues}
        />
      )}
    </ShopeeSubtabShell>
  )
}

"use server"

import { revalidatePath } from "next/cache"

import { query } from "@painel/db"
import { getSessionProfile } from "@/lib/auth"
import { getAllowedOperacoes } from "@/lib/live-queries"
import { getOperacaoBySlug } from "@/lib/queries"
import { SHOPEE_BASE_PATH, SHOPEE_SLUG } from "@/lib/shopee"
import { getDsDriversByDay, getDsDriversByWeek, type DsRow } from "@/lib/shopee/ds-queries"
import { parseResultadosBulkText, type ParsedResultadoLine } from "@/lib/shopee/resultados-import"

async function checkOperacaoAllowed(operacaoId: string) {
  const session = await getSessionProfile()
  if (!session?.profile) throw new Error("Não autorizado")
  const { operacoes } = await getAllowedOperacoes(session.profile)
  if (!operacoes.some((o) => o.id === operacaoId)) throw new Error("Não autorizado")
}

/** Motoristas de um dia do histórico de DS, ordenados com os piores primeiro. */
export async function getDsDriversForDay({
  operacaoId,
  baseSlugs = [],
  day,
}: {
  operacaoId: string
  baseSlugs?: string[]
  day: string
}): Promise<DsRow[]> {
  await checkOperacaoAllowed(operacaoId)
  return getDsDriversByDay(operacaoId, baseSlugs, day)
}

/** Motoristas de uma base numa semana inteira (consolidado da visão Mensal), piores primeiro. */
export async function getDsDriversForWeek({
  operacaoId,
  baseSlug,
  weekStart,
}: {
  operacaoId: string
  baseSlug: string
  weekStart: string
}): Promise<DsRow[]> {
  await checkOperacaoAllowed(operacaoId)
  return getDsDriversByWeek(operacaoId, baseSlug, weekStart)
}

// ===================== Import em massa (SLA/DS antigos, só admin) ==========

async function requireAdmin() {
  const session = await getSessionProfile()
  if (!session?.profile?.is_admin) throw new Error("Não autorizado")
}

export type BulkResultadoRow = ParsedResultadoLine & {
  baseId: string | null
  baseLabel: string | null
  slaExists: boolean
  dsExists: boolean
}

async function enrichRows(rows: ParsedResultadoLine[]): Promise<BulkResultadoRow[]> {
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const baseBySlug = new Map((op?.bases ?? []).map((b) => [b.slug, b]))

  const enriched: BulkResultadoRow[] = rows.map((r) => {
    const base = r.baseSlug ? baseBySlug.get(r.baseSlug) : undefined
    return {
      ...r,
      baseId: base?.id ?? null,
      baseLabel: base?.label ?? null,
      slaExists: false,
      dsExists: false,
      error: r.error ?? (base ? null : `Base não encontrada: "${r.baseRaw}" (slug: ${r.baseSlug})`),
    }
  })

  const valid = enriched.filter((r) => !r.error && r.baseId && r.day)
  if (!valid.length) return enriched

  const baseIds = [...new Set(valid.map((r) => r.baseId!))]
  const days = [...new Set(valid.map((r) => r.day!))]

  const [slaRows, dsRows] = await Promise.all([
    query<{ base_id: string; data_pt_br: string }>(
      `select base_id, data_pt_br from shopee_sla_record where base_id = any($1::text[]) and data_pt_br = any($2::text[])`,
      [baseIds, days],
    ),
    query<{ base_id: string; data_pt_br: string }>(
      `select distinct base_id, data_pt_br from shopee_ds_driver where base_id = any($1::text[]) and data_pt_br = any($2::text[])`,
      [baseIds, days],
    ),
  ])
  const slaSet = new Set(slaRows.map((r) => `${r.base_id}|${r.data_pt_br}`))
  const dsSet = new Set(dsRows.map((r) => `${r.base_id}|${r.data_pt_br}`))

  for (const r of valid) {
    r.slaExists = slaSet.has(`${r.baseId}|${r.day}`)
    r.dsExists = dsSet.has(`${r.baseId}|${r.day}`)
  }
  return enriched
}

export type BulkResultadoPreview = {
  rows: BulkResultadoRow[]
  totalLinhas: number
  importaveis: number
}

/** Alguma métrica dessa linha vai gerar gravação nova (tem % e ainda não existe). */
function temAlgoNovo(r: BulkResultadoRow): boolean {
  if (r.error) return false
  return (r.slaPct != null && !r.slaExists) || (r.dsPct != null && !r.dsExists)
}

/** Preview do import em massa: resolve base/dia de cada linha e marca o que já existe. */
export async function analyzeBulkResultados(text: string, defaultYear: number): Promise<BulkResultadoPreview> {
  await requireAdmin()
  const rows = await enrichRows(parseResultadosBulkText(text, defaultYear))
  return {
    rows,
    totalLinhas: rows.length,
    importaveis: rows.filter(temAlgoNovo).length,
  }
}

export type ApplyBulkResult = { ok: boolean; message: string }

/**
 * Grava o import em massa. Só preenche buracos: nunca sobrescreve um (base, dia)
 * que já tenha registro real de SLA/DS. Sem contagens reais, cada linha vira um
 * denominador fixo (1000) que reproduz a % com 1 casa decimal; o DS não ganha
 * motorista de verdade, só uma linha "sem detalhe" pra fechar o agregado do dia.
 */
export async function applyBulkResultados(text: string, defaultYear: number): Promise<ApplyBulkResult> {
  await requireAdmin()
  const rows = await enrichRows(parseResultadosBulkText(text, defaultYear))

  let slaGravados = 0
  let slaExistentes = 0
  let slaSemDado = 0
  let dsGravados = 0
  let dsExistentes = 0
  let dsSemDado = 0
  let comErro = 0

  for (const r of rows) {
    if (r.error || !r.baseId || !r.day) {
      comErro++
      continue
    }

    if (r.slaPct == null) {
      slaSemDado++
    } else if (r.slaExists) {
      slaExistentes++
    } else {
      const total = 1000
      const entregues = Math.round(r.slaPct * 10)
      await query(
        `insert into shopee_sla_record (base_id, data_pt_br, total, entregues, em_rota, ocorrencias, faltantes, outros, sla_pct)
         values ($1,$2,$3,$4,0,0,0,$5,$6)
         on conflict (base_id, data_pt_br) do nothing`,
        [r.baseId, r.day, total, entregues, total - entregues, r.slaPct],
      )
      slaGravados++
    }

    if (r.dsPct == null) {
      dsSemDado++
    } else if (r.dsExists) {
      dsExistentes++
    } else {
      const total = 1000
      const entregues = Math.round(r.dsPct * 10)
      await query(
        `insert into shopee_ds_driver (base_id, data_pt_br, driver_id, driver_name, saiu, entregues, em_rota, ocorrencias)
         values ($1,$2,null,$3,$4,$5,0,$6)`,
        [r.baseId, r.day, "Importado em massa (sem detalhe por motorista)", total, entregues, total - entregues],
      )
      dsGravados++
    }
  }

  revalidatePath(`${SHOPEE_BASE_PATH}/resultados`)

  const message = `SLA: ${slaGravados} dia(s) gravado(s), ${slaExistentes} já existiam, ${slaSemDado} não contabilizado(s). DS: ${dsGravados} dia(s) gravado(s), ${dsExistentes} já existiam, ${dsSemDado} não contabilizado(s).${comErro ? ` ${comErro} linha(s) com erro ignorada(s).` : ""}`
  const validas = rows.length - comErro
  return { ok: validas > 0, message }
}

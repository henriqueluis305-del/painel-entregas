import "server-only"

import { query } from "@painel/db"
import { calcDs, type DsTotals } from "@/lib/shopee/ds"

export type DsRow = {
  driver_id: string | null
  driver_name: string
  saiu: number
  entregues: number
  em_rota: number
  ocorrencias: number
  is_demo: boolean
  base_slug: string
  base_label: string
}

export type DsData = {
  rows: DsRow[]
  totals: DsTotals
  isDemo: boolean
  day: string | null
}

export type DsCheckpoint = { seq: number; label: string; pct: number }

type DsCkptRaw = {
  seq: number
  label: string
  saiu: number
  entregues: number
}

/** Burn-down do DS: % ainda não entregue por upload (checkpoint), agregado nas bases. */
export async function getDsCheckpoints(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<DsCheckpoint[]> {
  // burn-down do DIA mais recente
  const last = await query<{ data_pt_br: string }>(
    `select c.data_pt_br
       from shopee_ds_checkpoint c
       join base b on b.id = c.base_id
      where b.operacao_id::text = $1
      order by c.ts desc
      limit 1`,
    [operacaoId],
  )
  const day = last[0]?.data_pt_br
  if (!day) return []

  const baseFilter = baseSlugs.length ? "and b.slug = any($3::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, day, baseSlugs] : [operacaoId, day]
  const data = await query<DsCkptRaw>(
    `select c.seq, c.label, c.saiu, c.entregues
       from shopee_ds_checkpoint c
       join base b on b.id = c.base_id
      where b.operacao_id::text = $1 and c.data_pt_br = $2 ${baseFilter}
      order by c.seq`,
    params,
  )

  const map = new Map<number, { label: string; saiu: number; entregues: number }>()
  for (const r of data) {
    const m = map.get(r.seq) ?? { label: r.label, saiu: 0, entregues: 0 }
    m.saiu += r.saiu
    m.entregues += r.entregues
    map.set(r.seq, m)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seq, m]) => ({
      seq,
      label: m.label,
      // DS% = entregues/encaminhados (sobe ao longo do dia)
      pct: m.saiu ? Number(((m.entregues / m.saiu) * 100).toFixed(1)) : 0,
    }))
}

export async function getDsData(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<DsData> {
  // dia mais recente com DS (DS é "mesmo dia")
  const last = await query<{ data_pt_br: string }>(
    `select d.data_pt_br
       from shopee_ds_driver d
       join base b on b.id = d.base_id
      where b.operacao_id::text = $1
      order by d.updated_at desc
      limit 1`,
    [operacaoId],
  )
  const day = last[0]?.data_pt_br ?? null
  if (!day) return { rows: [], totals: calcDs([]), isDemo: false, day: null }

  const baseFilter = baseSlugs.length ? "and b.slug = any($3::text[])" : ""
  const params: unknown[] = baseSlugs.length ? [operacaoId, day, baseSlugs] : [operacaoId, day]
  const rows = await query<DsRow>(
    `select d.driver_id, d.driver_name, d.saiu, d.entregues, d.em_rota, d.ocorrencias,
            d.is_demo, b.slug as base_slug, b.label as base_label
       from shopee_ds_driver d
       join base b on b.id = d.base_id
      where b.operacao_id::text = $1 and d.data_pt_br = $2 ${baseFilter}
      order by d.entregues desc`,
    params,
  )

  return {
    rows,
    totals: calcDs(
      rows.map((r) => ({
        saiu: r.saiu,
        entregues: r.entregues,
        emRota: r.em_rota,
        ocorrencias: r.ocorrencias,
      })),
    ),
    isDemo: rows.some((r) => r.is_demo),
    day,
  }
}

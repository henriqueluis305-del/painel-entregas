import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
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

type EmbeddedDs = Omit<DsRow, "base_slug" | "base_label"> & {
  data_pt_br: string
  base: { slug: string; label: string; operacao_id: string } | null
}

export type DsData = {
  rows: DsRow[]
  totals: DsTotals
  isDemo: boolean
  day: string | null
}

export async function getDsData(
  operacaoId: string,
  baseSlugs: string[] = [],
): Promise<DsData> {
  const sb = createAdminClient()

  // dia mais recente com DS (DS é "mesmo dia")
  const { data: lastRows } = await sb
    .from("shopee_ds_driver")
    .select("data_pt_br, base!inner(operacao_id)")
    .eq("base.operacao_id", operacaoId)
    .order("updated_at", { ascending: false })
    .limit(1)
  const day = (lastRows ?? [])[0]?.data_pt_br ?? null
  if (!day) return { rows: [], totals: calcDs([]), isDemo: false, day: null }

  let q = sb
    .from("shopee_ds_driver")
    .select(
      "driver_id, driver_name, saiu, entregues, em_rota, ocorrencias, is_demo, data_pt_br, base!inner(slug, label, operacao_id)",
    )
    .eq("base.operacao_id", operacaoId)
    .eq("data_pt_br", day)
    .order("entregues", { ascending: false })
  if (baseSlugs.length) q = q.in("base.slug", baseSlugs)

  const { data, error } = await q
  if (error) throw new Error(`getDsData: ${error.message}`)

  const rows: DsRow[] = ((data ?? []) as unknown as EmbeddedDs[]).map((r) => ({
    driver_id: r.driver_id,
    driver_name: r.driver_name,
    saiu: r.saiu,
    entregues: r.entregues,
    em_rota: r.em_rota,
    ocorrencias: r.ocorrencias,
    is_demo: r.is_demo,
    base_slug: r.base?.slug ?? "",
    base_label: r.base?.label ?? "",
  }))

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

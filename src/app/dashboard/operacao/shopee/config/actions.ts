"use server"

import { revalidatePath } from "next/cache"

import { getSessionProfile } from "@/lib/auth"
import { withPgClient } from "@/lib/pg"
import { getOperacaoBySlug } from "@/lib/queries"
import { SHOPEE_BASE_PATH, SHOPEE_SLUG } from "@/lib/shopee"
import { getCidadeConfigBase, type CidadeConfigItem } from "@/lib/shopee/cidade-queries"
import { setShopeeConfigKey } from "@/lib/shopee/config"

export async function setStuckDailyReset(enabled: boolean) {
  const session = await getSessionProfile()
  if (!session?.profile?.is_admin) throw new Error("Não autorizado")
  await setShopeeConfigKey("stuck_daily_reset", enabled)
  revalidatePath(`${SHOPEE_BASE_PATH}/stuck`)
  revalidatePath(`${SHOPEE_BASE_PATH}/config`)
}

/**
 * Liga/desliga uma cidade de uma base (um switch só, vale p/ SLA, DS e o
 * "Fora de Abrangência" do Stuck). Upsert: cidade que só existe no rastreio de
 * Stuck ainda não tem linha em shopee_base_cidade — o insert cria na primeira vez.
 */
export async function setCidadeEnabled(baseSlug: string, cidade: string, value: boolean) {
  const session = await getSessionProfile()
  if (!session?.profile?.is_admin) throw new Error("Não autorizado")
  await withPgClient(async (c) => {
    await c.query(
      `insert into shopee_base_cidade (base_id, cidade, enabled)
       select b.id, $2, $3 from base b where b.slug = $1
       on conflict (base_id, cidade) do update set enabled = excluded.enabled`,
      [baseSlug, cidade, value],
    )
  })
  revalidatePath(`${SHOPEE_BASE_PATH}/config`)
  revalidatePath(`${SHOPEE_BASE_PATH}/monitoramento`)
  revalidatePath(`${SHOPEE_BASE_PATH}/stuck`)
}

/** Cidades de uma base (SLA + Stuck) p/ o Config — carregamento lazy no client. */
export async function listCidadesDaBase(baseSlug: string): Promise<CidadeConfigItem[]> {
  const session = await getSessionProfile()
  if (!session?.profile?.is_admin) throw new Error("Não autorizado")
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  if (!op) return []
  return getCidadeConfigBase(op.id, baseSlug)
}

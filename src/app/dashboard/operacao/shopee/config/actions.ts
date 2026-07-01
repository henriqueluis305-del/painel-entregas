"use server"

import { revalidatePath } from "next/cache"

import { getSessionProfile } from "@/lib/auth"
import { withPgClient } from "@/lib/pg"
import { SHOPEE_BASE_PATH } from "@/lib/shopee"
import { setShopeeConfigKey } from "@/lib/shopee/config"

export async function setStuckDailyReset(enabled: boolean) {
  const session = await getSessionProfile()
  if (!session?.profile?.is_admin) throw new Error("Não autorizado")
  await setShopeeConfigKey("stuck_daily_reset", enabled)
  revalidatePath(`${SHOPEE_BASE_PATH}/stuck`)
  revalidatePath(`${SHOPEE_BASE_PATH}/config`)
}

/** Liga/desliga uma cidade de uma base no SLA ou no DS (tabela por cidade). */
export async function setCidadeVisivel(
  baseSlug: string,
  cidade: string,
  field: "show_sla" | "show_ds",
  value: boolean,
) {
  const session = await getSessionProfile()
  if (!session?.profile?.is_admin) throw new Error("Não autorizado")
  const col = field === "show_sla" ? "show_sla" : "show_ds" // whitelist (evita SQL dinâmico)
  await withPgClient(async (c) => {
    await c.query(
      `update shopee_base_cidade sc set ${col} = $1, created_at = sc.created_at
       from base b where sc.base_id = b.id and b.slug = $2 and sc.cidade = $3`,
      [value, baseSlug, cidade],
    )
  })
  revalidatePath(`${SHOPEE_BASE_PATH}/config`)
  revalidatePath(`${SHOPEE_BASE_PATH}/monitoramento`)
}

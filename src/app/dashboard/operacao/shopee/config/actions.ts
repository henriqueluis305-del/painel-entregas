"use server"

import { revalidatePath } from "next/cache"

import { getSessionProfile } from "@/lib/auth"
import { SHOPEE_BASE_PATH } from "@/lib/shopee"
import { setShopeeConfigKey } from "@/lib/shopee/config"

export async function setStuckDailyReset(enabled: boolean) {
  const session = await getSessionProfile()
  if (!session?.profile?.is_admin) throw new Error("Não autorizado")
  await setShopeeConfigKey("stuck_daily_reset", enabled)
  revalidatePath(`${SHOPEE_BASE_PATH}/stuck`)
  revalidatePath(`${SHOPEE_BASE_PATH}/config`)
}

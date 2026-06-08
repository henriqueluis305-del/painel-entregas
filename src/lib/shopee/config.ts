import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { SHOPEE_SLUG } from "@/lib/shopee"

export type ShopeeConfig = {
  /** Visão do Stuck mostra só o backlog do dia mais recente (não apaga DB). */
  stuckDailyReset: boolean
}

const DEFAULTS: ShopeeConfig = { stuckDailyReset: true }

type ConfigRow = { id?: string; config: Record<string, unknown> | null }

export async function getShopeeConfig(): Promise<ShopeeConfig> {
  const sb = createAdminClient()
  const { data } = await sb
    .from("operacao")
    .select("config")
    .eq("slug", SHOPEE_SLUG)
    .single<ConfigRow>()
  const c = data?.config ?? {}
  return {
    stuckDailyReset:
      typeof c.stuck_daily_reset === "boolean"
        ? c.stuck_daily_reset
        : DEFAULTS.stuckDailyReset,
  }
}

/** Atualiza Uma chave do config jsonb da operação (merge). */
export async function setShopeeConfigKey(
  key: string,
  value: unknown,
): Promise<void> {
  const sb = createAdminClient()
  const { data, error: readErr } = await sb
    .from("operacao")
    .select("id, config")
    .eq("slug", SHOPEE_SLUG)
    .single<ConfigRow>()
  if (readErr || !data?.id) throw new Error("operação shopee não encontrada")
  const next = { ...(data.config ?? {}), [key]: value }
  const { error } = await sb.from("operacao").update({ config: next }).eq("id", data.id)
  if (error) throw new Error(error.message)
}

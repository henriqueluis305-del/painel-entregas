import "server-only"

import { query } from "@painel/db"
import { SHOPEE_SLUG } from "@/lib/shopee"

export type ShopeeConfig = {
  /** Visão do Stuck mostra só o backlog do dia mais recente (não apaga DB). */
  stuckDailyReset: boolean
}

const DEFAULTS: ShopeeConfig = { stuckDailyReset: true }

type ConfigRow = { id?: string; config: Record<string, unknown> | null }

export async function getShopeeConfig(): Promise<ShopeeConfig> {
  const rows = await query<ConfigRow>(
    `select config from operacao where slug = $1 limit 1`,
    [SHOPEE_SLUG],
  )
  const c = rows[0]?.config ?? {}
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
  const rows = await query<ConfigRow>(
    `select id, config from operacao where slug = $1 limit 1`,
    [SHOPEE_SLUG],
  )
  const row = rows[0]
  if (!row?.id) throw new Error("operação shopee não encontrada")
  const next = { ...(row.config ?? {}), [key]: value }
  await query(`update operacao set config = $1::jsonb where id::text = $2`, [
    JSON.stringify(next),
    row.id,
  ])
}

import { redirect } from "next/navigation"

import { StuckDailyResetToggle } from "@/components/shopee/config-form"
import { getSessionProfile } from "@/lib/auth"
import { SHOPEE_BASE_PATH } from "@/lib/shopee"
import { getShopeeConfig } from "@/lib/shopee/config"

export default async function ConfigPage() {
  const session = await getSessionProfile()
  if (!session?.profile?.is_admin) redirect(`${SHOPEE_BASE_PATH}/geral`)

  const config = await getShopeeConfig()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Configurações</h2>
        <p className="text-muted-foreground text-sm">
          Ajustes da operação Shopee (somente administradores).
        </p>
      </div>

      <div className="flex max-w-2xl flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            Stuck
          </h3>
          <StuckDailyResetToggle initial={config.stuckDailyReset} />
        </section>
      </div>
    </div>
  )
}

import { redirect } from "next/navigation"

import { CidadesConfig } from "@/components/shopee/cidades-config"
import { StuckDailyResetToggle } from "@/components/shopee/config-form"
import { getSessionProfile } from "@/lib/auth"
import { getOperacaoBySlug } from "@/lib/queries"
import { SHOPEE_BASE_PATH, SHOPEE_SLUG } from "@/lib/shopee"
import { getCidadeConfig } from "@/lib/shopee/cidade-queries"
import { getShopeeConfig } from "@/lib/shopee/config"

export default async function ConfigPage() {
  const session = await getSessionProfile()
  if (!session?.profile?.is_admin) redirect(`${SHOPEE_BASE_PATH}/geral`)

  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const [config, cidades] = await Promise.all([
    getShopeeConfig(),
    op ? getCidadeConfig(op.id) : Promise.resolve([]),
  ])

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

        <section className="flex flex-col gap-3">
          <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            Cidades por base
          </h3>
          <p className="text-muted-foreground text-sm">
            Escolha quais cidades aparecem nas tabelas por cidade do SLA e do DS,
            na aba Monitoramento. A lista é descoberta automaticamente pelo CEP a
            cada upload de SLA.
          </p>
          <CidadesConfig config={cidades} />
        </section>
      </div>
    </div>
  )
}

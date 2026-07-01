import { redirect } from "next/navigation"

import { CidadesConfig } from "@/components/shopee/cidades-config"
import { StuckDailyResetToggle } from "@/components/shopee/config-form"
import { getSessionProfile } from "@/lib/auth"
import { getOperacaoBySlug } from "@/lib/queries"
import { SHOPEE_BASE_PATH, SHOPEE_SLUG } from "@/lib/shopee"
import { getShopeeConfig } from "@/lib/shopee/config"

export default async function ConfigPage() {
  const session = await getSessionProfile()
  if (!session?.profile?.is_admin) redirect(`${SHOPEE_BASE_PATH}/geral`)

  const [config, op] = await Promise.all([getShopeeConfig(), getOperacaoBySlug(SHOPEE_SLUG)])
  const bases = (op?.bases ?? [])
    .filter((b) => b.active)
    .map((b) => ({ slug: b.slug, label: b.label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))

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
            Selecione a base e ligue as cidades que fazem parte dela. O mesmo
            interruptor vale para as tabelas por cidade do SLA e do DS
            (Monitoramento) e para o &quot;Fora de Abrangência&quot; do Stuck. A
            lista reúne as cidades vistas no rastreio de SLA e no de Stuck
            (resolvidas pelo CEP). Por padrão tudo entra desligado.
          </p>
          <CidadesConfig bases={bases} />
        </section>
      </div>
    </div>
  )
}

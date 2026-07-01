import { ShopeeSubtabShell } from "@/components/shopee/subtab-shell"
import { StuckPanel } from "@/components/shopee/stuck-panel"
import { getOperacaoBySlug } from "@/lib/queries"
import { effectiveBases, parseShopeeFilters, SHOPEE_SLUG } from "@/lib/shopee"
import { getShopeeConfig } from "@/lib/shopee/config"
import { getStuckCheckpoints, getStuckPackages } from "@/lib/shopee/stuck-queries"

export default async function StuckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseShopeeFilters(await searchParams)
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const slugs = effectiveBases(filters)
  const config = await getShopeeConfig()
  const [rows, points] = op
    ? await Promise.all([
        getStuckPackages(op.id, slugs, { dailyReset: config.stuckDailyReset }),
        getStuckCheckpoints(op.id, slugs),
      ])
    : [[], []]

  return (
    <ShopeeSubtabShell
      title="Stuck"
      description="Pacotes presos: floor(LM Hub Days) ≥ 1 e status ≠ Delivered."
    >
      <StuckPanel rows={rows} points={points} />
    </ShopeeSubtabShell>
  )
}

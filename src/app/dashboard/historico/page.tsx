import { SiteHeader } from "@/components/site-header"
import { PagePlaceholder } from "@/components/page-placeholder"
import { requirePerm } from "@/lib/auth"
import { PERMS } from "@/lib/permissions"

export default async function Page() {
  await requirePerm(PERMS.VIEW_HISTORICO)
  return (
    <>
      <SiteHeader title="Histórico" />
      <PagePlaceholder
        title="Histórico"
        description="Timeline de snapshots por base. (Fase 6)"
      />
    </>
  )
}

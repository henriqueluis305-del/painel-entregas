import { SiteHeader } from "@/components/site-header"
import { PagePlaceholder } from "@/components/page-placeholder"
import { requirePerm } from "@/lib/auth"
import { PERMS } from "@/lib/permissions"

export default async function Page() {
  await requirePerm(PERMS.VIEW_SLA_DS)
  return (
    <>
      <SiteHeader title="SLA & DS" />
      <PagePlaceholder
        title="SLA & DS"
        description="Histórico agregado e comparativos entre bases. (Fase 7)"
      />
    </>
  )
}

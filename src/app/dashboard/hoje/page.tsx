import { SiteHeader } from "@/components/site-header"
import { PagePlaceholder } from "@/components/page-placeholder"
import { requirePerm } from "@/lib/auth"
import { PERMS } from "@/lib/permissions"

export default async function Page() {
  await requirePerm(PERMS.VIEW_HOJE)
  return (
    <>
      <SiteHeader title="SLA & DS Hoje" />
      <PagePlaceholder
        title="SLA & DS Hoje"
        description="Importação de CSV/XLSX e cálculo ao vivo de SLA e DS. (Fase 3)"
      />
    </>
  )
}

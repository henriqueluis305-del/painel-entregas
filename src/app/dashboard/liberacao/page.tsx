import { SiteHeader } from "@/components/site-header"
import { PagePlaceholder } from "@/components/page-placeholder"
import { requirePerm } from "@/lib/auth"
import { PERMS } from "@/lib/permissions"

export default async function Page() {
  await requirePerm(PERMS.VIEW_LIBERACAO)
  return (
    <>
      <SiteHeader title="Liberação" />
      <PagePlaceholder
        title="Liberação de Pagamento"
        description="Registro de liberação OK/NOK por base. (Fase 7)"
      />
    </>
  )
}

import { SiteHeader } from "@/components/site-header"
import { PagePlaceholder } from "@/components/page-placeholder"
import { requirePerm } from "@/lib/auth"
import { PERMS } from "@/lib/permissions"

export default async function Page() {
  await requirePerm(PERMS.VIEW_MOTORISTAS)
  return (
    <>
      <SiteHeader title="Motoristas" />
      <PagePlaceholder
        title="Motoristas"
        description="Desempenho por motorista. (Fase 6)"
      />
    </>
  )
}

import { SiteHeader } from "@/components/site-header"
import { PagePlaceholder } from "@/components/page-placeholder"
import { requirePerm } from "@/lib/auth"
import { PERMS } from "@/lib/permissions"

export default async function Page() {
  await requirePerm(PERMS.MANAGE_USERS)
  return (
    <>
      <SiteHeader title="Administração" />
      <PagePlaceholder
        title="Administração"
        description="Usuários, bases e permissões. (Fase 8)"
      />
    </>
  )
}

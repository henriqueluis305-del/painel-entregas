import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getSessionProfile } from "@/lib/auth"
import { resolvePerms, ROLE_LABEL } from "@/lib/permissions"
import { getOperacoesWithBases } from "@/lib/queries"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionProfile()
  if (!session) redirect("/login")
  const { email, profile } = session
  const perms = profile ? resolvePerms(profile) : []
  const user = {
    name: profile?.empresa || email,
    email,
    role: profile ? (ROLE_LABEL[profile.role] ?? profile.role) : "—",
  }

  // Operações visíveis conforme escopo do usuário
  const allOps = await getOperacoesWithBases()
  const canSeeAll =
    !profile || profile.is_admin || profile.base_scope === "ALL"
  const operacoes = (
    canSeeAll ? allOps : allOps.filter((o) => o.id === profile.operacao_id)
  ).map((o) => ({ slug: o.slug, label: o.label }))

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        user={user}
        perms={perms}
        operacoes={operacoes}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}

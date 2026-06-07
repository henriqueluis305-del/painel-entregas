"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { PERMS, type Permission } from "@/lib/permissions"
import {
  LayoutDashboardIcon,
  CalendarClockIcon,
  HistoryIcon,
  TruckIcon,
  ChartSplineIcon,
  CircleCheckBigIcon,
  ShieldIcon,
  StoreIcon,
  type LucideIcon,
} from "lucide-react"

type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  perm: Permission | null
  group: "Plataforma" | "Gestão"
}

const NAV: NavItem[] = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboardIcon, perm: null, group: "Plataforma" },
  { title: "SLA & DS Hoje", url: "/dashboard/hoje", icon: CalendarClockIcon, perm: PERMS.VIEW_HOJE, group: "Plataforma" },
  { title: "Histórico", url: "/dashboard/historico", icon: HistoryIcon, perm: PERMS.VIEW_HISTORICO, group: "Plataforma" },
  { title: "Motoristas", url: "/dashboard/motoristas", icon: TruckIcon, perm: PERMS.VIEW_MOTORISTAS, group: "Plataforma" },
  { title: "SLA & DS", url: "/dashboard/sla-ds", icon: ChartSplineIcon, perm: PERMS.VIEW_SLA_DS, group: "Plataforma" },
  { title: "Liberação", url: "/dashboard/liberacao", icon: CircleCheckBigIcon, perm: PERMS.VIEW_LIBERACAO, group: "Plataforma" },
  { title: "Administração", url: "/dashboard/admin", icon: ShieldIcon, perm: PERMS.MANAGE_USERS, group: "Gestão" },
]

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: { title: string; url: string; icon: LucideIcon }[]
  pathname: string
}) {
  if (items.length === 0) return null
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const active =
            item.url === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.url)
          return (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={active}
                render={<Link href={item.url} />}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function AppSidebar({
  user,
  perms,
  operacoes,
  ...props
}: {
  user: { name: string; email: string; role: string }
  perms: string[]
  operacoes: { slug: string; label: string }[]
} & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const visible = NAV.filter((i) => i.perm === null || perms.includes(i.perm))

  const plataforma = visible
    .filter((i) => i.group === "Plataforma")
    .map((i) => ({ title: i.title, url: i.url, icon: i.icon }))
  const gestao = visible
    .filter((i) => i.group === "Gestão")
    .map((i) => ({ title: i.title, url: i.url, icon: i.icon }))
  const ops = operacoes.map((o) => ({
    title: o.label,
    url: `/dashboard/operacao/${o.slug}`,
    icon: StoreIcon,
  }))

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[slot=sidebar-menu-button]:!p-1.5"
              render={<Link href="/dashboard" />}
            >
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="size-7 object-contain" />
              <span className="text-base font-semibold">Painel de Entregas</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Plataforma" items={plataforma} pathname={pathname} />
        <NavGroup label="Operações" items={ops} pathname={pathname} />
        <NavGroup label="Gestão" items={gestao} pathname={pathname} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}

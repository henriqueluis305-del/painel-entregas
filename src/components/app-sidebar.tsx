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
  SettingsIcon,
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
  { title: "Configurações", url: "/dashboard/admin", icon: SettingsIcon, perm: PERMS.MANAGE_USERS, group: "Gestão" },
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

function OpIcon({ logo, label }: { logo: string | null; label: string }) {
  // Logo preenche a caixa; cantos internos arredondados iguais aos externos.
  if (logo) {
    return (
      <span className="flex size-5 shrink-0 overflow-hidden rounded-md">
        <Image
          src={logo}
          alt={label}
          width={20}
          height={20}
          className="size-full object-cover"
        />
      </span>
    )
  }
  return (
    <span className="bg-sidebar-accent flex size-5 shrink-0 items-center justify-center rounded-md">
      <StoreIcon className="size-3" />
    </span>
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
  operacoes: { slug: string; label: string; logo: string | null }[]
} & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const visible = NAV.filter((i) => i.perm === null || perms.includes(i.perm))

  const plataforma = visible
    .filter((i) => i.group === "Plataforma")
    .map((i) => ({ title: i.title, url: i.url, icon: i.icon }))
  const gestao = visible
    .filter((i) => i.group === "Gestão")
    .map((i) => ({ title: i.title, url: i.url, icon: i.icon }))

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
              <Image
                src="/logo_small.png"
                alt="Parceiro Spot"
                width={28}
                height={28}
                className="size-7 shrink-0 object-contain"
              />
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">Parceiro Spot</span>
                <span className="text-muted-foreground text-xs">
                  Painel de Entregas
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Plataforma" items={plataforma} pathname={pathname} />
        {operacoes.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operações</SidebarGroupLabel>
            <SidebarMenu>
              {operacoes.map((o) => {
                const url = `/dashboard/operacao/${o.slug}`
                return (
                  <SidebarMenuItem key={o.slug}>
                    <SidebarMenuButton
                      tooltip={o.label}
                      isActive={pathname.startsWith(url)}
                      render={<Link href={url} />}
                    >
                      <OpIcon logo={o.logo} label={o.label} />
                      <span>{o.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
        <NavGroup label="Gestão" items={gestao} pathname={pathname} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}

"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { SHOPEE_BASE_PATH, SHOPEE_TABS } from "@/lib/shopee"

export function ShopeeSubtabs({
  isAdmin,
  perms = [],
}: {
  isAdmin: boolean
  perms?: string[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const qs = searchParams.toString()
  const suffix = qs ? `?${qs}` : ""

  const tabs = SHOPEE_TABS.filter((t) => {
    if (t.admin && !isAdmin) return false
    if (t.anyPerm && !isAdmin && !t.anyPerm.some((p) => perms.includes(p))) return false
    return true
  })

  return (
    <nav className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden border-b px-4 backdrop-blur lg:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const href = `${SHOPEE_BASE_PATH}/${tab.slug}`
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={tab.slug}
            href={`${href}${suffix}`}
            className={cn(
              "relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

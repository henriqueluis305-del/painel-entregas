import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import { FileDownIcon } from "lucide-react"

import { ShopeeSubtabs } from "@/components/shopee/subtabs-nav"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getSessionProfile } from "@/lib/auth"
import { getOperacaoBySlug } from "@/lib/queries"
import { SHOPEE_SLUG } from "@/lib/shopee"

export default async function ShopeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionProfile()
  if (!session) redirect("/login")

  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  if (!op) notFound()

  const isAdmin = !!session.profile?.is_admin

  return (
    <>
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
        <div className="flex w-full items-center gap-2 px-4 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-1 h-4 data-vertical:self-auto"
          />
          <Image
            src={`/operacoes/${SHOPEE_SLUG}.png`}
            alt={op.label}
            width={24}
            height={24}
            className="size-6 rounded object-contain"
          />
          <h1 className="text-base font-medium">{op.label}</h1>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5"
            disabled
            title="Em breve"
          >
            <FileDownIcon className="size-4" />
            Export PDF
          </Button>
        </div>
      </header>

      <ShopeeSubtabs isAdmin={isAdmin} />

      <div className="flex flex-col gap-6 p-4 lg:p-6">{children}</div>
    </>
  )
}

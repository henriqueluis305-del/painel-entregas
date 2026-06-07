import { HammerIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export function PagePlaceholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="bg-primary/10 text-primary rounded-2xl p-4">
          <HammerIcon className="size-7" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
        <Badge variant="secondary">Em construção</Badge>
      </div>
    </div>
  )
}

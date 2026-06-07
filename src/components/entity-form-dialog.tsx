"use client"

import { useActionState, useEffect, useState } from "react"
import { Loader2Icon } from "lucide-react"

import type { ActionState } from "@/app/dashboard/admin/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function EntityFormDialog({
  trigger,
  title,
  description,
  action,
  submitLabel = "Salvar",
  children,
}: {
  trigger: React.ReactElement
  title: string
  description?: string
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  submitLabel?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(action, { ok: false })

  useEffect(() => {
    if (state.ok) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {children}
          {state.error && (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

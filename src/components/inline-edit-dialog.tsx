"use client"

import { useState, useTransition } from "react"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function InlineEditDialog({
  trigger,
  title,
  fieldLabel,
  defaultValue,
  onSave,
}: {
  trigger: React.ReactElement
  title: string
  fieldLabel: string
  defaultValue: string
  onSave: (value: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(defaultValue)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      await onSave(value)
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setValue(defaultValue)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>{fieldLabel}</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

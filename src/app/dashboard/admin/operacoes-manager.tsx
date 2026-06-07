"use client"

import { useEffect, useState, useTransition } from "react"
import Image from "next/image"
import { PlusIcon, PencilIcon, StoreIcon, Trash2Icon } from "lucide-react"

import {
  createBase,
  createOperacao,
  deleteBase,
  deleteOperacao,
  setBaseActive,
  setOperacaoSidebar,
  updateBase,
  updateOperacao,
} from "@/app/dashboard/admin/actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EntityFormDialog } from "@/components/entity-form-dialog"
import { InlineEditDialog } from "@/components/inline-edit-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import type { OperacaoWithBases } from "@/lib/queries"

type OperacaoCard = OperacaoWithBases & { logo: string | null }

function OpLogo({ logo, label }: { logo: string | null; label: string }) {
  if (logo) {
    return (
      <span className="size-9 shrink-0 overflow-hidden rounded-md">
        <Image
          src={logo}
          alt={label}
          width={36}
          height={36}
          className="size-full object-cover"
        />
      </span>
    )
  }
  return (
    <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
      <StoreIcon className="size-4" />
    </span>
  )
}

function ActionSwitch({
  checked,
  onToggle,
}: {
  checked: boolean
  onToggle: (v: boolean) => Promise<void> | void
}) {
  const [val, setVal] = useState(checked)
  const [pending, start] = useTransition()
  useEffect(() => setVal(checked), [checked])
  return (
    <Switch
      checked={val}
      disabled={pending}
      onCheckedChange={(v: boolean) => {
        setVal(v)
        start(() => Promise.resolve(onToggle(v)))
      }}
    />
  )
}

const iconBtn = (icon: React.ReactNode) => (
  <Button variant="ghost" size="icon" className="size-7">
    {icon}
  </Button>
)

export function OperacoesManager({
  operacoes,
}: {
  operacoes: OperacaoCard[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {operacoes.length} operações cadastradas
        </p>
        <EntityFormDialog
          trigger={
            <Button size="sm">
              <PlusIcon className="size-4" />
              Nova operação
            </Button>
          }
          title="Nova operação"
          description="Cadastre um novo cliente/operação."
          action={createOperacao}
        >
          <div className="grid gap-2">
            <Label htmlFor="op-label">Nome</Label>
            <Input id="op-label" name="label" placeholder="Ex.: Amazon" required />
          </div>
        </EntityFormDialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {operacoes.map((op) => (
          <Card key={op.id} className="gap-3">
            <CardHeader className="gap-0">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <OpLogo logo={op.logo} label={op.label} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{op.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {op.slug}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary">{op.bases.length} bases</Badge>
                  <InlineEditDialog
                    trigger={iconBtn(<PencilIcon className="size-3.5" />)}
                    title="Renomear operação"
                    fieldLabel="Nome"
                    defaultValue={op.label}
                    onSave={(v) => updateOperacao(op.id, v)}
                  />
                  <ConfirmDialog
                    trigger={iconBtn(<Trash2Icon className="size-3.5" />)}
                    title={`Excluir ${op.label}?`}
                    description="Isso remove a operação e todas as suas bases. Ação irreversível."
                    confirmLabel="Excluir"
                    destructive
                    onConfirm={() => deleteOperacao(op.id)}
                  />
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">Na sidebar (padrão)</span>
                <ActionSwitch
                  checked={op.in_sidebar}
                  onToggle={(v) => setOperacaoSidebar(op.id, v)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                {op.bases.length === 0 ? (
                  <span className="text-muted-foreground text-sm">
                    Sem bases ainda.
                  </span>
                ) : (
                  op.bases.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {b.label}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {b.active ? "Disponível" : "Indisponível"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ActionSwitch
                          checked={b.active}
                          onToggle={(v) => setBaseActive(b.id, v)}
                        />
                        <InlineEditDialog
                          trigger={iconBtn(<PencilIcon className="size-3.5" />)}
                          title="Renomear base"
                          fieldLabel="Nome"
                          defaultValue={b.label}
                          onSave={(v) => updateBase(b.id, v)}
                        />
                        <ConfirmDialog
                          trigger={iconBtn(<Trash2Icon className="size-3.5" />)}
                          title={`Excluir ${b.label}?`}
                          description="Ação irreversível."
                          confirmLabel="Excluir"
                          destructive
                          onConfirm={() => deleteBase(b.id)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <EntityFormDialog
                trigger={
                  <Button variant="outline" size="sm" className="w-fit">
                    <PlusIcon className="size-4" />
                    Nova base
                  </Button>
                }
                title={`Nova base — ${op.label}`}
                action={createBase}
              >
                <input type="hidden" name="operacao_id" value={op.id} />
                <div className="grid gap-2">
                  <Label htmlFor={`base-${op.id}`}>Nome da base</Label>
                  <Input
                    id={`base-${op.id}`}
                    name="label"
                    placeholder="Ex.: XPT-ADR-03"
                    required
                  />
                </div>
              </EntityFormDialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

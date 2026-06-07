"use client"

import { PlusIcon } from "lucide-react"

import { createBase, createOperacao } from "@/app/dashboard/admin/actions"
import { EntityFormDialog } from "@/components/entity-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { OperacaoWithBases } from "@/lib/queries"

export function OperacoesManager({
  operacoes,
}: {
  operacoes: OperacaoWithBases[]
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
          <Card key={op.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{op.label}</span>
                <Badge variant="secondary">{op.bases.length} bases</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {op.bases.length === 0 ? (
                  <span className="text-muted-foreground text-sm">
                    Sem bases ainda.
                  </span>
                ) : (
                  op.bases.map((b) => (
                    <Badge key={b.id} variant="outline">
                      {b.label}
                    </Badge>
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

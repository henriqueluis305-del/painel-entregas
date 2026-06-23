"use client"

import { useState, useTransition } from "react"
import {
  CheckIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
  UserCheckIcon,
  UserMinusIcon,
  XIcon,
} from "lucide-react"

import {
  approveUser,
  deleteUser,
  rejectUser,
  setUserActive,
  updateUser,
  type ActionState,
  type UpdateUserPayload,
} from "@/app/dashboard/admin/actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Badge } from "@/components/ui/badge"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ROLE_LABEL, type Role } from "@/lib/permissions"
import type { UserRow } from "@/lib/queries"

const ROLES = Object.keys(ROLE_LABEL) as Role[]
const SCOPES = ["SINGLE", "OP_WIDE", "ALL"]

type OperacaoOption = { id: string; slug: string; label: string }

function UserForm({
  user,
  operacoes,
  submit,
  onSuccess,
  actions,
}: {
  user: UserRow
  operacoes: OperacaoOption[]
  submit: (payload: UpdateUserPayload) => Promise<ActionState>
  onSuccess: () => void
  actions: (opts: { pending: boolean; submit: () => void }) => React.ReactNode
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState("")
  const [empresa, setEmpresa] = useState(user.empresa ?? "")
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState<Role>(user.role)
  const [scope, setScope] = useState(user.base_scope)
  const [operacaoId, setOperacaoId] = useState(user.operacao_id ?? "")
  const [isAdmin, setIsAdmin] = useState(user.is_admin)
  const [useDefault, setUseDefault] = useState(user.sidebar_operacoes === null)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(user.sidebar_operacoes ?? []),
  )
  const [password, setPassword] = useState("")

  function toggle(slug: string, v: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (v) next.add(slug)
      else next.delete(slug)
      return next
    })
  }

  function pickOperacao(id: string) {
    setOperacaoId(id)
    // evita o caso "aprovado mas não vê nada": escopo único sem override de sidebar
    const slug = operacoes.find((o) => o.id === id)?.slug
    if (slug) {
      setUseDefault(false)
      setSelected(new Set([slug]))
    }
  }

  function doSubmit() {
    setError("")
    if (scope === "SINGLE" && !operacaoId) {
      setError("Escopo único precisa de uma operação selecionada.")
      return
    }
    start(async () => {
      const r = await submit({
        id: user.id,
        empresa,
        email,
        role,
        base_scope: scope,
        operacao_id: scope === "SINGLE" ? operacaoId : null,
        is_admin: isAdmin,
        sidebar_operacoes: useDefault ? null : [...selected],
        password: password || undefined,
      })
      if (r.ok) onSuccess()
      else setError(r.error ?? "Erro ao salvar.")
    })
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Nome</Label>
        <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label>E-mail</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label>Nova senha (opcional)</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Deixe em branco para manter a atual"
          minLength={8}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Cargo</Label>
          <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Escopo</Label>
          <Select value={scope} onValueChange={(v) => v && setScope(v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {scope === "SINGLE" && (
        <div className="grid gap-2">
          <Label>Operação</Label>
          <Select value={operacaoId} onValueChange={(v) => v && pickOperacao(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a operação" />
            </SelectTrigger>
            <SelectContent>
              {operacoes.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <Label className="font-normal">Administrador (acesso total)</Label>
        <Switch checked={isAdmin} onCheckedChange={(v: boolean) => setIsAdmin(v)} />
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <Label className="font-normal">
            Dashboards: seguir o padrão da plataforma
          </Label>
          <Switch
            checked={useDefault}
            onCheckedChange={(v: boolean) => setUseDefault(v)}
          />
        </div>
        {!useDefault && (
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-muted-foreground text-xs">
              Selecione quais operações este usuário vê:
            </span>
            {operacoes.map((o) => (
              <div
                key={o.slug}
                className="flex items-center justify-between rounded-md px-1 py-1"
              >
                <span className="text-sm">{o.label}</span>
                <Switch
                  checked={selected.has(o.slug)}
                  onCheckedChange={(v: boolean) => toggle(o.slug, v)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      <DialogFooter>{actions({ pending, submit: doSubmit })}</DialogFooter>
    </div>
  )
}

function EditDialog({
  user,
  operacoes,
}: {
  user: UserRow
  operacoes: OperacaoOption[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" className="size-7">
            <PencilIcon className="size-3.5" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <UserForm
          user={user}
          operacoes={operacoes}
          submit={updateUser}
          onSuccess={() => setOpen(false)}
          actions={({ pending, submit }) => (
            <Button type="button" onClick={submit} disabled={pending}>
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              Salvar
            </Button>
          )}
        />
      </DialogContent>
    </Dialog>
  )
}

export function ApprovalDialog({
  user,
  operacoes,
}: {
  user: UserRow
  operacoes: OperacaoOption[]
}) {
  const [open, setOpen] = useState(false)
  const [rejectPending, startReject] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Revisar</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aprovar cadastro</DialogTitle>
          <DialogDescription>
            {user.email} · cargo solicitado: {ROLE_LABEL[user.role]}
          </DialogDescription>
        </DialogHeader>
        <UserForm
          user={user}
          operacoes={operacoes}
          submit={approveUser}
          onSuccess={() => setOpen(false)}
          actions={({ pending, submit }) => (
            <>
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={pending || rejectPending}
                onClick={() => startReject(async () => { await rejectUser(user.id) })}
              >
                {rejectPending && <Loader2Icon className="size-4 animate-spin" />}
                <XIcon className="size-3.5" />
                Rejeitar
              </Button>
              <Button type="button" onClick={submit} disabled={pending || rejectPending}>
                {pending && <Loader2Icon className="size-4 animate-spin" />}
                <CheckIcon className="size-3.5" />
                Aprovar
              </Button>
            </>
          )}
        />
      </DialogContent>
    </Dialog>
  )
}

function ReactivateButton({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      disabled={pending}
      title="Reativar"
      onClick={() => start(() => setUserActive(id, true))}
    >
      <UserCheckIcon className="size-3.5" />
    </Button>
  )
}

export function UserActions({
  user,
  operacoes,
}: {
  user: UserRow
  operacoes: OperacaoOption[]
}) {
  if (user.approval_status === "rejected") {
    return (
      <div className="flex items-center justify-end gap-1">
        <Badge variant="secondary" className="text-muted-foreground">
          Rejeitado
        </Badge>
        <ApprovalDialog user={user} operacoes={operacoes} />
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive size-7"
              title="Excluir definitivamente"
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          }
          title={`Excluir ${user.empresa ?? user.email} definitivamente?`}
          description="Remove o usuário do sistema e da autenticação. Ação irreversível."
          confirmLabel="Excluir definitivamente"
          destructive
          onConfirm={() => deleteUser(user.id)}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <EditDialog user={user} operacoes={operacoes} />
      {user.active ? (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon" className="size-7" title="Inativar">
              <UserMinusIcon className="size-3.5" />
            </Button>
          }
          title={`Inativar ${user.empresa ?? user.email}?`}
          description="O usuário não conseguirá mais entrar. Você pode reativá-lo depois."
          confirmLabel="Inativar"
          onConfirm={() => setUserActive(user.id, false)}
        />
      ) : (
        <>
          <ReactivateButton id={user.id} />
          <ConfirmDialog
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive size-7"
                title="Excluir definitivamente"
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            }
            title={`Excluir ${user.empresa ?? user.email} definitivamente?`}
            description="Remove o usuário do sistema e da autenticação. Ação irreversível."
            confirmLabel="Excluir definitivamente"
            destructive
            onConfirm={() => deleteUser(user.id)}
          />
        </>
      )}
    </div>
  )
}

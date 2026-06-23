import { existsSync } from "fs"
import { join } from "path"

import Image from "next/image"
import { StoreIcon } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requirePerm } from "@/lib/auth"
import { PERMS, ROLE_LABEL, type Role } from "@/lib/permissions"
import { getOperacoesWithBases, getUsers } from "@/lib/queries"

import { OperacoesManager } from "./operacoes-manager"
import { ApprovalDialog, UserActions } from "./user-actions"

export default async function Page() {
  await requirePerm(PERMS.MANAGE_USERS)
  const [operacoes, allUsers] = await Promise.all([
    getOperacoesWithBases(),
    getUsers(),
  ])
  const pending = allUsers.filter((u) => u.approval_status === "pending")
  const users = allUsers.filter((u) => u.approval_status !== "pending")
  const opsLite = operacoes.map((o) => ({ id: o.id, slug: o.slug, label: o.label }))
  const opsWithLogo = operacoes.map((o) => {
    const rel = `/operacoes/${o.slug}.png`
    return {
      ...o,
      logo: existsSync(join(process.cwd(), "public", rel)) ? rel : null,
    }
  })
  const bySlug = Object.fromEntries(opsWithLogo.map((o) => [o.slug, o]))
  const defaultSlugs = opsWithLogo
    .filter((o) => o.in_sidebar)
    .map((o) => o.slug)

  return (
    <>
      <SiteHeader title="Configurações" />
      <div className="p-4 lg:p-6">
        <Tabs defaultValue="ops">
          <TabsList>
            <TabsTrigger value="ops">Operações &amp; Bases</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="ops" className="mt-4">
            <OperacoesManager operacoes={opsWithLogo} />
          </TabsContent>

          <TabsContent value="users" className="mt-4 flex flex-col gap-4">
            {pending.length > 0 && (
              <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Cadastros pendentes</h3>
                  <Badge>{pending.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Cadastrado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.empresa ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>{u.cargo ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <ApprovalDialog user={u} operacoes={opsLite} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dashboards</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow
                      key={u.id}
                      className={u.active ? "" : "opacity-50"}
                    >
                      <TableCell className="font-medium">
                        {u.empresa ?? "—"}
                        {u.is_admin && (
                          <Badge variant="secondary" className="ml-2">
                            admin
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>{u.cargo ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {ROLE_LABEL[u.role as Role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{u.base_scope}</TableCell>
                      <TableCell>
                        {u.approval_status === "rejected" ? (
                          <Badge variant="secondary" className="text-muted-foreground">
                            Rejeitado
                          </Badge>
                        ) : (
                          <Badge
                            variant={u.active ? "outline" : "secondary"}
                            className={
                              u.active ? "text-emerald-500" : "text-muted-foreground"
                            }
                          >
                            {u.active ? "Ativo" : "Inativo"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {(u.sidebar_operacoes ?? defaultSlugs).length === 0 ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            (u.sidebar_operacoes ?? defaultSlugs).map((slug) => {
                              const o = bySlug[slug]
                              if (!o) return null
                              return o.logo ? (
                                <span
                                  key={slug}
                                  title={o.label}
                                  className="size-5 shrink-0 overflow-hidden rounded"
                                >
                                  <Image
                                    src={o.logo}
                                    alt={o.label}
                                    width={20}
                                    height={20}
                                    className="size-full object-cover"
                                  />
                                </span>
                              ) : (
                                <span
                                  key={slug}
                                  title={o.label}
                                  className="bg-muted flex size-5 shrink-0 items-center justify-center rounded"
                                >
                                  <StoreIcon className="size-3" />
                                </span>
                              )
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserActions user={u} operacoes={opsLite} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

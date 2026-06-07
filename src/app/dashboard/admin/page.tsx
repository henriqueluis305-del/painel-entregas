import { existsSync } from "fs"
import { join } from "path"

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
import { UserActions } from "./user-actions"

export default async function Page() {
  await requirePerm(PERMS.MANAGE_USERS)
  const [operacoes, users] = await Promise.all([
    getOperacoesWithBases(),
    getUsers(),
  ])
  const opsLite = operacoes.map((o) => ({ slug: o.slug, label: o.label }))
  const opsWithLogo = operacoes.map((o) => {
    const rel = `/operacoes/${o.slug}.png`
    return {
      ...o,
      logo: existsSync(join(process.cwd(), "public", rel)) ? rel : null,
    }
  })

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

          <TabsContent value="users" className="mt-4">
            <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Status</TableHead>
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
                      <TableCell>
                        <Badge variant="secondary">
                          {ROLE_LABEL[u.role as Role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{u.base_scope}</TableCell>
                      <TableCell>
                        <Badge
                          variant={u.active ? "outline" : "secondary"}
                          className={
                            u.active ? "text-emerald-500" : "text-muted-foreground"
                          }
                        >
                          {u.active ? "Ativo" : "Inativo"}
                        </Badge>
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

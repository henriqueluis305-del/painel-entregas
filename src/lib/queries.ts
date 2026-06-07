import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { Role } from "@/lib/permissions"

export type Operacao = {
  id: string
  slug: string
  label: string
  active: boolean
}
export type Base = {
  id: string
  operacao_id: string
  slug: string
  label: string
  active: boolean
}
export type OperacaoWithBases = Operacao & { bases: Base[] }

export type UserRow = {
  id: string
  email: string
  empresa: string | null
  role: Role
  base_scope: string
  is_admin: boolean
}

export async function getOperacoesWithBases(): Promise<OperacaoWithBases[]> {
  const sb = createAdminClient()
  const [{ data: ops }, { data: bases }] = await Promise.all([
    sb.from("operacao").select("id, slug, label, active").order("label"),
    sb.from("base").select("id, operacao_id, slug, label, active").order("slug"),
  ])
  return (ops ?? []).map((o) => ({
    ...o,
    bases: (bases ?? []).filter((b) => b.operacao_id === o.id),
  }))
}

export async function getDashboardStats() {
  const sb = createAdminClient()
  const [ops, bases, users, sla] = await Promise.all([
    sb.from("operacao").select("*", { count: "exact", head: true }),
    sb.from("base").select("*", { count: "exact", head: true }),
    sb.from("app_user").select("*", { count: "exact", head: true }),
    sb.from("sla_ds_record").select("*", { count: "exact", head: true }),
  ])
  return {
    operacoes: ops.count ?? 0,
    bases: bases.count ?? 0,
    usuarios: users.count ?? 0,
    slaDs: sla.count ?? 0,
  }
}

export async function getUsers(): Promise<UserRow[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from("app_user")
    .select("id, email, empresa, role, base_scope, is_admin")
    .order("empresa")
  return (data as UserRow[]) ?? []
}

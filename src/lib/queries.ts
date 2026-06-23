import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { Role } from "@/lib/permissions"

export type Operacao = {
  id: string
  slug: string
  label: string
  active: boolean
  in_sidebar: boolean
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
  operacao_id: string | null
  is_admin: boolean
  active: boolean
  approval_status: "pending" | "approved" | "rejected"
  sidebar_operacoes: string[] | null
  created_at: string
}

export async function getOperacoesWithBases(): Promise<OperacaoWithBases[]> {
  const sb = createAdminClient()
  const [{ data: ops }, { data: bases }] = await Promise.all([
    sb.from("operacao").select("id, slug, label, active, in_sidebar").order("label"),
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

export async function getOperacaoBySlug(slug: string) {
  const sb = createAdminClient()
  const { data: op } = await sb
    .from("operacao")
    .select("id, slug, label")
    .eq("slug", slug)
    .single<Operacao>()
  if (!op) return null
  const { data: bases } = await sb
    .from("base")
    .select("id, operacao_id, slug, label, active")
    .eq("operacao_id", op.id)
    .order("slug")
  return { ...op, bases: (bases as Base[]) ?? [] }
}

export async function getUsers(): Promise<UserRow[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from("app_user")
    .select(
      "id, email, empresa, role, base_scope, operacao_id, is_admin, active, approval_status, sidebar_operacoes, created_at",
    )
    .order("empresa")
  return (data as UserRow[]) ?? []
}

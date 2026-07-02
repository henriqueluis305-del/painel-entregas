import "server-only"

import { query } from "@painel/db"
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
  cargo: string | null
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
  const [ops, bases] = await Promise.all([
    query<Operacao>(
      `select id, slug, label, active, in_sidebar from operacao order by label`,
    ),
    query<Base>(
      `select id, operacao_id, slug, label, active from base order by slug`,
    ),
  ])
  return ops.map((o) => ({
    ...o,
    bases: bases.filter((b) => b.operacao_id === o.id),
  }))
}

export async function getDashboardStats() {
  const [row] = await query<{
    operacoes: number
    bases: number
    usuarios: number
    sla_ds: number
  }>(
    `select
       (select count(*)::int from operacao)      as operacoes,
       (select count(*)::int from base)          as bases,
       (select count(*)::int from app_user)      as usuarios,
       (select count(*)::int from sla_ds_record) as sla_ds`,
  )
  return {
    operacoes: row?.operacoes ?? 0,
    bases: row?.bases ?? 0,
    usuarios: row?.usuarios ?? 0,
    slaDs: row?.sla_ds ?? 0,
  }
}

export async function getOperacaoBySlug(slug: string) {
  const [op] = await query<Operacao>(
    `select id, slug, label, active, in_sidebar from operacao where slug = $1`,
    [slug],
  )
  if (!op) return null
  const bases = await query<Base>(
    `select id, operacao_id, slug, label, active from base where operacao_id = $1 order by slug`,
    [op.id],
  )
  return { ...op, bases }
}

export async function getUsers(): Promise<UserRow[]> {
  return query<UserRow>(
    `select id, email, empresa, cargo, role, base_scope, operacao_id, is_admin,
            active, approval_status, sidebar_operacoes, created_at::text as created_at
       from app_user
      order by empresa nulls last`,
  )
}

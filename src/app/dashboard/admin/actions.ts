"use server"

import { revalidatePath } from "next/cache"

import { query } from "@painel/db"
import { authProvider } from "@painel/auth"
import { getSessionProfile, requirePerm } from "@/lib/auth"
import { PERMS, type Role } from "@/lib/permissions"

export type ActionState = { ok: boolean; error?: string }

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function revalidate() {
  revalidatePath("/dashboard/admin")
  revalidatePath("/dashboard", "layout")
}

/** Mensagem amigável p/ violação de unicidade (slug/email duplicado). */
function pgError(err: unknown): string {
  const e = err as { code?: string; message?: string }
  if (e?.code === "23505") return "Já existe um registro com esse nome."
  return e?.message ?? "Erro ao salvar."
}

// ===================== Operações =====================

export async function createOperacao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePerm(PERMS.MANAGE_BASES)
  const label = String(formData.get("label") ?? "").trim()
  if (!label) return { ok: false, error: "Informe o nome da operação." }
  try {
    await query(`insert into operacao (slug, label) values ($1, $2)`, [slugify(label), label])
  } catch (err) {
    return { ok: false, error: pgError(err) }
  }
  revalidate()
  return { ok: true }
}

export async function updateOperacao(id: string, label: string) {
  await requirePerm(PERMS.MANAGE_BASES)
  await query(`update operacao set label = $2, slug = $3 where id::text = $1`, [
    id,
    label.trim(),
    slugify(label),
  ])
  revalidate()
}

export async function deleteOperacao(id: string) {
  await requirePerm(PERMS.MANAGE_BASES)
  await query(`delete from operacao where id::text = $1`, [id])
  revalidate()
}

export async function setOperacaoSidebar(id: string, value: boolean) {
  await requirePerm(PERMS.MANAGE_BASES)
  await query(`update operacao set in_sidebar = $2 where id::text = $1`, [id, value])
  revalidate()
}

// ===================== Bases =====================

export async function createBase(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePerm(PERMS.MANAGE_BASES)
  const operacao_id = String(formData.get("operacao_id") ?? "")
  const label = String(formData.get("label") ?? "").trim()
  if (!operacao_id) return { ok: false, error: "Operação inválida." }
  if (!label) return { ok: false, error: "Informe o nome da base." }
  try {
    await query(`insert into base (operacao_id, slug, label) values ($1, $2, $3)`, [
      operacao_id,
      slugify(label),
      label,
    ])
  } catch (err) {
    return { ok: false, error: pgError(err) }
  }
  revalidate()
  return { ok: true }
}

export async function updateBase(id: string, label: string) {
  await requirePerm(PERMS.MANAGE_BASES)
  await query(`update base set label = $2, slug = $3 where id::text = $1`, [
    id,
    label.trim(),
    slugify(label),
  ])
  revalidate()
}

export async function deleteBase(id: string) {
  await requirePerm(PERMS.MANAGE_BASES)
  await query(`delete from base where id::text = $1`, [id])
  revalidate()
}

/** Habilita/desabilita a base globalmente (disponível para seleção). */
export async function setBaseActive(id: string, value: boolean) {
  await requirePerm(PERMS.MANAGE_BASES)
  await query(`update base set active = $2 where id::text = $1`, [id, value])
  revalidate()
}

// ===================== Usuários =====================

export type UpdateUserPayload = {
  id: string
  empresa: string
  cargo: string
  email: string
  role: Role
  base_scope: string
  operacao_id: string | null
  is_admin: boolean
  sidebar_operacoes: string[] | null // null = segue o padrão
  password?: string // se preenchido, redefine a senha
}

async function applyUserUpdate(
  payload: UpdateUserPayload,
  extra: { approval_status?: string; active?: boolean } = {},
): Promise<ActionState> {
  const { id, empresa, cargo, email, role, base_scope, operacao_id, is_admin, sidebar_operacoes, password } =
    payload
  if (password && password.length < 8) {
    return { ok: false, error: "A senha precisa ter ao menos 8 caracteres." }
  }
  try {
    await query(
      `update app_user
          set empresa = $2, cargo = $3, email = $4, role = $5, base_scope = $6,
              operacao_id = $7, is_admin = $8, sidebar_operacoes = $9,
              approval_status = coalesce($10, approval_status),
              active = coalesce($11, active)
        where id = $1`,
      [
        id,
        empresa.trim() || null,
        cargo.trim() || null,
        email.trim(),
        role,
        base_scope,
        base_scope === "SINGLE" ? operacao_id : null,
        is_admin,
        sidebar_operacoes,
        extra.approval_status ?? null,
        extra.active ?? null,
      ],
    )
  } catch (err) {
    return { ok: false, error: pgError(err) }
  }

  // Identidade (e-mail/senha) fica no provedor de auth — hoje Supabase, depois Cognito.
  const authUpdate: { email?: string; password?: string } = {}
  if (email.trim()) authUpdate.email = email.trim()
  if (password) authUpdate.password = password
  if (Object.keys(authUpdate).length) {
    const res = await authProvider().admin.updateUser(id, authUpdate)
    if (!res.ok) return { ok: false, error: res.error ?? "Erro ao atualizar credenciais." }
  }
  revalidate()
  return { ok: true }
}

export async function updateUser(
  payload: UpdateUserPayload,
): Promise<ActionState> {
  await requirePerm(PERMS.MANAGE_USERS)
  return applyUserUpdate(payload)
}

/** Aprova um cadastro pendente: salva os campos revisados, ativa e desbane. */
export async function approveUser(
  payload: UpdateUserPayload,
): Promise<ActionState> {
  await requirePerm(PERMS.MANAGE_USERS)
  const result = await applyUserUpdate(payload, {
    approval_status: "approved",
    active: true,
  })
  if (!result.ok) return result
  await authProvider().admin.setLoginBlocked(payload.id, false)
  revalidate()
  return { ok: true }
}

/** Rejeita um cadastro pendente. Continua banido; fica visível pra auditoria. */
export async function rejectUser(id: string): Promise<ActionState> {
  await requirePerm(PERMS.MANAGE_USERS)
  try {
    await query(`update app_user set approval_status = 'rejected' where id = $1`, [id])
  } catch (err) {
    return { ok: false, error: pgError(err) }
  }
  revalidate()
  return { ok: true }
}

export async function setUserActive(id: string, active: boolean) {
  const session = await requirePerm(PERMS.MANAGE_USERS)
  if (session.profile?.id === id && !active) {
    throw new Error("Você não pode inativar a si mesmo.")
  }
  await query(`update app_user set active = $2 where id = $1`, [id, active])
  // bane/desbane no provedor de auth (bloqueia/desbloqueia login)
  await authProvider().admin.setLoginBlocked(id, !active)
  revalidate()
}

export async function deleteUser(id: string) {
  const session = await requirePerm(PERMS.MANAGE_USERS)
  if (session.profile?.id === id) {
    throw new Error("Você não pode excluir a si mesmo.")
  }
  await query(`delete from app_user where id = $1`, [id])
  await authProvider().admin.deleteUser(id)
  revalidate()
}

// usado para o guard de self no client
export async function getCurrentUserId() {
  const session = await getSessionProfile()
  return session?.profile?.id ?? null
}

"use server"

import { revalidatePath } from "next/cache"

import { getSessionProfile, requirePerm } from "@/lib/auth"
import { PERMS, type Role } from "@/lib/permissions"
import { createAdminClient } from "@/lib/supabase/admin"

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

// ===================== Operações =====================

export async function createOperacao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePerm(PERMS.MANAGE_BASES)
  const label = String(formData.get("label") ?? "").trim()
  if (!label) return { ok: false, error: "Informe o nome da operação." }
  const sb = createAdminClient()
  const { error } = await sb
    .from("operacao")
    .insert({ slug: slugify(label), label })
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

export async function updateOperacao(id: string, label: string) {
  await requirePerm(PERMS.MANAGE_BASES)
  const sb = createAdminClient()
  await sb
    .from("operacao")
    .update({ label: label.trim(), slug: slugify(label) })
    .eq("id", id)
  revalidate()
}

export async function deleteOperacao(id: string) {
  await requirePerm(PERMS.MANAGE_BASES)
  const sb = createAdminClient()
  await sb.from("operacao").delete().eq("id", id)
  revalidate()
}

export async function setOperacaoSidebar(id: string, value: boolean) {
  await requirePerm(PERMS.MANAGE_BASES)
  const sb = createAdminClient()
  await sb.from("operacao").update({ in_sidebar: value }).eq("id", id)
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
  const sb = createAdminClient()
  const { error } = await sb
    .from("base")
    .insert({ operacao_id, slug: slugify(label), label })
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

export async function updateBase(id: string, label: string) {
  await requirePerm(PERMS.MANAGE_BASES)
  const sb = createAdminClient()
  await sb
    .from("base")
    .update({ label: label.trim(), slug: slugify(label) })
    .eq("id", id)
  revalidate()
}

export async function deleteBase(id: string) {
  await requirePerm(PERMS.MANAGE_BASES)
  const sb = createAdminClient()
  await sb.from("base").delete().eq("id", id)
  revalidate()
}

/** Habilita/desabilita a base globalmente (disponível para seleção). */
export async function setBaseActive(id: string, value: boolean) {
  await requirePerm(PERMS.MANAGE_BASES)
  const sb = createAdminClient()
  await sb.from("base").update({ active: value }).eq("id", id)
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
  sb: ReturnType<typeof createAdminClient>,
  payload: UpdateUserPayload,
  extra: Record<string, unknown> = {},
): Promise<ActionState> {
  const { id, empresa, cargo, email, role, base_scope, operacao_id, is_admin, sidebar_operacoes, password } =
    payload
  if (password && password.length < 8) {
    return { ok: false, error: "A senha precisa ter ao menos 8 caracteres." }
  }
  const { error } = await sb
    .from("app_user")
    .update({
      empresa: empresa.trim() || null,
      cargo: cargo.trim() || null,
      email: email.trim(),
      role,
      base_scope,
      operacao_id: base_scope === "SINGLE" ? operacao_id : null,
      is_admin,
      sidebar_operacoes,
      ...extra,
    })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }

  const authUpdate: { email?: string; password?: string } = {}
  if (email.trim()) authUpdate.email = email.trim()
  if (password) authUpdate.password = password
  if (Object.keys(authUpdate).length) {
    const { error: authError } = await sb.auth.admin.updateUserById(id, authUpdate)
    if (authError) return { ok: false, error: authError.message }
  }
  revalidate()
  return { ok: true }
}

export async function updateUser(
  payload: UpdateUserPayload,
): Promise<ActionState> {
  await requirePerm(PERMS.MANAGE_USERS)
  const sb = createAdminClient()
  return applyUserUpdate(sb, payload)
}

/** Aprova um cadastro pendente: salva os campos revisados, ativa e desbane. */
export async function approveUser(
  payload: UpdateUserPayload,
): Promise<ActionState> {
  await requirePerm(PERMS.MANAGE_USERS)
  const sb = createAdminClient()
  const result = await applyUserUpdate(sb, payload, {
    approval_status: "approved",
    active: true,
  })
  if (!result.ok) return result
  await sb.auth.admin.updateUserById(payload.id, { ban_duration: "none" })
  revalidate()
  return { ok: true }
}

/** Rejeita um cadastro pendente. Continua banido; fica visível pra auditoria. */
export async function rejectUser(id: string): Promise<ActionState> {
  await requirePerm(PERMS.MANAGE_USERS)
  const sb = createAdminClient()
  const { error } = await sb
    .from("app_user")
    .update({ approval_status: "rejected" })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

export async function setUserActive(id: string, active: boolean) {
  const session = await requirePerm(PERMS.MANAGE_USERS)
  if (session.profile?.id === id && !active) {
    throw new Error("Você não pode inativar a si mesmo.")
  }
  const sb = createAdminClient()
  await sb.from("app_user").update({ active }).eq("id", id)
  // bane/desbane no Supabase Auth (bloqueia/desbloqueia login)
  await sb.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : "876000h",
  })
  revalidate()
}

export async function deleteUser(id: string) {
  const session = await requirePerm(PERMS.MANAGE_USERS)
  if (session.profile?.id === id) {
    throw new Error("Você não pode excluir a si mesmo.")
  }
  const sb = createAdminClient()
  await sb.from("app_user").delete().eq("id", id)
  await sb.auth.admin.deleteUser(id)
  revalidate()
}

// usado para o guard de self no client
export async function getCurrentUserId() {
  const session = await getSessionProfile()
  return session?.profile?.id ?? null
}

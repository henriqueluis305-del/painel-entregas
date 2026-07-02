"use server"

import { revalidatePath } from "next/cache"

import { query } from "@painel/db"
import { authProvider, type SignInResult } from "@painel/auth"

export type SignupResult = { ok: boolean; error?: string }

/** Login com e-mail/senha via provedor de identidade (Supabase hoje, Cognito depois). */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (!email || !password) return { ok: false, error: "Informe e-mail e senha." }
  return authProvider().signIn(email, password)
}

/** Encerra a sessão no provedor (limpa cookies). */
export async function signOut(): Promise<void> {
  await authProvider().signOut()
}

export async function requestSignup(
  _prev: SignupResult,
  formData: FormData,
): Promise<SignupResult> {
  const nome = String(formData.get("nome") ?? "").trim()
  const cargo = String(formData.get("cargo") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!nome) return { ok: false, error: "Informe seu nome." }
  if (!cargo) return { ok: false, error: "Informe seu cargo." }
  if (!email) return { ok: false, error: "Informe seu e-mail." }
  if (password.length < 8) return { ok: false, error: "A senha precisa ter ao menos 8 caracteres." }

  const provider = authProvider()

  // Cadastro nasce bloqueado no provedor — login só depois do admin aprovar.
  const created = await provider.admin.createUser({ email, password, blocked: true })
  if (!created.ok) return { ok: false, error: created.error }

  try {
    await query(
      `insert into app_user (id, email, empresa, cargo, role, base_scope, is_admin, active, approval_status)
       values ($1, $2, $3, $4, 'USER', 'SINGLE', false, false, 'pending')`,
      [created.id, email, nome, cargo],
    )
  } catch {
    await provider.admin.deleteUser(created.id) // evita conta órfã na Auth sem perfil
    return { ok: false, error: "Não foi possível criar o cadastro." }
  }

  revalidatePath("/dashboard/admin")
  return { ok: true }
}

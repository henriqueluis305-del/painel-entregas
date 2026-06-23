"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"

export type SignupResult = { ok: boolean; error?: string }

// Cadastro fica banido na Auth até um admin aprovar — login normal já bloqueia.
const PENDING_BAN_DURATION = "876000h"

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

  const sb = createAdminClient()

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ban_duration: PENDING_BAN_DURATION,
  })
  if (error || !data.user) {
    const msg = error?.message ?? ""
    if (/already.*registered|already.*exists/i.test(msg)) {
      return { ok: false, error: "Já existe um cadastro com esse e-mail." }
    }
    return { ok: false, error: "Não foi possível criar o cadastro." }
  }

  const { error: profileError } = await sb.from("app_user").insert({
    id: data.user.id,
    email,
    empresa: nome,
    cargo,
    role: "USER", // perfil de permissão é decidido pelo admin na aprovação
    base_scope: "SINGLE",
    is_admin: false,
    active: false,
    approval_status: "pending",
  })
  if (profileError) {
    await sb.auth.admin.deleteUser(data.user.id) // evita conta órfã na Auth sem perfil
    return { ok: false, error: "Não foi possível criar o cadastro." }
  }

  revalidatePath("/dashboard/admin")
  return { ok: true }
}

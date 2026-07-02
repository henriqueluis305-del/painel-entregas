// Provedor Supabase Auth (o atual). Identidade no Supabase; perfil no Postgres.
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

import type { AuthProvider, CreateUserResult, SignInResult } from "./types"

/** Duração do "ban" de cadastro pendente (até o admin aprovar). */
const PENDING_BAN_DURATION = "876000h"

async function serverClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // chamado de um Server Component — ignorável (o middleware renova a sessão)
          }
        },
      },
    },
  )
}

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export const supabaseProvider: AuthProvider = {
  profileKey: "id",

  async getUser() {
    const supabase = await serverClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    return { id: user.id, email: user.email ?? "" }
  },

  async signIn(email, password): Promise<SignInResult> {
    const supabase = await serverClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return { ok: true }
    if (/banned/i.test(error.message)) {
      return { ok: false, error: "Cadastro pendente de aprovação.", pending: true }
    }
    return { ok: false, error: "E-mail ou senha inválidos." }
  },

  async signOut() {
    const supabase = await serverClient()
    await supabase.auth.signOut()
  },

  admin: {
    async createUser({ email, password, blocked }): Promise<CreateUserResult> {
      const sb = adminClient()
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        ...(blocked ? { ban_duration: PENDING_BAN_DURATION } : {}),
      })
      if (error || !data.user) {
        const msg = error?.message ?? ""
        if (/already.*registered|already.*exists/i.test(msg)) {
          return { ok: false, error: "Já existe um cadastro com esse e-mail.", exists: true }
        }
        return { ok: false, error: "Não foi possível criar o cadastro." }
      }
      return { ok: true, id: data.user.id }
    },

    async updateUser(id, input) {
      const sb = adminClient()
      const { error } = await sb.auth.admin.updateUserById(id, input)
      return error ? { ok: false, error: error.message } : { ok: true }
    },

    async setLoginBlocked(id, blocked) {
      const sb = adminClient()
      await sb.auth.admin.updateUserById(id, {
        ban_duration: blocked ? PENDING_BAN_DURATION : "none",
      })
    },

    async deleteUser(id) {
      const sb = adminClient()
      await sb.auth.admin.deleteUser(id)
    },
  },
}

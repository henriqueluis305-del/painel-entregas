import { createClient as createAdmin } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import type { Role } from "@/lib/permissions"

export type Profile = {
  id: string
  email: string
  empresa: string | null
  role: Role
  is_admin: boolean
  base_scope: string
  extra_perms: string[]
  denied_perms: string[]
}

/** Usuário autenticado + perfil do banco (server-side). Null se não logado. */
export async function getSessionProfile(): Promise<{
  email: string
  profile: Profile | null
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Lê o perfil com service role (bypassa RLS/grants — só roda no servidor).
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data: profile } = await admin
    .from("app_user")
    .select(
      "id, email, empresa, role, is_admin, base_scope, extra_perms, denied_perms",
    )
    .eq("id", user.id)
    .single<Profile>()

  return { email: user.email ?? "", profile: profile ?? null }
}

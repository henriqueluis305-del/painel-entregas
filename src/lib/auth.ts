import { redirect } from "next/navigation"

import { query } from "@painel/db"
import { authProvider, type Profile } from "@painel/auth"
import { hasPerm, type Permission } from "@/lib/permissions"
import { getOperacaoBySlug } from "@/lib/queries"

export type { Profile }

/** Usuário autenticado + perfil do banco (server-side). Null se não logado. */
export async function getSessionProfile(): Promise<{
  email: string
  profile: Profile | null
} | null> {
  const provider = authProvider()
  const user = await provider.getUser()
  if (!user) return null

  // Perfil/permissões vivem no Postgres (app_user), fora do provedor de identidade.
  const [profile] = await query<Profile>(
    `select id, email, empresa, role, is_admin, base_scope, operacao_id,
            principal_operacao_id, active, sidebar_operacoes, extra_perms, denied_perms
       from app_user
      where ${provider.profileKey === "email" ? "email = $1" : "id = $1"}`,
    [provider.profileKey === "email" ? user.email : user.id],
  )

  return { email: user.email, profile: profile ?? null }
}

/** Garante sessão + permissão. Redireciona se faltar. Retorna a sessão. */
export async function requirePerm(perm: Permission) {
  const session = await getSessionProfile()
  if (!session) redirect("/login")
  if (!session.profile || !hasPerm(session.profile, perm)) redirect("/dashboard")
  return session
}

/**
 * Garante sessão + acesso à operação (mesma regra de escopo da sidebar:
 * admin/ALL vê tudo, SINGLE/OP_WIDE só a própria operacao_id). Bloqueia o
 * acesso direto por URL a operações fora do escopo do usuário.
 */
export async function requireOperacaoAccess(slug: string) {
  const session = await getSessionProfile()
  if (!session) redirect("/login")
  if (!session.profile) redirect("/dashboard")
  const { profile } = session
  if (profile.is_admin || profile.base_scope === "ALL") return session
  const op = await getOperacaoBySlug(slug)
  if (!op || op.id !== profile.operacao_id) redirect("/dashboard")
  return session
}

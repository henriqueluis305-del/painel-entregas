import type { Role } from "./permissions"

/** Perfil do usuário na tabela app_user (fonte de verdade de permissão/escopo). */
export type Profile = {
  id: string
  email: string
  empresa: string | null
  role: Role
  is_admin: boolean
  base_scope: string
  operacao_id: string | null
  principal_operacao_id: string | null
  active: boolean
  sidebar_operacoes: string[] | null
  extra_perms: string[]
  denied_perms: string[]
}

/** Identidade autenticada devolvida pelo provedor (Supabase hoje, Cognito depois). */
export type AuthUser = { id: string; email: string }

export type SignInResult =
  | { ok: true }
  | { ok: false; error: string; pending?: boolean }

export type CreateUserResult =
  | { ok: true; id: string }
  | { ok: false; error: string; exists?: boolean }

/**
 * Contrato do provedor de identidade. O app só conversa com esta interface —
 * trocar Supabase→Cognito é trocar a implementação, sem tocar em telas/actions.
 * O perfil/permissões continuam SEMPRE no Postgres (app_user), fora do provedor.
 */
export interface AuthProvider {
  /** Coluna de app_user usada pra achar o perfil do usuário autenticado. */
  readonly profileKey: "id" | "email"
  /** Usuário autenticado da request atual (via cookies) ou null. */
  getUser(): Promise<AuthUser | null>
  signIn(email: string, password: string): Promise<SignInResult>
  signOut(): Promise<void>
  admin: {
    /** Cria identidade; blocked=true = não consegue logar até aprovação. */
    createUser(input: { email: string; password: string; blocked: boolean }): Promise<CreateUserResult>
    /** Atualiza e-mail e/ou senha da identidade. */
    updateUser(id: string, input: { email?: string; password?: string }): Promise<{ ok: boolean; error?: string }>
    /** Bloqueia/desbloqueia login (aprovação, inativação). */
    setLoginBlocked(id: string, blocked: boolean): Promise<void>
    deleteUser(id: string): Promise<void>
  }
}

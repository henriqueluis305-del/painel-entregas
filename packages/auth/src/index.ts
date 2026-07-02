// Ponto único de escolha do provedor de identidade (AUTH_MODE):
//   supabase       → Supabase Auth (default hoje)
//   cognito        → AWS Cognito (produção AWS)
//   cognito-local  → emulador cognito-local em Docker (dev espelho da AWS)
//   mock           → usuário fixo sem login (dev de telas; proibido em prod)
import type { AuthProvider } from "./types"
import { supabaseProvider } from "./supabase"
import { mockProvider } from "./mock"

export type { AuthProvider, AuthUser, Profile, SignInResult, CreateUserResult } from "./types"
export * from "./permissions"

export type AuthMode = "supabase" | "cognito" | "cognito-local" | "mock"

export function authMode(): AuthMode {
  return (process.env.AUTH_MODE as AuthMode) || "supabase"
}

export function authProvider(): AuthProvider {
  switch (authMode()) {
    case "mock":
      return mockProvider
    case "cognito":
    case "cognito-local": // mesmo provider; muda só o endpoint (COGNITO_ENDPOINT)
      throw new Error("Provider Cognito ainda não implementado (Fase 1 do plano AWS).")
    default:
      return supabaseProvider
  }
}

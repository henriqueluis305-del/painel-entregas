// Provedor MOCK — SÓ desenvolvimento. Pula o login e injeta um usuário fixo
// (DEV_USER_EMAIL), útil pra iterar telas sem provedor de identidade rodando.
// Guardado por NODE_ENV: nunca ativa em produção.
import type { AuthProvider } from "./types"

function assertDev() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_MODE=mock é proibido em produção.")
  }
}

export const mockProvider: AuthProvider = {
  // perfil resolvido por e-mail (o id do mock não existe na app_user)
  profileKey: "email",

  async getUser() {
    assertDev()
    const email = process.env.DEV_USER_EMAIL
    if (!email) return null
    return { id: `mock:${email}`, email }
  },

  async signIn() {
    assertDev()
    return { ok: true }
  },

  async signOut() {
    assertDev()
  },

  admin: {
    async createUser({ email }) {
      assertDev()
      return { ok: true, id: `mock:${email}` }
    },
    async updateUser() {
      assertDev()
      return { ok: true }
    },
    async setLoginBlocked() {
      assertDev()
    },
    async deleteUser() {
      assertDev()
    },
  },
}

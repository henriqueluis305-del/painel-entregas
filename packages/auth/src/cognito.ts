// Provedor AWS Cognito (produção AWS) e cognito-local (dev espelho).
// Identidade no User Pool; perfil/permissões continuam no Postgres (app_user).
//
// Sessão: tokens em cookies httpOnly. O middleware valida o idToken (JWT) a
// cada request e renova via refresh token quando expira — mesmo padrão do
// @supabase/ssr, sem ida ao Cognito no caminho feliz.
//
// env:
//   COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID / AWS_REGION
//   COGNITO_ENDPOINT → definido só p/ cognito-local (http://localhost:9229)
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { CognitoJwtVerifier } from "aws-jwt-verify"
import { JwtVerifier } from "aws-jwt-verify"

import type { AuthProvider, CreateUserResult, SignInResult } from "./types"

const ID_COOKIE = "painel_id_token"
const REFRESH_COOKIE = "painel_refresh_token"

const poolId = () => process.env.COGNITO_USER_POOL_ID!
const clientId = () => process.env.COGNITO_CLIENT_ID!
const localEndpoint = () => process.env.COGNITO_ENDPOINT // só cognito-local

const g = globalThis as unknown as {
  __cognitoClient?: CognitoIdentityProviderClient
  __cognitoVerifier?: { verify(token: string): Promise<Record<string, unknown>> }
}

function client(): CognitoIdentityProviderClient {
  return (g.__cognitoClient ??= new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    endpoint: localEndpoint(),
  }))
}

/** Verificador de JWT: Cognito real via JWKS oficial; cognito-local via issuer custom. */
function verifier() {
  if (g.__cognitoVerifier) return g.__cognitoVerifier
  const local = localEndpoint()
  if (local) {
    // cognito-local emite iss com o host de bind interno (0.0.0.0) — aceita ambos
    const u = new URL(local)
    const issuers = [
      `${local}/${poolId()}`,
      `${u.protocol}//0.0.0.0:${u.port}/${poolId()}`,
    ]
    g.__cognitoVerifier = JwtVerifier.create({
      issuer: issuers,
      audience: clientId(),
      jwksUri: `${local}/${poolId()}/.well-known/jwks.json`,
    }) as unknown as { verify(token: string): Promise<Record<string, unknown>> }
  } else {
    g.__cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId: poolId(),
      clientId: clientId(),
      tokenUse: "id",
    })
  }
  return g.__cognitoVerifier
}

type IdClaims = { sub: string; email?: string }

// O fetcher interno do aws-jwt-verify só aceita https; o cognito-local é http.
// No modo local, buscamos o JWKS uma vez via fetch e pré-carregamos no verifier.
let localJwksLoaded = false
async function ensureLocalJwks(v: ReturnType<typeof verifier>) {
  const local = localEndpoint()
  if (!local || localJwksLoaded) return
  const res = await fetch(`${local}/${poolId()}/.well-known/jwks.json`)
  ;(v as { cacheJwks(jwks: unknown): void }).cacheJwks(await res.json())
  localJwksLoaded = true
}

async function verifyIdToken(token: string): Promise<IdClaims | null> {
  try {
    const v = verifier()
    await ensureLocalJwks(v)
    const payload = (await v.verify(token)) as IdClaims
    return payload?.sub ? payload : null
  } catch {
    return null
  }
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
}

/** Renova o idToken com o refresh token. Null se o refresh não vale mais. */
async function refreshTokens(refreshToken: string): Promise<{ idToken: string } | null> {
  try {
    const res = await client().send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: clientId(),
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      }),
    )
    const idToken = res.AuthenticationResult?.IdToken
    return idToken ? { idToken } : null
  } catch {
    return null
  }
}

/** Acha o Username do pool a partir do sub (admin ops exigem Username). */
async function usernameById(id: string): Promise<string | null> {
  const res = await client().send(
    new ListUsersCommand({
      UserPoolId: poolId(),
      Filter: `sub = "${id}"`,
      Limit: 1,
    }),
  )
  return res.Users?.[0]?.Username ?? null
}

// ── Middleware (valida/renova sessão a cada request) ────────────────────────

export async function cognitoAuthenticate(request: NextRequest): Promise<NextResponse> {
  const idToken = request.cookies.get(ID_COOKIE)?.value
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value

  let valid = idToken ? (await verifyIdToken(idToken)) !== null : false
  let renewedId: string | null = null

  if (!valid && refresh) {
    const renewed = await refreshTokens(refresh)
    if (renewed) {
      valid = true
      renewedId = renewed.idToken
    }
  }

  const path = request.nextUrl.pathname
  const isAuthRoute = path === "/login"

  const redirect = (to: string) => {
    const url = request.nextUrl.clone()
    url.pathname = to
    const res = NextResponse.redirect(url)
    if (renewedId) res.cookies.set(ID_COOKIE, renewedId, cookieOpts)
    if (!valid) {
      res.cookies.delete(ID_COOKIE)
      res.cookies.delete(REFRESH_COOKIE)
    }
    return res
  }

  if (!valid && !isAuthRoute) return redirect("/login")
  if (valid && isAuthRoute) return redirect("/dashboard")

  // token renovado precisa chegar tanto na resposta quanto na request adiante
  if (renewedId) request.cookies.set(ID_COOKIE, renewedId)
  const res = NextResponse.next({ request })
  if (renewedId) res.cookies.set(ID_COOKIE, renewedId, cookieOpts)
  return res
}

// ── Provider ─────────────────────────────────────────────────────────────────

export const cognitoProvider: AuthProvider = {
  profileKey: "id", // app_user.id (text) guarda o sub do Cognito

  async getUser() {
    const store = await cookies()
    const token = store.get(ID_COOKIE)?.value
    if (!token) return null
    const claims = await verifyIdToken(token)
    if (!claims) return null
    return { id: claims.sub, email: claims.email ?? "" }
  },

  async signIn(email, password): Promise<SignInResult> {
    try {
      const res = await client().send(
        new InitiateAuthCommand({
          AuthFlow: "USER_PASSWORD_AUTH",
          ClientId: clientId(),
          AuthParameters: { USERNAME: email, PASSWORD: password },
        }),
      )
      const auth = res.AuthenticationResult
      if (!auth?.IdToken || !auth.RefreshToken) {
        return { ok: false, error: "E-mail ou senha inválidos." }
      }
      const store = await cookies()
      store.set(ID_COOKIE, auth.IdToken, cookieOpts)
      store.set(REFRESH_COOKIE, auth.RefreshToken, cookieOpts)
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // usuário desabilitado = cadastro aguardando aprovação do admin
      if (/disabled/i.test(msg)) {
        return { ok: false, error: "Cadastro pendente de aprovação.", pending: true }
      }
      return { ok: false, error: "E-mail ou senha inválidos." }
    }
  },

  async signOut() {
    const store = await cookies()
    store.delete(ID_COOKIE)
    store.delete(REFRESH_COOKIE)
  },

  admin: {
    async createUser({ email, password, blocked }): Promise<CreateUserResult> {
      try {
        const created = await client().send(
          new AdminCreateUserCommand({
            UserPoolId: poolId(),
            Username: email,
            MessageAction: "SUPPRESS", // sem e-mail de convite — senha vem do form
            UserAttributes: [
              { Name: "email", Value: email },
              { Name: "email_verified", Value: "true" },
            ],
          }),
        )
        const username = created.User?.Username ?? email
        const sub =
          created.User?.Attributes?.find((a) => a.Name === "sub")?.Value ?? username
        await client().send(
          new AdminSetUserPasswordCommand({
            UserPoolId: poolId(),
            Username: username,
            Password: password,
            Permanent: true,
          }),
        )
        if (blocked) {
          await client().send(
            new AdminDisableUserCommand({ UserPoolId: poolId(), Username: username }),
          )
        }
        return { ok: true, id: sub }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/exists/i.test(msg)) {
          return { ok: false, error: "Já existe um cadastro com esse e-mail.", exists: true }
        }
        return { ok: false, error: "Não foi possível criar o cadastro." }
      }
    },

    async updateUser(id, input) {
      const username = await usernameById(id)
      if (!username) return { ok: false, error: "Usuário não encontrado no Cognito." }
      try {
        if (input.email) {
          await client().send(
            new AdminUpdateUserAttributesCommand({
              UserPoolId: poolId(),
              Username: username,
              UserAttributes: [
                { Name: "email", Value: input.email },
                { Name: "email_verified", Value: "true" },
              ],
            }),
          )
        }
        if (input.password) {
          await client().send(
            new AdminSetUserPasswordCommand({
              UserPoolId: poolId(),
              Username: username,
              Password: input.password,
              Permanent: true,
            }),
          )
        }
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },

    async setLoginBlocked(id, blocked) {
      const username = await usernameById(id)
      if (!username) return
      const cmd = blocked
        ? new AdminDisableUserCommand({ UserPoolId: poolId(), Username: username })
        : new AdminEnableUserCommand({ UserPoolId: poolId(), Username: username })
      await client().send(cmd)
    },

    async deleteUser(id) {
      const username = await usernameById(id)
      if (!username) return
      await client().send(
        new AdminDeleteUserCommand({ UserPoolId: poolId(), Username: username }),
      )
    },
  },
}

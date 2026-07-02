// Middleware de sessão por provedor. O proxy.ts do app delega pra cá:
// valida/renova a sessão a cada request e aplica os redirects de login.
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { authMode } from "./index"

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  return NextResponse.redirect(url)
}

/** Supabase: renova o token via cookies e sincroniza na resposta (comportamento atual). */
async function supabaseMiddleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthRoute = path === "/login"

  if (!user && !isAuthRoute) return redirectTo(request, "/login")
  if (user && isAuthRoute) return redirectTo(request, "/dashboard")

  return supabaseResponse
}

/** Cognito: valida o JWT do cookie de sessão (implementado na Fase 1 do plano AWS). */
async function cognitoMiddleware(_request: NextRequest): Promise<NextResponse> {
  throw new Error("Provider Cognito ainda não implementado (Fase 1 do plano AWS).")
}

/** Mock: usuário sempre presente; só tira o /login da frente. */
function mockMiddleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/login") return redirectTo(request, "/dashboard")
  return NextResponse.next({ request })
}

export async function authMiddleware(request: NextRequest): Promise<NextResponse> {
  switch (authMode()) {
    case "mock":
      return mockMiddleware(request)
    case "cognito":
    case "cognito-local":
      return cognitoMiddleware(request)
    default:
      return supabaseMiddleware(request)
  }
}

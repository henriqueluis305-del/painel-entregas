import { type NextRequest } from "next/server"

import { authMiddleware } from "@painel/auth/middleware"

export async function proxy(request: NextRequest) {
  return await authMiddleware(request)
}

export const config = {
  matcher: [
    // tudo, exceto estáticos e imagens
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}

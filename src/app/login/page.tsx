"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Loader2Icon, MailIcon, LockIcon, UserIcon, BriefcaseIcon } from "lucide-react"

import { requestSignup, signIn, type SignupResult } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const email = String(form.get("email") ?? "").trim()
    const password = String(form.get("password") ?? "")

    // Login roda no servidor (server action) — o client não conversa com o
    // provedor de identidade; trocar Supabase→Cognito não toca nesta tela.
    const result = await signIn(email, password)

    if (!result.ok) {
      setError(
        result.pending
          ? "Seu cadastro ainda está pendente de aprovação por um administrador."
          : result.error,
      )
      setLoading(false)
      return
    }
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <>
      <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <MailIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              required
              className="pl-9"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <LockIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className="pl-9"
            />
          </div>
        </div>
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2Icon className="size-4 animate-spin" />}
          Entrar
        </Button>
      </form>
      <p className="text-muted-foreground mt-4 text-center text-sm">
        Não tem conta?{" "}
        <button type="button" onClick={onSwitch} className="text-primary underline-offset-4 hover:underline">
          Cadastre-se
        </button>
      </p>
    </>
  )
}

function SignupForm({ onSwitch }: { onSwitch: () => void }) {
  const [state, formAction, pending] = useActionState<SignupResult, FormData>(requestSignup, {
    ok: false,
  })

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="font-medium">Cadastro enviado!</p>
        <p className="text-muted-foreground text-sm">
          Aguarde um administrador aprovar seu acesso. Você receberá login normalmente após a aprovação.
        </p>
        <Button type="button" variant="outline" className="mt-2" onClick={onSwitch}>
          Voltar para o login
        </Button>
      </div>
    )
  }

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="nome">Nome</Label>
          <div className="relative">
            <UserIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input id="nome" name="nome" placeholder="Seu nome" required className="pl-9" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cargo">Cargo</Label>
          <div className="relative">
            <BriefcaseIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input id="cargo" name="cargo" placeholder="Ex.: Desenvolvedor" required className="pl-9" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="signup-email">E-mail</Label>
          <div className="relative">
            <MailIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="signup-email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              required
              className="pl-9"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="signup-password">Senha</Label>
          <div className="relative">
            <LockIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="signup-password"
              name="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
              className="pl-9"
            />
          </div>
        </div>
        {state.error && (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          Cadastrar
        </Button>
      </form>
      <p className="text-muted-foreground mt-4 text-center text-sm">
        Já tem conta?{" "}
        <button type="button" onClick={onSwitch} className="text-primary underline-offset-4 hover:underline">
          Entrar
        </button>
      </p>
    </>
  )
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login")

  return (
    <div className="bg-background relative flex min-h-svh items-center justify-center p-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% -10%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 60%)",
        }}
      />
      <Card className="relative w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Image
            src="/logo.png"
            alt="Logo"
            width={160}
            height={48}
            className="mb-2 h-12 w-auto object-contain"
            priority
          />
          <CardTitle className="text-xl">Painel de Entregas</CardTitle>
          <CardDescription>
            {mode === "login" ? "Entre com suas credenciais" : "Crie sua conta para solicitar acesso"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            <LoginForm onSwitch={() => setMode("signup")} />
          ) : (
            <SignupForm onSwitch={() => setMode("login")} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

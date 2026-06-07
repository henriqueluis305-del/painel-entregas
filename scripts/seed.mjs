import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const OPERACOES = [
  { slug: "shopee", label: "Shopee" },
  { slug: "meli", label: "Mercado Livre" },
  { slug: "jt", label: "J&T" },
  { slug: "loggi", label: "Loggi" },
  { slug: "imile", label: "iMile" },
]

const SHOPEE_BASES = [
  { slug: "xpt-adr-02", label: "XPT-ADR-02" },
  { slug: "xpt-ctn-01", label: "XPT-CTN-01" },
  { slug: "xpt-lrs-01", label: "XPT-LRS-01" },
  { slug: "xpt-nvc-01", label: "XPT-NVC-01" },
  { slug: "xpt-sqr-01", label: "XPT-SQR-01" },
]

// 1) operações
const { error: opErr } = await sb
  .from("operacao")
  .upsert(OPERACOES, { onConflict: "slug" })
if (opErr) {
  console.error("operacao:", opErr.message)
  process.exit(1)
}
console.log("operacoes ok")

// 2) bases da shopee
const { data: shopee } = await sb
  .from("operacao")
  .select("id")
  .eq("slug", "shopee")
  .single()

const bases = SHOPEE_BASES.map((b) => ({ ...b, operacao_id: shopee.id }))
const { error: baseErr } = await sb
  .from("base")
  .upsert(bases, { onConflict: "operacao_id,slug" })
if (baseErr) {
  console.error("base:", baseErr.message)
  process.exit(1)
}
console.log("bases ok")

// resumo
for (const t of ["operacao", "base"]) {
  const { count } = await sb.from(t).select("*", { count: "exact", head: true })
  console.log(t.padEnd(12), count)
}

"use server"

import { revalidatePath } from "next/cache"

import { requirePerm } from "@/lib/auth"
import { PERMS } from "@/lib/permissions"
import { createAdminClient } from "@/lib/supabase/admin"

export type ActionState = { ok: boolean; error?: string }

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function createOperacao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePerm(PERMS.MANAGE_BASES)
  const label = String(formData.get("label") ?? "").trim()
  if (!label) return { ok: false, error: "Informe o nome da operação." }
  const slug = slugify(label)
  const sb = createAdminClient()
  const { error } = await sb.from("operacao").insert({ slug, label })
  if (error) return { ok: false, error: error.message }
  revalidatePath("/dashboard/admin")
  return { ok: true }
}

export async function createBase(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePerm(PERMS.MANAGE_BASES)
  const operacao_id = String(formData.get("operacao_id") ?? "")
  const label = String(formData.get("label") ?? "").trim()
  if (!operacao_id) return { ok: false, error: "Operação inválida." }
  if (!label) return { ok: false, error: "Informe o nome da base." }
  const slug = slugify(label)
  const sb = createAdminClient()
  const { error } = await sb.from("base").insert({ operacao_id, slug, label })
  if (error) return { ok: false, error: error.message }
  revalidatePath("/dashboard/admin")
  return { ok: true }
}

import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

export type UploadLogRow = {
  id: number
  user_email: string | null
  kind: string
  filenames: string | null
  rows: number
  summary: string | null
  created_at: string
}

const KIND_LABEL: Record<string, string> = {
  backlog: "Backlog",
  tracking: "Tracking",
  ds: "DS",
  sla: "SLA",
  pnr: "PNR",
}

export function uploadKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind
}

export async function getUploadLog(limit = 20): Promise<UploadLogRow[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from("shopee_upload_log")
    .select("id, user_email, kind, filenames, rows, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as UploadLogRow[]
}

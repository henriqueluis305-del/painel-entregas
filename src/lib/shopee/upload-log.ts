import "server-only"

import { query } from "@painel/db"

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
  // id é bigserial (pg devolve int8 como string) → ::int; created_at ::text p/ manter string
  return query<UploadLogRow>(
    `select id::int as id, user_email, kind, filenames, rows, summary, created_at::text as created_at
       from shopee_upload_log
      order by created_at desc
      limit $1`,
    [limit],
  )
}

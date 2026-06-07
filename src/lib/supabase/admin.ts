import { createClient } from "@supabase/supabase-js"

/** Client com service role — server-only. Bypassa RLS. NUNCA usar no client. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

import { redirect } from "next/navigation"

import { SubtabPlaceholder } from "@/components/shopee/subtab-placeholder"
import { getSessionProfile } from "@/lib/auth"
import { SHOPEE_BASE_PATH } from "@/lib/shopee"

export default async function UploadsPage() {
  const session = await getSessionProfile()
  // Guard servidor: somente ADM. Não confiar na ocultação no nav.
  if (!session?.profile?.is_admin) redirect(`${SHOPEE_BASE_PATH}/geral`)

  return (
    <SubtabPlaceholder
      title="Uploads"
      description="Central de upload de dados da operação (somente administradores)."
      planned={[
        "Upload de CSV/XLSX para bucket privado (Supabase Storage)",
        "Processamento server-side com barra de progresso",
        "Preview de diff + confirmação antes de gravar no DB",
        "Histórico de uploads e reprocessamento",
      ]}
    />
  )
}

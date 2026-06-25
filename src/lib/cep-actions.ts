"use server"

import { getSessionProfile } from "@/lib/auth"
import { lookupCeps, type CepInfo } from "@/lib/cep"

/**
 * Resolve CEPs p/ o cliente (cache-aside no servidor: cep_cache → ViaCEP).
 * Retorna array (Map não serializa pela fronteira da server action).
 * Exige login p/ não virar proxy aberto de chamadas ao ViaCEP.
 */
export async function resolveCepsAction(ceps: string[]): Promise<CepInfo[]> {
  const session = await getSessionProfile()
  if (!session) throw new Error("Não autorizado")
  const map = await lookupCeps(ceps)
  return [...map.values()]
}

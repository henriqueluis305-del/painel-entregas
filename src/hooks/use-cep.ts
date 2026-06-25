"use client"

import { useEffect, useState } from "react"

import { resolveCepsAction } from "@/lib/cep-actions"
import type { CepInfo } from "@/lib/cep"

// Cache de sessão do navegador: sobrevive a remontagens de componente,
// some no reload da página (aí o cep_cache do servidor assume). Compartilhado
// por todo o app, então um CEP visto numa tela não é rebuscado em outra.
const memo = new Map<string, CepInfo | null>() // null = consultado e não encontrado
const inflight = new Map<string, Promise<CepInfo | null>>() // dedupe de chamadas simultâneas

const onlyDigits = (raw: string | null | undefined) => (raw ?? "").replace(/\D+/g, "")

/**
 * Resolve vários CEPs reaproveitando o memo de sessão: só os realmente
 * desconhecidos (sem memo e sem chamada em voo) batem na server action,
 * e num único round-trip em lote. CEPs inválidos saem do resultado.
 */
export async function resolveCepsCached(rawCeps: string[]): Promise<Map<string, CepInfo>> {
  const ceps = [...new Set(rawCeps.map(onlyDigits).filter((c) => c.length === 8))]
  const need: string[] = [] // sem memo e sem inflight → disparar
  const awaiting: string[] = [] // já tem promise em voo → só aguardar

  for (const cep of ceps) {
    if (memo.has(cep)) continue
    if (inflight.has(cep)) awaiting.push(cep)
    else need.push(cep)
  }

  if (need.length) {
    const batch = resolveCepsAction(need)
      .then((arr) => {
        const byCep = new Map(arr.map((info) => [info.cep, info]))
        for (const cep of need) {
          memo.set(cep, byCep.get(cep) ?? null) // memoriza inclusive "não encontrado"
          inflight.delete(cep)
        }
        return byCep
      })
      .catch((e) => {
        for (const cep of need) inflight.delete(cep) // não memoriza em erro → permite retry
        throw e
      })
    for (const cep of need) inflight.set(cep, batch.then((m) => m.get(cep) ?? null))
    awaiting.push(...need)
  }

  await Promise.all(
    awaiting.map(async (cep) => {
      try {
        await inflight.get(cep)
      } catch {
        /* erro já tratado no batch; CEP fica fora do resultado */
      }
    }),
  )

  const result = new Map<string, CepInfo>()
  for (const cep of ceps) {
    const info = memo.get(cep)
    if (info) result.set(cep, info)
  }
  return result
}

/** Resolve um CEP só, com cache de sessão. Útil em formulários. */
export function useCep(rawCep: string | null | undefined): { info: CepInfo | null; loading: boolean } {
  const [info, setInfo] = useState<CepInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const cep = onlyDigits(rawCep)
    if (cep.length !== 8) {
      setInfo(null)
      return
    }
    if (memo.has(cep)) {
      setInfo(memo.get(cep) ?? null)
      return
    }
    let alive = true
    setLoading(true)
    resolveCepsCached([cep])
      .then((m) => {
        if (alive) setInfo(m.get(cep) ?? null)
      })
      .catch(() => {
        if (alive) setInfo(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [rawCep])

  return { info, loading }
}

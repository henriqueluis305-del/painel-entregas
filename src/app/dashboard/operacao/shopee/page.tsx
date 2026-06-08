import { redirect } from "next/navigation"

import { SHOPEE_BASE_PATH } from "@/lib/shopee"

export default async function ShopeeIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x))
    else if (v != null) params.set(k, v)
  }
  const qs = params.toString()
  redirect(`${SHOPEE_BASE_PATH}/geral${qs ? `?${qs}` : ""}`)
}

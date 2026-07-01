"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckIcon, Loader2Icon, TriangleAlertIcon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  analyzeUpload,
  applyUpload,
  type AnalyzeResult,
} from "@/app/dashboard/operacao/shopee/uploads/actions"
import type { ShopeeBaseOption } from "@/lib/shopee"

export function Uploader({
  kind,
  label,
  description,
  accept,
  multiple = true,
  needsBase = false,
  bases = [],
  fixedBase,
}: {
  kind: string
  label: string
  description: string
  accept: string
  multiple?: boolean
  needsBase?: boolean
  bases?: ShopeeBaseOption[]
  /** Base controlada de fora (seletor compartilhado). Esconde o Select interno. */
  fixedBase?: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [baseSlug, setBaseSlug] = useState("")
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [pending, start] = useTransition()

  const base = fixedBase ?? baseSlug

  function buildForm() {
    const fd = new FormData()
    fd.set("kind", kind)
    if (base) fd.set("baseSlug", base)
    for (const f of files) fd.append("files", f)
    return fd
  }

  function onAnalyze() {
    if (!files.length) return toast.error("Selecione um arquivo")
    if (needsBase && !base) return toast.error("Escolha a base")
    start(async () => {
      setResult(await analyzeUpload(buildForm()))
    })
  }

  function onConfirm() {
    start(async () => {
      const res = await applyUpload(buildForm())
      if (res.ok) {
        toast.success("Gravado", { description: res.message })
        setResult(null)
        setFiles([])
        if (inputRef.current) inputRef.current.value = ""
        router.refresh()
      } else {
        toast.error("Falha ao gravar", { description: res.message })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {needsBase && fixedBase === undefined && (
            <Select value={baseSlug} onValueChange={(v) => setBaseSlug(v ?? "")}>
              <SelectTrigger size="sm" className="w-[200px]">
                <SelectValue placeholder="Base do export" />
              </SelectTrigger>
              <SelectContent>
                {bases.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={(e) => {
              setFiles(Array.from(e.target.files ?? []))
              setResult(null)
            }}
            className="text-muted-foreground file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 max-w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm"
          />
        </div>

        {files.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {files.length} arquivo(s): {files.map((f) => f.name).join(", ")}
          </p>
        )}

        {result && (
          <div className="bg-muted/40 flex flex-col gap-1 rounded-lg border p-3 text-sm">
            <span className="font-medium">{result.title}</span>
            {result.lines.map((l, i) => (
              <span key={i} className="text-muted-foreground">{l}</span>
            ))}
            {result.warn && (
              <span className="mt-1 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <TriangleAlertIcon className="size-3.5 shrink-0" />
                {result.warn}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAnalyze} disabled={pending || !files.length} className="gap-1.5">
            {pending && !result ? <Loader2Icon className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
            Analisar
          </Button>
          {result?.ok && (
            <Button size="sm" onClick={onConfirm} disabled={pending} className="gap-1.5">
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
              Confirmar e gravar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

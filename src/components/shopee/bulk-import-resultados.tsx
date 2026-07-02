"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckIcon, ClipboardListIcon, Loader2Icon, SearchIcon } from "lucide-react"

import {
  analyzeBulkResultados,
  applyBulkResultados,
  type BulkResultadoPreview,
  type BulkResultadoRow,
} from "@/app/dashboard/operacao/shopee/resultados/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const PLACEHOLDER = [
  "XPT_ES_Linhares\t86,03%\t80,34%\t05/01",
  "XPT_ES_Colatina\t98,16%\t97,41%\t05/01",
  "XPT_ES_Nova Venécia\t\t98,31%\t18/01", // SLA vazio = não contabilizado (feriado/domingo/etc.)
].join("\n")

function metricStatus(label: string, pct: number | null, exists: boolean): { text: string; novo: boolean } {
  if (pct == null) return { text: `${label} não contabilizado`, novo: false }
  return { text: exists ? `${label} já existe` : `${label} novo`, novo: !exists }
}

function rowStatus(r: BulkResultadoRow): { label: string; tone: "ok" | "warn" | "error" } {
  if (r.error) return { label: r.error, tone: "error" }
  const sla = metricStatus("SLA", r.slaPct, r.slaExists)
  const ds = metricStatus("DS", r.dsPct, r.dsExists)
  return { label: `${sla.text} · ${ds.text}`, tone: sla.novo || ds.novo ? "ok" : "warn" }
}

/** Import em massa de resultados antigos (SLA/DS), só pra admin — preenche dias sem registro. */
export function BulkImportResultados() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [preview, setPreview] = useState<BulkResultadoPreview | null>(null)
  const [pending, start] = useTransition()

  function reset() {
    setText("")
    setPreview(null)
  }

  function onAnalyze() {
    if (!text.trim()) return toast.error("Cole a lista de resultados primeiro")
    start(async () => {
      setPreview(await analyzeBulkResultados(text, year))
    })
  }

  function onConfirm() {
    start(async () => {
      const res = await applyBulkResultados(text, year)
      if (res.ok) {
        toast.success("Import gravado", { description: res.message })
        setOpen(false)
        reset()
        router.refresh()
      } else {
        toast.error("Falha no import", { description: res.message })
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <ClipboardListIcon className="size-4" />
            Importar em massa
          </Button>
        }
      />
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar resultados antigos em massa</DialogTitle>
          <DialogDescription>
            Uma linha por base/dia: BASE, SLA%, DS%, DATA (cole direto de uma planilha). Célula
            vazia, &quot;domingo&quot;, &quot;feriado&quot; ou qualquer coisa que não seja
            percentual = métrica não contabilizada naquele dia (só pula, sem erro). Só preenche
            dias que ainda não têm registro — nunca sobrescreve o que já existe, e não cria
            detalhe por motorista (fica só o agregado do dia).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="bulk-resultados-ano" className="text-sm whitespace-nowrap">
              Ano padrão (quando a data não trouxer ano)
            </Label>
            <Input
              id="bulk-resultados-ano"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
              className="w-24"
            />
          </div>

          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setPreview(null)
            }}
            placeholder={PLACEHOLDER}
            className="min-h-40 font-mono text-xs"
          />

          {preview && (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs">
                {preview.totalLinhas} linha(s) · {preview.importaveis} vão gravar algo novo
              </p>
              <div className="max-h-[320px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-background sticky top-0">
                    <TableRow>
                      <TableHead>Base</TableHead>
                      <TableHead>Dia</TableHead>
                      <TableHead className="text-right">SLA%</TableHead>
                      <TableHead className="text-right">DS%</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((r) => {
                      const status = rowStatus(r)
                      return (
                        <TableRow key={r.line}>
                          <TableCell className="max-w-[160px] truncate text-xs">
                            {r.baseLabel ?? r.baseRaw}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{r.day ?? "—"}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {r.slaPct ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {r.dsPct ?? "—"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-xs",
                              status.tone === "error" && "text-red-600 dark:text-red-400",
                              status.tone === "warn" && "text-amber-600 dark:text-amber-400",
                            )}
                          >
                            {status.label}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onAnalyze} disabled={pending} className="gap-1.5">
            {pending && !preview ? <Loader2Icon className="size-4 animate-spin" /> : <SearchIcon className="size-4" />}
            Analisar
          </Button>
          {preview && preview.importaveis > 0 && (
            <Button onClick={onConfirm} disabled={pending} className="gap-1.5">
              {pending && preview ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
              Confirmar e gravar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

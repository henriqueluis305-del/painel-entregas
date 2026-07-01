"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  listCidadesDaBase,
  setCidadeEnabled,
} from "@/app/dashboard/operacao/shopee/config/actions"
import type { CidadeConfigItem } from "@/lib/shopee/cidade-queries"

type Base = { slug: string; label: string }

export function CidadesConfig({ bases }: { bases: Base[] }) {
  if (bases.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        Nenhuma base ativa nesta operação.
      </p>
    )
  }
  return <CidadesConfigInner bases={bases} />
}

function CidadesConfigInner({ bases }: { bases: Base[] }) {
  const [baseSlug, setBaseSlug] = useState(bases[0].slug)
  const [cidades, setCidades] = useState<CidadeConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  // Carrega as cidades da base selecionada (lazy — resolve o Stuck só da base
  // ativa). O reset de loading/busca fica no handler (evita setState síncrono
  // no corpo do effect); aqui só o fetch, com setState nos callbacks async.
  useEffect(() => {
    let alive = true
    listCidadesDaBase(baseSlug)
      .then((rows) => {
        if (alive) setCidades(rows)
      })
      .catch(() => {
        if (alive) {
          setCidades([])
          toast.error("Não foi possível carregar as cidades")
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [baseSlug])

  function selectBase(v: string) {
    if (!v || v === baseSlug) return
    setLoading(true)
    setQuery("")
    setBaseSlug(v)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? cidades.filter((c) => c.cidade.toLowerCase().includes(q)) : cidades
  }, [cidades, query])

  const ligadas = cidades.filter((c) => c.enabled).length

  // Atualiza o estado local (usado para o update otimista e para reverter no erro).
  function setEnabledLocal(cidade: string, value: boolean) {
    setCidades((prev) => prev.map((c) => (c.cidade === cidade ? { ...c, enabled: value } : c)))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={baseSlug} onValueChange={(v) => selectBase(v as string)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Base" />
          </SelectTrigger>
          <SelectContent>
            {bases.map((b) => (
              <SelectItem key={b.slug} value={b.slug}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 sm:max-w-xs">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cidade…"
            className="pl-8"
          />
        </div>
        {!loading && (
          <span className="text-muted-foreground ml-auto text-sm tabular-nums">
            {ligadas} ligada(s) de {cidades.length}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cidade</TableHead>
              <TableHead className="w-[120px]">Origem</TableHead>
              <TableHead className="w-[90px] text-center">Ativa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground h-24 text-center">
                  Carregando cidades…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground h-24 text-center">
                  {cidades.length === 0
                    ? "Nenhuma cidade vista ainda nesta base (nem no SLA nem no Stuck)."
                    : "Nenhuma cidade encontrada na busca."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <CidadeRow
                  key={c.cidade}
                  baseSlug={baseSlug}
                  item={c}
                  onLocalChange={setEnabledLocal}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

const SOURCE_LABEL: Record<CidadeConfigItem["source"], string> = {
  sla: "SLA",
  stuck: "Stuck",
  ambos: "SLA + Stuck",
}

function CidadeRow({
  baseSlug,
  item,
  onLocalChange,
}: {
  baseSlug: string
  item: CidadeConfigItem
  onLocalChange: (cidade: string, value: boolean) => void
}) {
  const [pending, start] = useTransition()

  function toggle(next: boolean) {
    onLocalChange(item.cidade, next) // otimista
    start(async () => {
      try {
        await setCidadeEnabled(baseSlug, item.cidade, next)
      } catch {
        onLocalChange(item.cidade, !next) // reverte
        toast.error("Não foi possível salvar")
      }
    })
  }

  return (
    <TableRow>
      <TableCell>{item.cidade}</TableCell>
      <TableCell>
        <Badge variant="outline" className="font-normal">
          {SOURCE_LABEL[item.source]}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={item.enabled}
          disabled={pending}
          onCheckedChange={(c) => toggle(c === true)}
        />
      </TableCell>
    </TableRow>
  )
}

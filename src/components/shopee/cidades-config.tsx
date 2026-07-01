"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { setCidadeVisivel } from "@/app/dashboard/operacao/shopee/config/actions"
import type { CidadeConfig } from "@/lib/shopee/cidade-queries"

export function CidadesConfig({ config }: { config: CidadeConfig[] }) {
  if (config.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        Nenhuma cidade descoberta ainda. As cidades aparecem aqui automaticamente
        depois do primeiro upload de SLA (resolvidas pelo CEP).
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {config.map((base) => (
        <div key={base.base_slug} className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">{base.base_label}</h4>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="w-[100px] text-center">SLA</TableHead>
                  <TableHead className="w-[100px] text-center">DS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {base.cidades.map((c) => (
                  <CidadeRow
                    key={c.cidade}
                    baseSlug={base.base_slug}
                    cidade={c.cidade}
                    initialSla={c.show_sla}
                    initialDs={c.show_ds}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  )
}

function CidadeRow({
  baseSlug,
  cidade,
  initialSla,
  initialDs,
}: {
  baseSlug: string
  cidade: string
  initialSla: boolean
  initialDs: boolean
}) {
  const [sla, setSla] = useState(initialSla)
  const [ds, setDs] = useState(initialDs)
  const [pending, start] = useTransition()

  function toggle(
    field: "show_sla" | "show_ds",
    next: boolean,
    setter: (v: boolean) => void,
    prev: boolean,
  ) {
    setter(next) // otimista
    start(async () => {
      try {
        await setCidadeVisivel(baseSlug, cidade, field, next)
      } catch {
        setter(prev) // reverte
        toast.error("Não foi possível salvar")
      }
    })
  }

  return (
    <TableRow>
      <TableCell>{cidade}</TableCell>
      <TableCell className="text-center">
        <Switch
          checked={sla}
          disabled={pending}
          onCheckedChange={(c) => toggle("show_sla", c === true, setSla, sla)}
        />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={ds}
          disabled={pending}
          onCheckedChange={(c) => toggle("show_ds", c === true, setDs, ds)}
        />
      </TableCell>
    </TableRow>
  )
}

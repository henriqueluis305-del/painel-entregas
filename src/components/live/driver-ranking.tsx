"use client"

import { useMemo, useState } from "react"
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  TriangleAlertIcon,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { DriverRank } from "@/lib/live-queries"

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

type SortKey = "name" | "saiu" | "entregues" | "ds_pct" | "ocorrencias" | "prejuizo"

export function DriverRanking({ drivers }: { drivers: DriverRank[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "ocorrencias",
    dir: "desc",
  })

  const piores = drivers.slice(0, 3) // já vem ordenado por ocorrências desc

  const sorted = useMemo(() => {
    const arr = [...drivers]
    arr.sort((a, b) => {
      const va = a[sort.key]
      const vb = b[sort.key]
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR")
      return sort.dir === "asc" ? c : -c
    })
    return arr
  }, [drivers, sort])

  function toggle(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {piores.map((d, i) => (
          <Card key={d.driver_id} className={i === 0 ? "border-red-500/40" : undefined}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <TriangleAlertIcon className="size-3.5 text-red-500" />
                {i + 1}º maior ofensor
              </CardDescription>
              <CardTitle className="truncate text-base">{d.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2 text-sm">
              <span><span className="text-red-500 font-bold tabular-nums">{d.ocorrencias}</span> <span className="text-muted-foreground">ocorr.</span></span>
              <span className="text-muted-foreground">DS {d.ds_pct}%</span>
              <span className="font-medium tabular-nums">{brl(d.prejuizo)}</span>
            </CardContent>
          </Card>
        ))}
        {piores.length === 0 && (
          <p className="text-muted-foreground col-span-full py-6 text-center text-sm">
            Sem motoristas no dia.
          </p>
        )}
      </div>

      {drivers.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <Th label="Motorista" k="name" sort={sort} onSort={toggle} />
                <Th label="Saiu" k="saiu" sort={sort} onSort={toggle} align />
                <Th label="Entregues" k="entregues" sort={sort} onSort={toggle} align />
                <Th label="DS%" k="ds_pct" sort={sort} onSort={toggle} align />
                <Th label="Ocorrências" k="ocorrencias" sort={sort} onSort={toggle} align />
                <Th label="Prejuízo*" k="prejuizo" sort={sort} onSort={toggle} align />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((d) => (
                <TableRow key={d.driver_id}>
                  <TableCell className="max-w-[240px] truncate">{d.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.saiu}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-500">{d.entregues}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.ds_pct}%</TableCell>
                  <TableCell className="text-right tabular-nums text-red-500">{d.ocorrencias}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(d.prejuizo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        * Prejuízo é <strong>mock</strong> (ocorrências × R$ {CUSTO_LABEL}) até a entrada dos dados de PNR.
      </p>
    </div>
  )
}

const CUSTO_LABEL = "27,50"

function Th({
  label,
  k,
  sort,
  onSort,
  align,
}: {
  label: string
  k: SortKey
  sort: { key: SortKey; dir: "asc" | "desc" }
  onSort: (k: SortKey) => void
  align?: boolean
}) {
  const active = sort.key === k
  return (
    <TableHead className={align ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("hover:text-foreground inline-flex items-center gap-1", align && "flex-row-reverse")}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />
        ) : (
          <ChevronsUpDownIcon className="size-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

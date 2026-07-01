import { redirect } from "next/navigation"

import { BurnDownChart } from "@/components/shopee/burn-down-chart"
import { DsTable } from "@/components/shopee/ds-table"
import { HalfGauge } from "@/components/shopee/half-gauge"
import { MonitoramentoUploads } from "@/components/shopee/monitoramento-uploads"
import { SlaCidadeTable } from "@/components/shopee/sla-cidade-table"
import { ShopeeSubtabShell } from "@/components/shopee/subtab-shell"
import { Badge } from "@/components/ui/badge"
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getSessionProfile } from "@/lib/auth"
import { hasPerm, PERMS } from "@/lib/permissions"
import { getOperacaoBySlug } from "@/lib/queries"
import {
  effectiveBases,
  parseShopeeFilters,
  SHOPEE_BASE_PATH,
  SHOPEE_SLUG,
} from "@/lib/shopee"
import {
  getDsCidades,
  getSlaCidades,
  getSlaOutros,
  type DsCidadeRow,
} from "@/lib/shopee/cidade-queries"
import { getDsCheckpoints, getDsData } from "@/lib/shopee/ds-queries"
import { getSlaData, getSlaCheckpoints } from "@/lib/shopee/sla-queries"
import { getUploadLog, uploadKindLabel } from "@/lib/shopee/upload-log"

const n = (v: number) => v.toLocaleString("pt-BR")

export default async function MonitoramentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSessionProfile()
  const profile = session?.profile
  const canSla = !!profile && hasPerm(profile, PERMS.UPLOAD_CSV_SLA)
  const canDs = !!profile && hasPerm(profile, PERMS.UPLOAD_XLSX_DS)
  if (!canSla && !canDs) redirect(`${SHOPEE_BASE_PATH}/geral`)

  const filters = parseShopeeFilters(await searchParams)
  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const slugs = effectiveBases(filters)
  const bases = (op?.bases ?? [])
    .filter((b) => b.active)
    .map((b) => ({ slug: b.slug, label: b.label }))

  const [sla, slaCidades, slaOutros, slaCkpts, ds, dsCidades, checkpoints, log] = op
    ? await Promise.all([
        getSlaData(op.id, slugs),
        getSlaCidades(op.id, slugs),
        getSlaOutros(op.id, slugs),
        getSlaCheckpoints(op.id, slugs),
        getDsData(op.id, slugs),
        getDsCidades(op.id, slugs),
        getDsCheckpoints(op.id, slugs),
        getUploadLog(40),
      ])
    : [
        { day: null, pct: 0, total: 0, entregues: 0 } as Awaited<ReturnType<typeof getSlaData>>,
        { day: null, rows: [] } as Awaited<ReturnType<typeof getSlaCidades>>,
        { day: null, cidades: [] } as Awaited<ReturnType<typeof getSlaOutros>>,
        [] as Awaited<ReturnType<typeof getSlaCheckpoints>>,
        { rows: [], totals: { motoristas: 0, saiu: 0, entregues: 0, emRota: 0, ocorrencias: 0, pct: 0 }, isDemo: false, day: null } as Awaited<ReturnType<typeof getDsData>>,
        { day: null, rows: [] } as Awaited<ReturnType<typeof getDsCidades>>,
        [] as Awaited<ReturnType<typeof getDsCheckpoints>>,
        [] as Awaited<ReturnType<typeof getUploadLog>>,
      ]
  const t = ds.totals
  const recentes = log.filter((r) => r.kind === "sla" || r.kind === "ds").slice(0, 12)

  return (
    <ShopeeSubtabShell
      title="Monitoramento"
      description="Suba os arquivos de SLA e DS e acompanhe o resultado dos motoristas em tempo real."
      bases={bases}
    >
      {/* Uploads — a entrada de dados do dia (uma base só, vale p/ SLA e DS) */}
      <MonitoramentoUploads bases={bases} canSla={canSla} canDs={canDs} />

      {/* Painéis SLA e DS — gauge + tabela por cidade + crescimento embaixo */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SLA</CardTitle>
            <CardDescription>entregues / total — total = todas as linhas do arquivo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {sla.day ? (
              <>
                <HalfGauge pct={sla.pct} sub={`${n(sla.total)} pacotes`} />
                <SlaCidadeTable rows={slaCidades.rows} outros={slaOutros.cidades} />
                <Crescimento titulo="Crescimento SLA (hoje)" points={slaCkpts} />
              </>
            ) : (
              <Empty>Sem SLA importado.</Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">DS</CardTitle>
            <CardDescription>entregues / encaminhados — cidade via cruzamento com o SLA</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {ds.day ? (
              <>
                <HalfGauge pct={t.pct} sub={`${n(t.saiu)} encaminhados`} />
                <DsCidadeTable rows={dsCidades.rows} />
                <Crescimento titulo="Crescimento DS" points={checkpoints.map((c) => ({ label: c.label, pct: c.pct }))} />
              </>
            ) : (
              <Empty>Sem DS importado.</Empty>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Motoristas — o foco do acompanhamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Motoristas{ds.day ? ` (${n(t.motoristas)})` : ""}
          </CardTitle>
          <CardDescription>
            {ds.day ? `Resultado por motorista (${ds.day}).` : "Sem DS importado para o filtro atual."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {op && ds.day ? (
            <DsTable rows={ds.rows} operacaoId={op.id} baseSlugs={slugs} referenceDay={ds.day} />
          ) : (
            <Empty>Suba um DS para ver os motoristas.</Empty>
          )}
        </CardContent>
      </Card>

      {/* Histórico recente dos uploads de SLA/DS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uploads recentes (SLA / DS)</CardTitle>
        </CardHeader>
        <CardContent>
          {recentes.length === 0 ? (
            <Empty>Nenhum upload de SLA ou DS ainda.</Empty>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Arquivos</TableHead>
                    <TableHead className="text-right">Linhas</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentes.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {uploadKindLabel(r.kind)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[220px] truncate text-xs">
                        {r.filenames ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{n(r.rows)}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[260px] truncate text-xs">
                        {r.summary ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {r.user_email ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </ShopeeSubtabShell>
  )
}

function Crescimento({
  titulo,
  points,
}: {
  titulo: string
  points: { label: string; pct: number }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {titulo}
      </span>
      <BurnDownChart points={points} />
    </div>
  )
}

function DsCidadeTable({ rows }: { rows: DsCidadeRow[] }) {
  if (rows.length === 0) {
    return <Empty>Nenhuma cidade visível. Suba o SLA do dia (cruza o motorista) e ligue cidades na Config.</Empty>
  }
  const sum = rows.reduce(
    (a, r) => ({
      total: a.total + r.total,
      entregues: a.entregues + r.entregues,
      emRota: a.emRota + r.emRota,
      insucessos: a.insucessos + r.insucessos,
    }),
    { total: 0, entregues: 0, emRota: 0, insucessos: 0 },
  )
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cidade</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Entregue</TableHead>
            <TableHead className="text-right">Em rota</TableHead>
            <TableHead className="text-right">Insucessos</TableHead>
            <TableHead className="text-right">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.cidade}>
              <TableCell className="font-medium">{r.cidade}</TableCell>
              <TableCell className="text-right tabular-nums">{n(r.total)}</TableCell>
              <TableCell className="text-right tabular-nums text-emerald-500">{n(r.entregues)}</TableCell>
              <TableCell className="text-right tabular-nums">{n(r.emRota)}</TableCell>
              <TableCell className="text-right tabular-nums text-red-500">{n(r.insucessos)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{r.pct}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="text-muted-foreground text-xs">Cidades visíveis</TableCell>
            <TableCell className="text-right tabular-nums">{n(sum.total)}</TableCell>
            <TableCell className="text-right tabular-nums">{n(sum.entregues)}</TableCell>
            <TableCell className="text-right tabular-nums">{n(sum.emRota)}</TableCell>
            <TableCell className="text-right tabular-nums">{n(sum.insucessos)}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {sum.total ? Number(((sum.entregues / sum.total) * 100).toFixed(1)) : 0}%
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground py-10 text-center text-sm">{children}</p>
  )
}

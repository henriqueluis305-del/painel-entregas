import { redirect } from "next/navigation"

import { Uploader } from "@/components/shopee/uploader"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getSessionProfile } from "@/lib/auth"
import { getOperacaoBySlug } from "@/lib/queries"
import { SHOPEE_BASE_PATH, SHOPEE_SLUG } from "@/lib/shopee"
import { getUploadLog, uploadKindLabel } from "@/lib/shopee/upload-log"

export default async function UploadsPage() {
  const session = await getSessionProfile()
  if (!session?.profile?.is_admin) redirect(`${SHOPEE_BASE_PATH}/geral`)

  const op = await getOperacaoBySlug(SHOPEE_SLUG)
  const bases = (op?.bases ?? [])
    .filter((b) => b.active)
    .map((b) => ({ slug: b.slug, label: b.label }))
  const log = await getUploadLog()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Uploads</h2>
        <p className="text-muted-foreground text-sm">
          Suba os dados da operação (somente administradores). Cada upload mostra
          um resumo antes de gravar.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Uploader
          kind="backlog"
          label="Backlog (Stuck)"
          description="xlsx de backlog — define o conjunto de stuck do dia. Base vem da coluna Station Name."
          accept=".xlsx"
        />
        <Uploader
          kind="tracking"
          label="Tracking (Stuck)"
          description="CSV export_return_order — atualiza status dos pacotes do dia (cada upload vira um ponto no burn-down)."
          accept=".csv"
        />
        <Uploader
          kind="ds"
          label="DS (fleets)"
          description="xlsx de DS por motorista (Assigned/Delivered/...). Base vem da coluna Driver Station."
          accept=".xlsx"
        />
        <Uploader
          kind="sla"
          label="SLA"
          description="CSV export_return_order de uma base. O arquivo inteiro conta para a base escolhida."
          accept=".csv"
          needsBase
          bases={bases}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de uploads</CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Nenhum upload ainda.
            </p>
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
                  {log.map((r) => (
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
                      <TableCell className="text-right tabular-nums">
                        {r.rows.toLocaleString("pt-BR")}
                      </TableCell>
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
    </div>
  )
}

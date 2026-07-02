"use server"

import ExcelJS from "exceljs"
import type { PoolClient } from "pg"
import { revalidatePath } from "next/cache"

import { getSessionProfile } from "@/lib/auth"
import { lookupCeps, normalizeCep } from "@/lib/cep"
import { hasPerm, PERMS, type Permission } from "@/lib/permissions"
import { withPgClient, chunk } from "@painel/db"
import { SHOPEE_BASE_PATH } from "@/lib/shopee"
import { resolveDriver, dedupeById, type ParsedDriver } from "@/lib/shopee/drivers"
import { isStuck, parseDiasPreso, resolveBaseSlug } from "@/lib/shopee/stuck"
import { parseDsCells, calcDs } from "@/lib/shopee/ds"
import { calcSla, slaCategory } from "@/lib/shopee/sla"
import { parseCsvObjects, CEP_HEADER_RE, cepDigits, pickCep } from "@/lib/shopee/csv"
import { parsePnr } from "@/lib/shopee/pnr"

export type AnalyzeResult = { ok: boolean; title: string; lines: string[]; warn?: string }
export type ApplyResult = { ok: boolean; message: string }

// SLA e DS são a "tela de trabalho" do monitoramento — liberados por permissão.
// Os demais (backlog/tracking/pnr) seguem restritos a admin.
const KIND_PERM: Record<string, Permission> = {
  sla: PERMS.UPLOAD_CSV_SLA,
  ds: PERMS.UPLOAD_XLSX_DS,
}

/** Autoriza o upload de um `kind`: permissão específica quando houver, senão admin. */
async function requireUploadPerm(kind: string): Promise<string> {
  const s = await getSessionProfile()
  const profile = s?.profile
  if (!profile) throw new Error("Não autorizado")
  const needed = KIND_PERM[kind]
  const ok = needed ? hasPerm(profile, needed) : profile.is_admin
  if (!ok) throw new Error("Não autorizado")
  return s!.email
}

async function logUpload(
  c: PoolClient,
  email: string,
  kind: string,
  filenames: string,
  rows: number,
  summary: string,
) {
  await c.query(
    `insert into shopee_upload_log (user_email, kind, filenames, rows, summary) values ($1,$2,$3,$4,$5)`,
    [email, kind, filenames, rows, summary],
  )
}

const todayBr = () =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())
const todayIso = () => new Date().toISOString().slice(0, 10)
const horaBr = () =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date())
const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const pnrTimestamp = (value: string | null | undefined) => {
  const v = (value ?? "").trim()
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v : null
}
/** Hora HH:MM tirada do nome do arquivo (..._HH-MM-SS...), senão a hora atual. */
function fileTime(files: File[]): string {
  for (const f of files) {
    const m = f.name.match(/_(\d{2})-(\d{2})-\d{2}/)
    if (m) return `${m[1]}:${m[2]}`
  }
  return horaBr()
}

// ---------- leitura de arquivos ----------
function getFiles(fd: FormData): File[] {
  return fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
}
async function texts(files: File[]): Promise<string[]> {
  return Promise.all(files.map(async (f) => new TextDecoder("utf-8").decode(await f.arrayBuffer())))
}
async function readXlsx(file: File): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  return wb.worksheets[0]
}
function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return ""
  if (typeof v === "object" && "text" in v) return String((v as { text: string }).text).trim()
  return String(v).trim()
}

// ---------- parsers ----------
type BacklogRow = { baseSlug: string; codigo: string; status: string; dias: number | null; driverId: string | null; agency: string | null; cep: string | null }
async function parseBacklog(files: File[]) {
  const rows: BacklogRow[] = []
  const drivers: ParsedDriver[] = []
  let total = 0
  for (const f of files) {
    const ws = await readXlsx(f)
    const col: Record<string, number> = {}
    ws.getRow(1).eachCell((c, n) => (col[cellText(c.value)] = n))
    const get = (r: ExcelJS.Row, name: string) => (col[name] ? cellText(r.getCell(col[name]).value) : "")
    const cepHeader = Object.keys(col).find((h) => CEP_HEADER_RE.test(h))
    for (let i = 2; i <= ws.rowCount; i++) {
      const r = ws.getRow(i)
      const codigo = get(r, "Shipment ID")
      if (!codigo) continue
      total++
      const status = get(r, "Latest Status")
      if (!isStuck(get(r, "LM Hub Days"), status)) continue
      const drv = resolveDriver(get(r, "Latest User Name"))
      if (drv) drivers.push(drv)
      rows.push({
        baseSlug: resolveBaseSlug(get(r, "Station Name")),
        codigo,
        status,
        dias: parseDiasPreso(get(r, "LM Hub Days")),
        driverId: drv?.id ?? null,
        agency: get(r, "Agency Name") || null,
        cep: cepHeader ? cepDigits(get(r, cepHeader)) : null,
      })
    }
  }
  return { rows, drivers: dedupeById(drivers), total }
}

async function parseDs(files: File[]) {
  const items: { id: string; name: string; baseSlug: string; saiu: number; entregues: number; emRota: number; ocorrencias: number }[] = []
  for (const f of files) {
    const ws = await readXlsx(f)
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i)
      const cells: unknown[] = []
      for (let c = 1; c <= 13; c++) cells[c - 1] = cellText(row.getCell(c).value)
      const parsed = parseDsCells(cells)
      if (!parsed) continue
      const drv = resolveDriver(parsed.driverRaw)
      if (!drv) continue
      const station = String(cells[2] ?? "").trim()
      items.push({ id: drv.id, name: drv.name, baseSlug: station ? resolveBaseSlug(station) : "", saiu: parsed.saiu, entregues: parsed.entregues, emRota: parsed.emRota, ocorrencias: parsed.ocorrencias })
    }
  }
  return items
}

function parseTracking(ts: string[]) {
  const latest = new Map<string, { status: string; driverId: string | null; cep: string | null }>()
  const drivers: ParsedDriver[] = []
  let total = 0
  for (const t of ts) {
    for (const o of parseCsvObjects(t)) {
      const codigo = (o["Order ID"] || "").trim()
      if (!codigo) continue
      total++
      const drv = resolveDriver(o["Driver Name"] || "", o["Driver ID"] || "")
      if (drv) drivers.push(drv)
      latest.set(codigo, { status: (o["Status"] || "").trim(), driverId: drv?.id ?? null, cep: pickCep(o) })
    }
  }
  return { latest, drivers: dedupeById(drivers), total }
}

type SlaRow = { status: string; cep: string | null; driverId: string | null; driverName: string }
function parseSla(ts: string[]) {
  const byCode = new Map<string, SlaRow>()
  const drivers: ParsedDriver[] = []
  let total = 0
  for (const t of ts) {
    for (const o of parseCsvObjects(t)) {
      const codigo = (o["Order ID"] || "").trim()
      if (!codigo) continue
      total++
      const drv = resolveDriver(o["Driver Name"] || "", o["Driver ID"] || "")
      if (drv) drivers.push(drv)
      byCode.set(codigo, {
        status: (o["Status"] || "").trim(),
        cep: pickCep(o),
        driverId: drv?.id ?? null,
        driverName: drv?.name ?? "",
      })
    }
  }
  return { byCode, total, drivers: dedupeById(drivers) }
}

// ---------- helpers de DB ----------
async function baseIdMap(c: PoolClient, operacaoId: string) {
  const r = await c.query("select id, slug from base where operacao_id=$1", [operacaoId])
  return new Map<string, string>(r.rows.map((b) => [b.slug, String(b.id)]))
}
async function shopeeOpId(c: PoolClient) {
  const r = await c.query("select id from operacao where slug='shopee'")
  return r.rows[0].id as string
}
async function registerDrivers(c: PoolClient, operacaoId: string, drivers: ParsedDriver[]) {
  const existing = await c.query("select id from driver")
  const valid = new Set(existing.rows.map((r) => String(r.id)))
  let novos = 0
  for (const d of drivers) {
    if (valid.has(d.id)) continue
    try {
      await c.query(
        `insert into driver (id, operacao_id, name, normalized_key) values ($1,$2,$3,$4)
         on conflict (id) do update set name=excluded.name, updated_at=now()`,
        [d.id, operacaoId, d.name, d.key],
      )
      valid.add(d.id)
      novos++
    } catch {}
  }
  return { valid, novos }
}
async function recordStuckCheckpoint(c: PoolClient, baseIds: string[], label: string, dataPtBr: string) {
  for (const baseId of baseIds) {
    const seq = (await c.query("select coalesce(max(seq),-1)+1 as seq from shopee_stuck_checkpoint where base_id=$1 and data_pt_br=$2", [baseId, dataPtBr])).rows[0].seq
    await c.query(
      `insert into shopee_stuck_checkpoint (base_id, seq, data_pt_br, label, total, ainda_stuck, resolvidos)
       select $1::varchar,$2::integer,$3::varchar,$4::varchar, count(*),
         count(*) filter (where delivered_at is null and status not in ('Delivering','SP_Collection_Collected','SP_Ready_Collection','Delivered')),
         count(*) filter (where delivered_at is not null or status in ('Delivering','SP_Collection_Collected','SP_Ready_Collection','Delivered'))
       from shopee_package where base_id=$1::varchar
       on conflict (base_id, data_pt_br, seq) do update set total=excluded.total, ainda_stuck=excluded.ainda_stuck, resolvidos=excluded.resolvidos, ts=now()`,
      [baseId, seq, dataPtBr, label],
    )
  }
}

// ============================ ANALYZE ============================
export async function analyzeUpload(fd: FormData): Promise<AnalyzeResult> {
  const kind = String(fd.get("kind") || "")
  await requireUploadPerm(kind)
  const baseSlug = String(fd.get("baseSlug") || "")
  const files = getFiles(fd)
  if (!files.length) return { ok: false, title: "Nenhum arquivo", lines: ["Selecione ao menos um arquivo."] }

  try {
    if (kind === "backlog") {
      const { rows, drivers, total } = await parseBacklog(files)
      return await withPgClient(async (c) => {
        const op = await shopeeOpId(c)
        const bmap = await baseIdMap(c, op)
        const unresolved = [...new Set(rows.map((r) => r.baseSlug).filter((s) => !bmap.has(s)))]
        const valid = rows.filter((r) => bmap.has(r.baseSlug))
        const existing = new Set((await c.query("select base_id, codigo from shopee_package")).rows.map((r) => `${r.base_id}|${r.codigo}`))
        let novos = 0
        for (const r of valid) if (!existing.has(`${bmap.get(r.baseSlug)}|${r.codigo}`)) novos++
        const perBase = new Map<string, number>()
        for (const r of valid) perBase.set(r.baseSlug, (perBase.get(r.baseSlug) ?? 0) + 1)
        return {
          ok: valid.length > 0,
          title: "Backlog (Stuck)",
          lines: [
            `Linhas lidas: ${total}`,
            `Em stuck (vão entrar): ${valid.length}`,
            `Novos: ${novos} · já existentes (atualiza): ${valid.length - novos}`,
            `Motoristas no arquivo: ${drivers.length}`,
            `Por base: ${[...perBase.entries()].map(([s, n]) => `${s}=${n}`).join(" · ") || "—"}`,
          ],
          warn: unresolved.length ? `Bases não cadastradas (ignoradas): ${unresolved.join(", ")}` : undefined,
        }
      })
    }

    if (kind === "tracking") {
      const { latest, drivers, total } = parseTracking(await texts(files))
      return await withPgClient(async (c) => {
        const existing = await c.query("select codigo, delivered_at from shopee_package")
        const byCode = new Map(existing.rows.map((r) => [r.codigo as string, r.delivered_at != null]))
        let matched = 0, willDeliver = 0
        for (const [codigo, info] of latest) {
          if (!byCode.has(codigo)) continue
          matched++
          if (info.status === "Delivered" && !byCode.get(codigo)) willDeliver++
        }
        return {
          ok: matched > 0,
          title: "Tracking (Stuck)",
          lines: [
            `Order IDs no arquivo: ${latest.size} (${total} linhas)`,
            `Casam com o conjunto do dia: ${matched}`,
            `Vão virar entregues: ${willDeliver}`,
            `Motoristas no arquivo: ${drivers.length}`,
          ],
          warn: matched === 0 ? "Nenhum código casou — confira se o backlog do dia já foi importado." : undefined,
        }
      })
    }

    if (kind === "ds") {
      const items = await parseDs(files)
      // Base escolhida no seletor vale p/ todas as linhas (mesma base do SLA).
      if (baseSlug) for (const i of items) i.baseSlug = baseSlug
      return await withPgClient(async (c) => {
        const op = await shopeeOpId(c)
        const bmap = await baseIdMap(c, op)
        const valid = items.filter((i) => bmap.has(i.baseSlug))
        const unresolved = [...new Set(items.map((i) => i.baseSlug).filter((s) => !bmap.has(s)))]
        const t = calcDs(valid)
        const perBase = new Map<string, number>()
        for (const i of valid) perBase.set(i.baseSlug, (perBase.get(i.baseSlug) ?? 0) + 1)
        return {
          ok: valid.length > 0,
          title: "DS (fleets)",
          lines: [
            `Motoristas: ${t.motoristas}`,
            `Encaminhados: ${t.saiu} · Entregues: ${t.entregues} → DS ${t.pct}%`,
            `Em rota: ${t.emRota} · Ocorrências: ${t.ocorrencias}`,
            `Por base: ${[...perBase.entries()].map(([s, n]) => `${s}=${n}`).join(" · ") || "—"}`,
          ],
          warn: unresolved.length ? `Estações sem base cadastrada (ignoradas): ${unresolved.join(", ")}` : undefined,
        }
      })
    }

    if (kind === "sla") {
      if (!baseSlug) return { ok: false, title: "SLA", lines: ["Selecione a base do export."] }
      const { byCode, total } = parseSla(await texts(files))
      const b = calcSla([...byCode.values()].map((r) => r.status))
      return await withPgClient(async (c) => {
        const op = await shopeeOpId(c)
        const cur = await c.query(
          `select sla_pct from shopee_sla_record r join base b on b.id=r.base_id
           where b.operacao_id=$1 and b.slug=$2 and r.data_pt_br=$3`,
          [op, baseSlug, todayBr()],
        )
        const atual = cur.rows[0]?.sla_pct
        return {
          ok: b.total > 0,
          title: `SLA — ${baseSlug}`,
          lines: [
            `Order IDs: ${byCode.size} (${total} linhas)`,
            `SLA novo: ${b.pct}%${atual != null ? ` (atual: ${atual}%)` : " (sem registro hoje)"}`,
            `Entregues ${b.entregues} · Ocorrências ${b.ocorrencias} · Faltantes ${b.faltantes} · Outros ${b.outros}`,
          ],
        }
      })
    }

    if (kind === "pnr") {
      const { rows, drivers, total } = parsePnr(await texts(files))
      return await withPgClient(async (c) => {
        const op = await shopeeOpId(c)
        const bmap = await baseIdMap(c, op)
        const valid = rows.filter((r) => bmap.has(r.baseSlug))
        const unresolved = [...new Set(rows.map((r) => r.baseSlug).filter((s) => !bmap.has(s)))]
        const existingRows = valid.length
          ? await c.query("select spxtn, status from shopee_pnr where spxtn = any($1::text[])", [
              valid.map((r) => r.spxtn),
            ])
          : { rows: [] }
        const existing = new Map(existingRows.rows.map((r) => [String(r.spxtn), String(r.status)]))
        let novos = 0
        let statusUpdates = 0
        for (const row of valid) {
          if (!existing.has(row.spxtn)) novos++
          else if (existing.get(row.spxtn) !== row.status) statusUpdates++
        }
        const perBase = new Map<string, number>()
        for (const row of valid) perBase.set(row.baseSlug, (perBase.get(row.baseSlug) ?? 0) + 1)
        const valor = valid.reduce((sum, row) => sum + (row.valor ?? 0), 0)
        return {
          ok: valid.length > 0,
          title: "PNR",
          lines: [
            `Linhas lidas: ${total}`,
            `PNRs unicas: ${rows.length}`,
            `Vao entrar/atualizar: ${valid.length}`,
            `Novas: ${novos} · status a atualizar: ${statusUpdates} · sem mudanca: ${valid.length - novos - statusUpdates}`,
            `Valor total no arquivo: ${brl(valor)}`,
            `Motoristas no arquivo: ${drivers.length}`,
            `Por base: ${[...perBase.entries()].map(([s, n]) => `${s}=${n}`).join(" · ") || "—"}`,
          ],
          warn: unresolved.length
            ? `Estacoes sem base cadastrada (ignoradas): ${unresolved.map((s) => s || "(sem station)").join(", ")}`
            : undefined,
        }
      })
    }

    return { ok: false, title: "Tipo desconhecido", lines: [kind] }
  } catch (e) {
    return { ok: false, title: "Falha ao analisar", lines: [(e as Error).message] }
  }
}

// ============================ APPLY ============================
export async function applyUpload(fd: FormData): Promise<ApplyResult> {
  const kind = String(fd.get("kind") || "")
  const email = await requireUploadPerm(kind)
  const baseSlug = String(fd.get("baseSlug") || "")
  const files = getFiles(fd)
  if (!files.length) return { ok: false, message: "Nenhum arquivo." }
  const filenames = files.map((f) => f.name).join(", ")

  try {
    if (kind === "backlog") {
      const { rows, drivers } = await parseBacklog(files)
      const msg = await withPgClient(async (c) => {
        const op = await shopeeOpId(c)
        const bmap = await baseIdMap(c, op)
        const valid = rows.filter((r) => bmap.has(r.baseSlug))
        const { valid: validDrv } = await registerDrivers(c, op, drivers)
        const backlogDate = todayIso()
        const keyToId = new Map<string, number>()
        for (const ch of chunk(valid, 1000)) {
          const vals: unknown[] = []
          const dIdx = ch.length * 7 + 1
          const tuples = ch.map((r, i) => {
            const b = i * 7
            vals.push(bmap.get(r.baseSlug), r.codigo, r.status, r.driverId && validDrv.has(r.driverId) ? r.driverId : null, r.dias, r.agency, r.cep)
            return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${dIdx})`
          })
          vals.push(backlogDate)
          const res = await c.query(
            `insert into shopee_package (base_id, codigo, status, driver_id, dias_preso, agency, cep, last_backlog_date)
             values ${tuples.join(",")}
             on conflict (base_id, codigo) do update set status=excluded.status, driver_id=excluded.driver_id,
               dias_preso=excluded.dias_preso, agency=excluded.agency, cep=coalesce(excluded.cep, shopee_package.cep),
               last_backlog_date=excluded.last_backlog_date,
               last_status_at=now(), updated_at=now()
             returning id, base_id, codigo`,
            vals,
          )
          for (const row of res.rows) keyToId.set(`${row.base_id}|${row.codigo}`, row.id)
        }
        for (const ch of chunk(valid, 1000)) {
          const vals: unknown[] = []
          const tuples: string[] = []
          let k = 0
          for (const r of ch) {
            const pid = keyToId.get(`${bmap.get(r.baseSlug)}|${r.codigo}`)
            if (!pid) continue
            const b = k * 4
            vals.push(pid, r.status, r.dias, r.driverId && validDrv.has(r.driverId) ? r.driverId : null)
            tuples.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4})`)
            k++
          }
          if (tuples.length) await c.query(`insert into shopee_package_event (package_id, status, dias_preso, driver_id) values ${tuples.join(",")}`, vals)
        }
        const baseIds = [...new Set(valid.map((r) => bmap.get(r.baseSlug)!))]
        await recordStuckCheckpoint(c, baseIds, "Backlog", todayBr())
        const m = `Backlog aplicado: ${valid.length} pacotes em ${baseIds.length} base(s).`
        await logUpload(c, email, "backlog", filenames, valid.length, m)
        return m
      })
      revalidatePath(`${SHOPEE_BASE_PATH}/stuck`)
      revalidatePath(`${SHOPEE_BASE_PATH}/geral`)
      return { ok: true, message: msg }
    }

    if (kind === "tracking") {
      const { latest, drivers } = parseTracking(await texts(files))
      const msg = await withPgClient(async (c) => {
        const op = await shopeeOpId(c)
        const { valid: validDrv } = await registerDrivers(c, op, drivers)
        const existing = await c.query("select id, codigo, base_id, delivered_at from shopee_package")
        const byCode = new Map(existing.rows.map((r) => [r.codigo as string, { id: Number(r.id), baseId: String(r.base_id) }]))
        const ids: number[] = [], statuses: string[] = [], drv: (string | null)[] = [], ceps: (string | null)[] = []
        const bases = new Set<string>()
        for (const [codigo, info] of latest) {
          const pkg = byCode.get(codigo)
          if (!pkg) continue
          ids.push(pkg.id)
          statuses.push(info.status)
          drv.push(info.driverId && validDrv.has(info.driverId) ? info.driverId : null)
          ceps.push(info.cep)
          bases.add(pkg.baseId)
        }
        if (ids.length) {
          await c.query(
            `update shopee_package p set status=u.status, driver_id=coalesce(u.driver_id, p.driver_id),
               cep=coalesce(u.cep, p.cep),
               last_status_at=now(), updated_at=now(),
               delivered_at=case when u.status='Delivered' and p.delivered_at is null then now() else p.delivered_at end
             from unnest($1::bigint[], $2::text[], $3::text[], $4::text[]) as u(id, status, driver_id, cep) where p.id=u.id`,
            [ids, statuses, drv, ceps],
          )
          await c.query(
            `insert into shopee_package_event (package_id, status, dias_preso, driver_id)
             select id, status, null, driver_id from unnest($1::bigint[], $2::text[], $3::text[]) as u(id, status, driver_id)`,
            [ids, statuses, drv],
          )
          await recordStuckCheckpoint(c, [...bases], `Tracking ${fileTime(files)}`, todayBr())
        }
        const m = `Tracking aplicado: ${ids.length} pacotes atualizados.`
        await logUpload(c, email, "tracking", filenames, ids.length, m)
        return m
      })
      revalidatePath(`${SHOPEE_BASE_PATH}/stuck`)
      revalidatePath(`${SHOPEE_BASE_PATH}/geral`)
      return { ok: true, message: msg }
    }

    if (kind === "ds") {
      const items = await parseDs(files)
      // Base escolhida no seletor vale p/ todas as linhas (mesma base do SLA).
      if (baseSlug) for (const i of items) i.baseSlug = baseSlug
      const msg = await withPgClient(async (c) => {
        const op = await shopeeOpId(c)
        const bmap = await baseIdMap(c, op)
        const valid = items.filter((i) => bmap.has(i.baseSlug))
        await registerDrivers(c, op, valid.map((i) => ({ id: i.id, name: i.name, key: i.name.toLowerCase() })))
        const dataPtBr = todayBr()
        for (const it of valid) {
          await c.query(
            `insert into shopee_ds_driver (base_id, data_pt_br, driver_id, driver_name, saiu, entregues, em_rota, ocorrencias)
             values ($1,$2,$3,$4,$5,$6,$7,$8)
             on conflict (base_id, data_pt_br, driver_id) do update set driver_name=excluded.driver_name,
               saiu=excluded.saiu, entregues=excluded.entregues, em_rota=excluded.em_rota,
               ocorrencias=excluded.ocorrencias, is_demo=false, updated_at=now()`,
            [bmap.get(it.baseSlug), dataPtBr, it.id, it.name, it.saiu, it.entregues, it.emRota, it.ocorrencias],
          )
        }
        const baseIds = [...new Set(valid.map((i) => bmap.get(i.baseSlug)!))]
        for (const baseId of baseIds) {
          const seq = (await c.query("select coalesce(max(seq),-1)+1 as seq from shopee_ds_checkpoint where base_id=$1 and data_pt_br=$2", [baseId, dataPtBr])).rows[0].seq
          await c.query(
            `insert into shopee_ds_checkpoint (base_id, seq, data_pt_br, label, saiu, entregues, em_rota, ocorrencias)
             select $1::varchar,$2::integer,$3::varchar,$4::varchar, coalesce(sum(saiu),0), coalesce(sum(entregues),0), coalesce(sum(em_rota),0), coalesce(sum(ocorrencias),0)
             from shopee_ds_driver where base_id=$1::varchar and data_pt_br=$3::varchar
             on conflict (base_id, data_pt_br, seq) do update set saiu=excluded.saiu, entregues=excluded.entregues, em_rota=excluded.em_rota, ocorrencias=excluded.ocorrencias, ts=now()`,
            [baseId, seq, dataPtBr, `DS ${fileTime(files)}`],
          )
        }
        const m = `DS aplicado: ${valid.length} motoristas em ${baseIds.length} base(s).`
        await logUpload(c, email, "ds", filenames, valid.length, m)
        return m
      })
      revalidatePath(`${SHOPEE_BASE_PATH}/ds`)
      revalidatePath(`${SHOPEE_BASE_PATH}/geral`)
      return { ok: true, message: msg }
    }

    if (kind === "sla") {
      if (!baseSlug) return { ok: false, message: "Selecione a base." }
      const { byCode, drivers } = parseSla(await texts(files))
      const rows = [...byCode.values()]
      const statuses = rows.map((r) => r.status)
      const b = calcSla(statuses)
      const porStatus: Record<string, number> = {}
      for (const s of statuses) porStatus[s || "(vazio)"] = (porStatus[s || "(vazio)"] ?? 0) + 1

      // Cidade = município resolvido do CEP (cep_cache + ViaCEP nos que faltam).
      // Resolve fora do withPgClient — lookupCeps abre a própria conexão.
      const cidadePorCep = await lookupCeps(rows.map((r) => r.cep ?? ""))
      const cidadeOf = (cep: string | null) => {
        const n = normalizeCep(cep)
        return (n && cidadePorCep.get(n)?.cidade) || ""
      }

      // Agrega statuses por cidade (p/ a tabela por cidade do SLA).
      const porCidade = new Map<string, string[]>()
      for (const r of rows) {
        const cid = cidadeOf(r.cep)
        const arr = porCidade.get(cid) ?? []
        arr.push(r.status)
        porCidade.set(cid, arr)
      }

      // Itens do balde "Outros" (faltantes + demais) com código p/ o drill/copiar.
      const outrosItens: { cidade: string; status: string; codigo: string }[] = []
      for (const [codigo, r] of byCode) {
        const cat = slaCategory(r.status)
        if (cat === "faltante" || cat === "outros") {
          outrosItens.push({ cidade: cidadeOf(r.cep), status: r.status, codigo })
        }
      }

      // PROCV nome→cidade: cidade dominante de cada motorista (p/ o DS cruzar).
      const drvCidade = new Map<string, { name: string; counts: Map<string, number> }>()
      for (const r of rows) {
        if (!r.driverId) continue
        const e = drvCidade.get(r.driverId) ?? { name: r.driverName, counts: new Map() }
        if (!e.name && r.driverName) e.name = r.driverName
        const cid = cidadeOf(r.cep)
        e.counts.set(cid, (e.counts.get(cid) ?? 0) + 1)
        drvCidade.set(r.driverId, e)
      }

      const m = `SLA aplicado p/ ${baseSlug}: ${b.pct}% (${b.total} pacotes).`
      await withPgClient(async (c) => {
        const op = await shopeeOpId(c)
        const base = await c.query("select id from base where operacao_id=$1 and slug=$2", [op, baseSlug])
        if (!base.rows.length) throw new Error(`base ${baseSlug} não encontrada`)
        const baseId = String(base.rows[0].id)
        const dataPtBr = todayBr()
        const { valid: validDrv } = await registerDrivers(c, op, drivers)

        await c.query(
          `insert into shopee_sla_record (base_id, data_pt_br, total, entregues, em_rota, ocorrencias, faltantes, outros, sla_pct, por_status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           on conflict (base_id, data_pt_br) do update set total=excluded.total, entregues=excluded.entregues,
             em_rota=excluded.em_rota, ocorrencias=excluded.ocorrencias, faltantes=excluded.faltantes,
             outros=excluded.outros, sla_pct=excluded.sla_pct, por_status=excluded.por_status, updated_at=now()`,
          [baseId, dataPtBr, b.total, b.entregues, b.emRota, b.ocorrencias, b.faltantes, b.outros, b.pct, JSON.stringify(porStatus)],
        )

        // Checkpoint: cada upload vira um ponto no Crescimento SLA do dia.
        const seq = (await c.query("select coalesce(max(seq),-1)+1 as seq from shopee_sla_checkpoint where base_id=$1 and data_pt_br=$2", [baseId, dataPtBr])).rows[0].seq
        await c.query(
          `insert into shopee_sla_checkpoint (base_id, seq, data_pt_br, label, total, entregues)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (base_id, data_pt_br, seq) do update set total=excluded.total, entregues=excluded.entregues, ts=now()`,
          [baseId, seq, dataPtBr, `SLA ${fileTime(files)}`, b.total, b.entregues],
        )

        // SLA por cidade — regrava o dia inteiro (o arquivo é o estado completo).
        await c.query("delete from shopee_sla_cidade where base_id=$1 and data_pt_br=$2", [baseId, dataPtBr])
        for (const [cid, sts] of porCidade) {
          const cb = calcSla(sts)
          await c.query(
            `insert into shopee_sla_cidade (base_id, data_pt_br, cidade, total, entregues, em_rota, ocorrencias, faltantes, outros)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [baseId, dataPtBr, cid, cb.total, cb.entregues, cb.emRota, cb.ocorrencias, cb.faltantes, cb.outros],
          )
        }

        // Itens de "Outros" por cidade (código BR) — regrava o dia inteiro.
        await c.query("delete from shopee_sla_outros_item where base_id=$1 and data_pt_br=$2", [baseId, dataPtBr])
        for (const ch of chunk(outrosItens, 1000)) {
          const vals: unknown[] = []
          const tuples = ch.map((it, i) => {
            const b = i * 5
            vals.push(baseId, dataPtBr, it.cidade, it.status, it.codigo)
            return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`
          })
          await c.query(
            `insert into shopee_sla_outros_item (base_id, data_pt_br, cidade, status, codigo) values ${tuples.join(",")}`,
            vals,
          )
        }

        // Cidade do motorista (PROCV) — só os drivers registrados, cidade dominante.
        await c.query("delete from shopee_sla_driver_cidade where base_id=$1 and data_pt_br=$2", [baseId, dataPtBr])
        for (const [driverId, e] of drvCidade) {
          if (!validDrv.has(driverId)) continue
          let best = "", bestN = -1
          for (const [cid, n] of e.counts) if (n > bestN) { best = cid; bestN = n }
          await c.query(
            `insert into shopee_sla_driver_cidade (base_id, data_pt_br, driver_id, driver_name, cidade)
             values ($1,$2,$3,$4,$5)
             on conflict (base_id, data_pt_br, driver_id) do update set driver_name=excluded.driver_name, cidade=excluded.cidade, updated_at=now()`,
            [baseId, dataPtBr, driverId, e.name, best],
          )
        }

        // Auto-descoberta de cidades (entram visíveis; o toggle do admin persiste).
        for (const cid of porCidade.keys()) {
          if (!cid) continue
          await c.query(
            "insert into shopee_base_cidade (base_id, cidade) values ($1,$2) on conflict (base_id, cidade) do nothing",
            [baseId, cid],
          )
        }

        await logUpload(c, email, "sla", filenames, b.total, m)
      })
      revalidatePath(`${SHOPEE_BASE_PATH}/sla`)
      revalidatePath(`${SHOPEE_BASE_PATH}/geral`)
      revalidatePath(`${SHOPEE_BASE_PATH}/monitoramento`)
      return { ok: true, message: m }
    }

    if (kind === "pnr") {
      const { rows, drivers } = parsePnr(await texts(files))
      const msg = await withPgClient(async (c) => {
        const op = await shopeeOpId(c)
        const bmap = await baseIdMap(c, op)
        const valid = rows.filter((r) => bmap.has(r.baseSlug))
        const { valid: validDrv } = await registerDrivers(c, op, drivers)

        for (const ch of chunk(valid, 500)) {
          const vals: unknown[] = []
          const tuples = ch.map((row, i) => {
            const b = i * 10
            vals.push(
              row.spxtn,
              row.driverId && validDrv.has(row.driverId) ? row.driverId : null,
              row.driverName,
              bmap.get(row.baseSlug),
              row.station || null,
              row.valor,
              row.status,
              row.motivo,
              pnrTimestamp(row.prazo),
              pnrTimestamp(row.createdTime),
            )
            return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10})`
          })
          if (!tuples.length) continue
          await c.query(
            `insert into shopee_pnr
               (spxtn, driver_id, driver_name, base_id, station_raw, valor, status, motivo, prazo, created_time)
             values ${tuples.join(",")}
             on conflict (spxtn) do update set
               status=excluded.status,
               last_status_at=case
                 when shopee_pnr.status is distinct from excluded.status then now()
                 else shopee_pnr.last_status_at
               end,
               updated_at=now()`,
            vals,
          )
        }

        const baseIds = [...new Set(valid.map((r) => bmap.get(r.baseSlug)!))]
        const valor = valid.reduce((sum, row) => sum + (row.valor ?? 0), 0)
        const m = `PNR aplicado: ${valid.length} PNRs em ${baseIds.length} base(s), ${brl(valor)}.`
        await logUpload(c, email, "pnr", filenames, valid.length, m)
        return m
      })
      revalidatePath(`${SHOPEE_BASE_PATH}/pnr`)
      revalidatePath(`${SHOPEE_BASE_PATH}/geral`)
      revalidatePath("/dashboard")
      revalidatePath("/dashboard/live")
      return { ok: true, message: msg }
    }

    return { ok: false, message: "Tipo desconhecido." }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

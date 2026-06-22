// Semeia uma SEMANA de dados sintéticos na base de teste xpt-dev.
// 10 motoristas com competências variadas; cada dia com entradas horárias 08h-20h
// (checkpoints de Stuck e DS) + 1 registro de SLA/dia. Datas retroativas (7 dias).
// Limpa a xpt-dev antes. Uso: node scripts/seed-sim-week.ts
import pg from "pg"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
function loadEnv() {
  for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

// RNG determinístico
let _s = 20260623
function rnd() { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296 }
function pick<T>(a: T[]): T { return a[Math.floor(rnd() * a.length)] }

const BASE = "xpt-dev"
const DAYS = 7
const H0 = 8, H1 = 20 // 08h..20h
const NAMES = ["Anderson Souza","Beatriz Lima","Carlos Mendes","Daniela Rocha","Eduardo Pinto",
               "Fernanda Alves","Gustavo Dias","Helena Castro","Igor Barbosa","Juliana Ramos"]
// competências fixas por motorista (skill consistente na semana)
const COMP = [0.97, 0.93, 0.90, 0.86, 0.83, 0.79, 0.75, 0.71, 0.67, 0.62]
const DRIVERS = NAMES.map((name, i) => ({ id: String(8000001 + i), name, comp: COMP[i], cap: 22 + Math.floor(rnd() * 16) }))

const NON_DELIV = ["OnHold", "Hub_Assigned", "Hub_Received", "Delivering", "SOC_LHTransported", "Hub_Packed"]
const CAT: Record<string, string> = { Delivering: "em_rota", OnHold: "ocorrencia", SOC_LHTransported: "faltante" }
const pad = (n: number) => String(n).padStart(2, "0")

async function main() {
  loadEnv()
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  try {
    const op = (await c.query("select id from operacao where slug='shopee'")).rows[0].id
    const base = (await c.query("select id from base where operacao_id=$1 and slug=$2", [op, BASE])).rows[0]
    if (!base) throw new Error(`base ${BASE} não existe`)
    const baseId = String(base.id)

    // limpa xpt-dev
    await c.query("delete from shopee_ds_checkpoint where base_id=$1", [baseId])
    await c.query("delete from shopee_ds_driver where base_id=$1", [baseId])
    await c.query("delete from shopee_stuck_checkpoint where base_id=$1", [baseId])
    await c.query("delete from shopee_package_event e using shopee_package p where e.package_id=p.id and p.base_id=$1", [baseId])
    await c.query("delete from shopee_package where base_id=$1", [baseId])
    await c.query("delete from shopee_sla_record where base_id=$1", [baseId])

    // motoristas
    for (const d of DRIVERS) {
      await c.query(
        `insert into driver (id, operacao_id, name, normalized_key) values ($1,$2,$3,$4)
         on conflict (id) do update set name=excluded.name, updated_at=now()`,
        [d.id, op, d.name, d.name.toLowerCase()],
      )
    }

    const today = new Date()
    const resumo: string[] = []
    for (let di = 0; di < DAYS; di++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS - 1 - di))
      const dataBr = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
      const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      const noise = (rnd() - 0.5) * 0.08 // variação do dia

      // pacotes do dia (por motorista, ~capacidade)
      type Pkg = { codigo: string; driver: string; delivered: boolean; hour: number; status: string }
      const pkgs: Pkg[] = []
      let pi = 0
      for (const d of DRIVERS) {
        const nd = Math.max(8, d.cap + Math.floor((rnd() - 0.5) * 8))
        for (let k = 0; k < nd; k++) {
          const delivered = rnd() < Math.min(0.99, Math.max(0.4, d.comp + noise))
          const hour = delivered ? Math.min(H1, H0 + 1 + Math.floor((rnd() + rnd()) / 2 * (H1 - H0))) : 0
          const status = delivered ? "Delivered" : pick(NON_DELIV)
          pkgs.push({ codigo: `BRSIM${di}${pad(pi++)}${k}`, driver: d.id, delivered, hour, status })
        }
      }
      const N = pkgs.length

      // insere pacotes (batch)
      for (let i = 0; i < pkgs.length; i += 500) {
        const ch = pkgs.slice(i, i + 500)
        const vals: unknown[] = []
        const tuples = ch.map((p, j) => {
          const b = j * 7
          const delAt = p.delivered ? `${iso} ${pad(p.hour)}:00:00` : null
          vals.push(baseId, p.codigo, p.status, p.driver, +(1 + rnd() * 9).toFixed(2), iso, delAt)
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`
        })
        await c.query(
          `insert into shopee_package (base_id, codigo, status, driver_id, dias_preso, last_backlog_date, delivered_at)
           values ${tuples.join(",")} on conflict (base_id, codigo) do nothing`,
          vals,
        )
      }

      // checkpoints de Stuck (horários) — ainda_stuck = não entregues até a hora h
      const totalDeliv = pkgs.filter((p) => p.delivered).length
      for (let h = H0, seq = 0; h <= H1; h++, seq++) {
        const resolv = pkgs.filter((p) => p.delivered && p.hour <= h).length
        await c.query(
          `insert into shopee_stuck_checkpoint (base_id, seq, data_pt_br, ts, label, total, ainda_stuck, resolvidos)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [baseId, seq, dataBr, `${iso} ${pad(h)}:00:00`, `${pad(h)}:00`, N, N - resolv, resolv],
        )
      }

      // DS por motorista (estado final do dia)
      for (const d of DRIVERS) {
        const mine = pkgs.filter((p) => p.driver === d.id)
        const assigned = mine.length
        const ent = mine.filter((p) => p.delivered).length
        const naoDeliv = assigned - ent
        const rota = Math.round(naoDeliv * 0.4)
        const oc = naoDeliv - rota
        await c.query(
          `insert into shopee_ds_driver (base_id, data_pt_br, driver_id, driver_name, saiu, entregues, em_rota, ocorrencias)
           values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (base_id, data_pt_br, driver_id) do update set
           saiu=excluded.saiu, entregues=excluded.entregues, em_rota=excluded.em_rota, ocorrencias=excluded.ocorrencias, updated_at=now()`,
          [baseId, dataBr, d.id, d.name, assigned, ent, rota, oc],
        )
      }
      // checkpoints de DS (horários) — entregues acumulado
      for (let h = H0, seq = 0; h <= H1; h++, seq++) {
        const ent = pkgs.filter((p) => p.delivered && p.hour <= h).length
        await c.query(
          `insert into shopee_ds_checkpoint (base_id, seq, data_pt_br, ts, label, saiu, entregues, em_rota, ocorrencias)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [baseId, seq, dataBr, `${iso} ${pad(h)}:00:00`, `${pad(h)}:00`, N, ent, N - ent, 0],
        )
      }

      // SLA do dia (agregado dos pacotes)
      const porStatus: Record<string, number> = {}
      let em_rota = 0, ocorr = 0, falt = 0
      for (const p of pkgs) {
        porStatus[p.status] = (porStatus[p.status] ?? 0) + 1
        const cat = p.status === "Delivered" ? "entregue" : (CAT[p.status] ?? "outros")
        if (cat === "em_rota") em_rota++
        else if (cat === "ocorrencia") ocorr++
        else if (cat === "faltante") falt++
      }
      const outros = N - totalDeliv - em_rota - ocorr - falt
      const slaPct = +(totalDeliv / N * 100).toFixed(2)
      await c.query(
        `insert into shopee_sla_record (base_id, data_pt_br, total, entregues, em_rota, ocorrencias, faltantes, outros, sla_pct, por_status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (base_id, data_pt_br) do update set
         total=excluded.total, entregues=excluded.entregues, em_rota=excluded.em_rota, ocorrencias=excluded.ocorrencias,
         faltantes=excluded.faltantes, outros=excluded.outros, sla_pct=excluded.sla_pct, por_status=excluded.por_status, updated_at=now()`,
        [baseId, dataBr, N, totalDeliv, em_rota, ocorr, falt, outros, slaPct, JSON.stringify(porStatus)],
      )

      resumo.push(`  ${dataBr}: ${N} pacotes | entregues ${totalDeliv} | SLA ${slaPct}% | stuck final ${N - totalDeliv}`)
    }

    console.log("✓ semana semeada na base xpt-dev:")
    for (const r of resumo) console.log(r)
    console.log(`\nmotoristas (competência): ${DRIVERS.map((d) => `${d.name.split(" ")[0]} ${Math.round(d.comp * 100)}%`).join(" · ")}`)
  } finally {
    await c.end()
  }
}
main().catch((e) => { console.error("FALHA:", e.message); process.exit(1) })

// Worker de processamento de planilhas — roda FORA do processo web (AD-06).
// Consome processing_jobs (pending → processing → done|failed), baixa o arquivo
// do bucket e despacha pro handler do kind. Sem SQS na Fase 1: poll no Postgres
// com FOR UPDATE SKIP LOCKED (seguro com múltiplas réplicas do worker).
//
// Rodar: npm run worker   (dev, via tsx)
//        container próprio no docker-compose (prod)
import { pool, withPgClient } from "@painel/db"
import { getObject } from "@painel/storage"

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000)
const JOB_TIMEOUT_MS = Number(process.env.WORKER_JOB_TIMEOUT_MS ?? 120_000)
const MAX_SIZE_BYTES = Number(process.env.WORKER_MAX_SIZE_BYTES ?? 10 * 1024 * 1024)

type Job = {
  id: number
  kind: string
  s3_key: string
  filename: string | null
  size_bytes: number | null
  requested_by: string | null
  payload: Record<string, unknown> | null
}

type Handler = (file: Buffer, job: Job) => Promise<string>

// ── Handlers por kind ────────────────────────────────────────────────────────
// A migração completa dos parsers (SLA/DS/backlog/tracking/PNR) pra cá é a
// evolução da Fase 3: o upload hoje ainda processa síncrono no web e ARQUIVA o
// original no bucket; quando um kind migrar pro assíncrono, o parser dele vem
// de src/lib/shopee/* (funções puras já compartilhadas) e entra neste registro.
const handlers: Record<string, Handler> = {
  // "archive" = arquivo já persistido no bucket; nada a processar.
  archive: async (file) => `arquivado (${file.length} bytes)`,
}

// ── Loop ─────────────────────────────────────────────────────────────────────

async function claimJob(): Promise<Job | null> {
  return withPgClient(async (c) => {
    await c.query("begin")
    try {
      const { rows } = await c.query<Job>(
        `select id, kind, s3_key, filename, size_bytes, requested_by, payload
           from processing_jobs
          where status = 'pending'
          order by created_at
          limit 1
          for update skip locked`,
      )
      const job = rows[0] ?? null
      if (job) {
        await c.query(
          `update processing_jobs set status = 'processing', started_at = now() where id = $1`,
          [job.id],
        )
      }
      await c.query("commit")
      return job
    } catch (err) {
      await c.query("rollback")
      throw err
    }
  })
}

async function finishJob(id: number, ok: boolean, message: string) {
  await pool.query(
    `update processing_jobs
        set status = $2, error_message = $3, finished_at = now()
      where id = $1`,
    [id, ok ? "done" : "failed", ok ? null : message],
  )
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`timeout após ${ms}ms`)), ms),
    ),
  ])
}

async function processJob(job: Job) {
  const handler = handlers[job.kind]
  if (!handler) throw new Error(`kind desconhecido: ${job.kind}`)
  if (job.size_bytes && job.size_bytes > MAX_SIZE_BYTES) {
    throw new Error(`arquivo excede o limite de ${MAX_SIZE_BYTES} bytes`)
  }
  const file = await getObject(job.s3_key)
  if (file.length > MAX_SIZE_BYTES) {
    throw new Error(`arquivo excede o limite de ${MAX_SIZE_BYTES} bytes`)
  }
  return withTimeout(handler(file, job), JOB_TIMEOUT_MS)
}

let running = true

async function main() {
  console.log(`[worker] iniciado — poll ${POLL_MS}ms, timeout ${JOB_TIMEOUT_MS}ms`)
  while (running) {
    try {
      const job = await claimJob()
      if (!job) {
        await new Promise((r) => setTimeout(r, POLL_MS))
        continue
      }
      console.log(`[worker] job ${job.id} (${job.kind}) ${job.s3_key}`)
      try {
        const summary = await processJob(job)
        await finishJob(job.id, true, summary)
        console.log(`[worker] job ${job.id} done: ${summary}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await finishJob(job.id, false, msg)
        console.error(`[worker] job ${job.id} FAILED: ${msg}`)
      }
    } catch (err) {
      // erro de infra (banco fora etc.) — loga e tenta de novo no próximo ciclo
      console.error("[worker] erro no loop:", err instanceof Error ? err.message : err)
      await new Promise((r) => setTimeout(r, POLL_MS))
    }
  }
  await pool.end()
  console.log("[worker] encerrado")
}

process.on("SIGTERM", () => {
  running = false
})
process.on("SIGINT", () => {
  running = false
})

main().catch((err) => {
  console.error("[worker] fatal:", err)
  process.exit(1)
})

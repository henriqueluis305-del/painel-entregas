// Storage de arquivos (S3 na AWS, MinIO no dev local — mesma API).
// AWS_ENDPOINT_URL definido → MinIO/dev; ausente → S3 real (prod).
// Bucket privado sempre: browser sobe/baixa via presigned URL, nunca direto.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const g = globalThis as unknown as { __s3Client?: S3Client }

function makeClient() {
  return new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    // definido só em dev (MinIO); undefined em prod = endpoint S3 padrão
    endpoint: process.env.AWS_ENDPOINT_URL,
    // MinIO exige path-style (bucket no path, não no host)
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  })
}

export const s3: S3Client = g.__s3Client ?? (g.__s3Client = makeClient())

export function bucket(): string {
  const b = process.env.S3_BUCKET
  if (!b) throw new Error("S3_BUCKET não definido.")
  return b
}

const PRESIGN_TTL_S = 60 * 10 // 10 min — só o tempo do upload/download

/** URL temporária de UPLOAD (PUT direto do browser pro bucket, sem passar pelo app). */
export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType })
  return getSignedUrl(s3, cmd, { expiresIn: PRESIGN_TTL_S })
}

/** URL temporária de DOWNLOAD (worker/exports/auditoria). */
export async function getDownloadUrl(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key })
  return getSignedUrl(s3, cmd, { expiresIn: PRESIGN_TTL_S })
}

/** Upload server-side (worker, arquivamento de originais). */
export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }))
}

/** Download server-side (worker processa a planilha a partir do bucket). */
export async function getObject(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
  const bytes = await res.Body!.transformToByteArray()
  return Buffer.from(bytes)
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
}

/** Chave padronizada p/ planilhas: uploads/<kind>/<ano-mes>/<timestamp>_<nome>. */
export function uploadKey(kind: string, filename: string): string {
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const safe = filename.replace(/[^\w.\-]+/g, "_")
  return `uploads/${kind}/${ym}/${now.getTime()}_${safe}`
}

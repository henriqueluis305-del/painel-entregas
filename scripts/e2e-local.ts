// Smoke test do clone local da AWS (infra/docker-compose.dev.yml de pé + seed:auth rodado).
// Uso: npm run test:e2e-local
// E2E do clone local da AWS: Cognito login+verify, MinIO storage, worker job.
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { JwtVerifier } from "aws-jwt-verify"

import { putObject, getObject, getUploadUrl, uploadKey } from "@painel/storage"
import { pool, query } from "@painel/db"

const fail = (m: string) => {
  console.error("FALHOU:", m)
  process.exit(1)
}

async function main() {
// ── 1. Cognito: login USER_PASSWORD_AUTH + verificação do idToken ───────────
const cognito = new CognitoIdentityProviderClient({
  region: "us-east-1",
  endpoint: process.env.COGNITO_ENDPOINT,
})
const auth = await cognito.send(
  new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: process.env.COGNITO_CLIENT_ID!,
    AuthParameters: { USERNAME: "admin@dev.local", PASSWORD: "admin12345" },
  }),
)
const idToken = auth.AuthenticationResult?.IdToken
if (!idToken) fail("login cognito-local não devolveu IdToken")
console.log("✓ cognito-local: login ok")

const endpointUrl = new URL(process.env.COGNITO_ENDPOINT!)
const verifier = JwtVerifier.create({
  // cognito-local emite iss com o host de bind interno (0.0.0.0) — aceita ambos
  issuer: [
    `${process.env.COGNITO_ENDPOINT}/${process.env.COGNITO_USER_POOL_ID}`,
    `${endpointUrl.protocol}//0.0.0.0:${endpointUrl.port}/${process.env.COGNITO_USER_POOL_ID}`,
  ],
  audience: process.env.COGNITO_CLIENT_ID!,
  jwksUri: `${process.env.COGNITO_ENDPOINT}/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
})
// fetcher do aws-jwt-verify só aceita https — pré-carrega o JWKS do local via http
const jwksRes = await fetch(
  `${process.env.COGNITO_ENDPOINT}/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
)
;(verifier as unknown as { cacheJwks(j: unknown): void }).cacheJwks(await jwksRes.json())
const claims = await verifier.verify(idToken!)
if (!claims.sub) fail("JWT sem sub")
console.log(`✓ cognito-local: JWT verificado (sub ${String(claims.sub).slice(0, 8)}…, email ${claims.email})`)

// perfil correspondente no Postgres local
const [profile] = await query<{ email: string; is_admin: boolean }>(
  `select email, is_admin from app_user where id = $1`,
  [claims.sub],
)
if (!profile?.is_admin) fail("perfil admin não encontrado na app_user local")
console.log(`✓ postgres local: perfil ${profile.email} (admin) casado com o sub do token`)

// ── 2. MinIO: put/get + presigned URL ────────────────────────────────────────
const key = uploadKey("teste", "e2e.txt")
await putObject(key, Buffer.from("conteudo-e2e"), "text/plain")
const back = await getObject(key)
if (back.toString() !== "conteudo-e2e") fail("getObject devolveu conteúdo errado")
console.log(`✓ minio: putObject/getObject ok (${key})`)

const url = await getUploadUrl(uploadKey("teste", "presigned.txt"), "text/plain")
const put = await fetch(url, { method: "PUT", body: "via-presigned" })
if (!put.ok) fail(`upload via presigned falhou: ${put.status}`)
console.log("✓ minio: upload via presigned URL ok (browser-style)")

// ── 3. Worker: job archive processado ────────────────────────────────────────
await query(
  `insert into processing_jobs (kind, s3_key, filename, requested_by) values ('archive', $1, 'e2e.txt', 'e2e@test')`,
  [key],
)
console.log("… job inserido; aguardando worker processar (rodando em paralelo)")
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  const [job] = await query<{ status: string; error_message: string | null }>(
    `select status, error_message from processing_jobs order by id desc limit 1`,
  )
  if (job.status === "done") {
    console.log("✓ worker: job archive processado (status done)")
    await pool.end()
    console.log("\nE2E COMPLETO — clone local da AWS operacional.")
    process.exit(0)
  }
  if (job.status === "failed") fail(`worker marcou failed: ${job.error_message}`)
}
fail("worker não processou o job em 20s")

}
main().catch((e) => { console.error(e); process.exit(1) })

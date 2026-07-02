// Seed do cognito-local (dev): cria User Pool + App Client + usuário admin,
// grava COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID no .env.local e o admin na
// app_user do Postgres local. Idempotente: roda de novo sem duplicar.
//
// Uso: node scripts/seed-auth.mjs   (com o docker-compose.dev de pé)
//   ADMIN_EMAIL / ADMIN_PASSWORD opcionais (default admin@dev.local / admin12345)
import {
  CognitoIdentityProviderClient,
  CreateUserPoolCommand,
  CreateUserPoolClientCommand,
  ListUserPoolsCommand,
  ListUserPoolClientsCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { Client } from "pg"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const ENDPOINT = process.env.COGNITO_ENDPOINT ?? "http://localhost:9229"
const POOL_NAME = "painel-dev"
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@dev.local"
const PASSWORD = process.env.ADMIN_PASSWORD ?? "admin12345"
const DB_URL = process.env.DEV_DATABASE_URL ?? "postgresql://postgres:dev@localhost:5433/painel"

const cognito = new CognitoIdentityProviderClient({
  region: "us-east-1",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: "dev", secretAccessKey: "devsecret" },
})

async function ensurePool() {
  const pools = await cognito.send(new ListUserPoolsCommand({ MaxResults: 60 }))
  const found = pools.UserPools?.find((p) => p.Name === POOL_NAME)
  if (found) return found.Id
  const created = await cognito.send(new CreateUserPoolCommand({ PoolName: POOL_NAME }))
  return created.UserPool.Id
}

async function ensureClient(poolId) {
  const clients = await cognito.send(
    new ListUserPoolClientsCommand({ UserPoolId: poolId, MaxResults: 60 }),
  )
  const found = clients.UserPoolClients?.[0]
  if (found) return found.ClientId
  const created = await cognito.send(
    new CreateUserPoolClientCommand({
      UserPoolId: poolId,
      ClientName: "painel-web",
      ExplicitAuthFlows: ["USER_PASSWORD_AUTH", "REFRESH_TOKEN_AUTH"],
    }),
  )
  return created.UserPoolClient.ClientId
}

async function ensureAdmin(poolId) {
  const users = await cognito.send(
    new ListUsersCommand({ UserPoolId: poolId, Filter: `email = "${EMAIL}"` }),
  )
  let user = users.Users?.[0]
  if (!user) {
    const created = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: EMAIL,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: EMAIL },
          { Name: "email_verified", Value: "true" },
        ],
      }),
    )
    user = created.User
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: user.Username,
        Password: PASSWORD,
        Permanent: true,
      }),
    )
  }
  return user.Attributes?.find((a) => a.Name === "sub")?.Value ?? user.Username
}

async function ensureProfile(sub) {
  const db = new Client({ connectionString: DB_URL })
  await db.connect()
  try {
    await db.query(
      `insert into app_user (id, email, empresa, role, base_scope, is_admin, active, approval_status)
       values ($1, $2, 'Admin Dev', 'COORDENADOR', 'ALL', true, true, 'approved')
       on conflict (id) do update set is_admin = true, active = true, approval_status = 'approved'`,
      [sub, EMAIL],
    )
  } finally {
    await db.end()
  }
}

function upsertEnv(vars) {
  const envPath = path.join(ROOT, ".env.local")
  let txt = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : ""
  for (const [k, v] of Object.entries(vars)) {
    const line = `${k}=${v}`
    txt = txt.match(new RegExp(`^${k}=`, "m"))
      ? txt.replace(new RegExp(`^${k}=.*$`, "m"), line)
      : txt.trimEnd() + `\n${line}\n`
  }
  fs.writeFileSync(envPath, txt)
}

const poolId = await ensurePool()
const clientId = await ensureClient(poolId)
const sub = await ensureAdmin(poolId)
await ensureProfile(sub)
upsertEnv({ COGNITO_USER_POOL_ID: poolId, COGNITO_CLIENT_ID: clientId })

console.log(`User Pool:  ${poolId}`)
console.log(`App Client: ${clientId}`)
console.log(`Admin:      ${EMAIL} / ${PASSWORD}  (sub ${sub})`)
console.log(`.env.local atualizado. Login em http://localhost:3000/login com AUTH_MODE=cognito-local.`)

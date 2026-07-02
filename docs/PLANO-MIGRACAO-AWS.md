# Plano de Migração para AWS — Painel de Entregas

**Versão 1.0 — Julho de 2026**
Base técnica: `arquitetura_dashboards.md` (v2.0) + auditoria real do código em `feat/painel-live`.

> Este documento parte do **estado real do repositório** (não do ideal do doc de arquitetura) e traça o caminho concreto para deixar **tudo compatível com AWS**: Cognito (auth), RDS PostgreSQL (banco), S3 (arquivos) e EC2 + Docker Compose (runtime). Decisões travadas com o time: **Auth → Cognito**, **Banco → RDS**, motivação = **plataforma única + dashboard financeiro ainda a construir**.

---

## 0. Veredito e decisões

### 0.1 O plano da AWS é válido?

Sim, com uma ressalva de motivação:

- **Custo, sozinho, não justifica.** Neste volume (uso interno, ~12 planilhas/dia), Supabase + Vercel nos planos atuais tende a ser **mais barato** que os ~US$ 70–100/mês da EC2+RDS+CloudFront. Migrar só por custo seria contraproducente.
- **A justificativa real e forte é estratégica:** (1) consolidar tudo numa plataforma só (conta AWS da empresa) e (2) **o dashboard financeiro ainda não existe**. Construir o financeiro no Supabase e migrar depois = migrar duas vezes. Fazer Cognito + RDS **agora**, antes do financeiro nascer, é a hora certa e barata (em esforço) de fazer.
- O financeiro lida com **CPF/CNPJ e salário** — o dado que mais pede infra própria (KMS, VPC privada, audit log). Isso reforça a decisão.

**Conclusão:** migração aprovada, **como investimento de base para o financeiro**, não como economia imediata.

### 0.2 O que o doc de arquitetura acerta e o que ele subestima

| Ponto do doc | Situação real | Veredito |
|---|---|---|
| AD-01: Next roda como Node, não estático | ✅ Confirmado (`src/proxy.ts` = middleware, Server Actions em uso) | Correto |
| AD-02/03: CloudFront à frente da EC2, S3 só arquivos | Ainda não existe infra | Correto, seguir |
| AD-04: EC2 única + Docker Compose | — | Correto p/ o volume |
| AD-05: RDS com KMS na criação | Hoje é Supabase | Correto — **crítico não esquecer** |
| AD-06: worker de planilhas fora do web | ❌ **Hoje o parse roda dentro do Server Action** (ExcelJS em memória do web) | **Gap grande** |
| AD-07: pool singleton | ❌ **Hoje abre `new Client()` por chamada** (`withPgClient`) | **Gap — refatorar** |
| AD-09: segredos no SSM | Hoje `.env.local` | Correto |
| **Troca Supabase Auth → Cognito** | Doc trata como trivial | **É a parte mais cara — subestimada** |
| **Troca Supabase-JS `.from()` → SQL puro** | Doc não menciona | **Gap — metade das queries usam `supabase-js`** |

---

## 1. Estado atual (auditado) × alvo AWS

### 1.1 Como o app funciona hoje

```
Vercel (Next.js full-stack, 1 app)
  ├─ Auth: Supabase Auth (cookies/JWT via @supabase/ssr)
  │     • src/proxy.ts → updateSession() valida sessão em TODO request
  │     • getSessionProfile(): supabase.auth.getUser() + service_role lê app_user
  │     • signup: supabase.auth.admin.createUser() + ban_duration (aprovação do admin)
  ├─ Dados: Supabase Postgres, DOIS caminhos:
  │     • pg.Client novo por chamada (withPgClient) — SQL puro
  │     • supabase-js service_role (.from()) — queries.ts, auth.ts
  ├─ Upload: Server Action recebe File → ExcelJS parseia EM MEMÓRIA → insere no PG
  │     • sem S3, sem presigned URL, sem worker
  └─ Migrations: arquivos sql/*.sql aplicados por scripts/run-sql.mjs (sem framework)
```

### 1.2 Alvo (Fase 1 AWS)

```
Route 53 → CloudFront (TLS + cache de /_next/static) → EC2 (Caddy)
  ├─ monitoramento-web  (Next `next start`, container)
  ├─ financeiro-web     (Next `next start`, container) [a construir]
  └─ worker             (Node, processa planilhas do S3)
         │
         ├─ RDS PostgreSQL (privado, KMS, schemas auth/monitoramento/financeiro)
         ├─ S3 privado (planilhas/exports) + presigned URLs
         ├─ Cognito User Pool (login, grupos = perfis)
         ├─ SSM Parameter Store (segredos)
         └─ CloudWatch (logs/métricas)
```

### 1.3 Mapa de acoplamento a atacar (arquivos reais)

| Camada | Arquivos | Ação |
|---|---|---|
| Auth (client SSR) | `src/lib/supabase/{server,client,middleware}.ts`, `src/proxy.ts` | Reescrever p/ Cognito |
| Auth (perfil/admin) | `src/lib/auth.ts`, `src/lib/supabase/admin.ts`, `src/app/login/actions.ts`, `src/app/dashboard/admin/actions.ts` | Reescrever p/ Cognito Admin API |
| Dados via supabase-js | `src/lib/queries.ts`, `src/lib/auth.ts` (`.from("app_user")`) | Trocar por `pg` |
| Dados via pg (sem pool) | `src/lib/pg.ts` + 8 arquivos que usam `withPgClient` | Refatorar p/ pool singleton |
| Upload in-request | `src/app/dashboard/operacao/shopee/uploads/actions.ts` | Quebrar em presigned + worker |
| Migrations | `sql/*.sql`, `scripts/run-sql.mjs` | Adotar framework (Drizzle/node-pg-migrate) |

---

## 2. Estratégia de repositório

**Recomendação: monorepo com workspaces** (não dois repos). Os dois dashboards compartilham auth, permissões, acesso a banco e componentes de UI — separar em repos duplicaria isso. O doc pede "separados em deploy, não acoplados em código" → workspaces entregam exatamente isso: imagens Docker independentes, código compartilhado via `packages/`.

### 2.1 Estrutura alvo

```
painel-entregas/                      (monorepo, npm/pnpm workspaces)
├── apps/
│   ├── monitoramento/                ← o app Next atual migra p/ cá
│   │   ├── src/app/…                 (dashboard/operacao/shopee, live, etc.)
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── financeiro/                   ← novo, nasce AWS-native
│   │   ├── src/app/…
│   │   ├── Dockerfile
│   │   └── package.json
│   └── worker/                       ← processamento de planilhas fora do web
│       ├── src/index.ts
│       ├── Dockerfile
│       └── package.json
├── packages/
│   ├── db/                           ← pool pg singleton + migrations + schema
│   │   ├── src/pool.ts
│   │   ├── migrations/
│   │   └── src/queries/…
│   ├── auth/                         ← Cognito: validação JWT, admin, RBAC
│   │   ├── src/cognito.ts
│   │   ├── src/session.ts            (getSessionProfile, requirePerm)
│   │   └── src/permissions.ts        (move o atual src/lib/permissions.ts)
│   ├── storage/                      ← S3: presigned URLs, get/put
│   └── ui/                           ← componentes shadcn compartilhados (opcional fase 2)
├── infra/
│   ├── docker-compose.yml               ← prod-like (imagens dos apps)
│   ├── docker-compose.dev.yml           ← clone local da AWS (db + MinIO + cognito-local)
│   ├── Caddyfile
│   ├── terraform/  (ou cloudformation/)   ← IaC: VPC, RDS, S3, Cognito, EC2, IAM, SSM
│   └── scripts/    (deploy.sh, migrate.sh, seed-auth.sh)
├── docs/
└── package.json                      (workspaces: ["apps/*","packages/*"])
```

**Não** separar "uma pasta backend / uma frontend": o Next é full-stack, front e back moram juntos por design (Server Actions/Route Handlers). A separação certa é **por app** (monitoramento/financeiro/worker) + **código comum em packages/**.

### 2.2 Migração incremental (não big-bang)

O repo continua funcionando no Supabase enquanto migramos. Cada `package` é adotado atrás de um flag ou substituição direta, e só no fim viramos a infra. Ordem em §10.

---

## 3. FASE 0 — Desacoplar o código (sem tocar em infra ainda)

> Objetivo: deixar o código pronto pra trocar de provider sem reescrever regra de negócio. Tudo isso roda **ainda no Supabase**, então é seguro e testável hoje.

### 3.1 Pool de conexões singleton (AD-07) — `packages/db/src/pool.ts`

Substitui o `withPgClient` (que abre/fecha Client por chamada). Crítico com SSR.

```ts
import { Pool } from "pg"

const g = globalThis as unknown as { pgPool?: Pool }

export const pool =
  g.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 8),
    idleTimeoutMillis: 30_000,
    ssl: process.env.PG_SSL === "off" ? false : { rejectUnauthorized: false },
  })

if (process.env.NODE_ENV !== "production") g.pgPool = pool

export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params)
  return rows as T[]
}
export async function tx<T>(fn: (c: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect()
  try { await c.query("begin"); const r = await fn(c); await c.query("commit"); return r }
  catch (e) { await c.query("rollback"); throw e }
  finally { c.release() }
}
```

Migrar os 8 arquivos que usam `withPgClient` (uploads/actions, config/actions, live/driver-actions, cep, live-queries, cidade-queries, pnr-queries, pg.ts) para `pool`/`query`/`tx`. Dimensionamento: web 8, financeiro 8, worker 4 (≈20, teto RDS t4g.micro ~112).

### 3.2 Eliminar `supabase-js` do caminho de dados

Hoje `src/lib/queries.ts` e `src/lib/auth.ts` leem tabelas com `supabase-js` (`.from("app_user")`, `.from("operacao")`…). No RDS **não existe PostgREST** — isso quebra. Reescrever tudo como SQL via `pool`:

```ts
// antes (queries.ts)
const { data } = await sb.from("operacao").select("...").order("label")
// depois
const rows = await query<Operacao>(`select id, slug, label, active, in_sidebar from operacao order by label`)
```

Inventário a converter: `getOperacoesWithBases`, leitura de `app_user` em `getSessionProfile`, e todo `createAdminClient().from(...)`. Isso deixa **100% do acesso a dados via `pg`** — pré-requisito do RDS.

### 3.3 Abstrair a sessão atrás de uma interface

Criar `packages/auth/src/session.ts` com a **mesma assinatura pública de hoje** (`getSessionProfile`, `requirePerm`, `requireOperacaoAccess`) para o resto do app não mudar. Na Fase 0 a implementação ainda chama Supabase; na Fase 1 troca o miolo por Cognito. `permissions.ts` move pra cá **sem alteração** (a lógica de RBAC é independente do provider).

**Entregável Fase 0:** app roda igual, no Supabase, mas com pool singleton, zero `supabase-js` em queries de dados, e auth isolada atrás de interface. Testável em produção hoje.

---

## 4. FASE 1 — Autenticação: Cognito

> A parte mais cara. Faça depois da Fase 0 (interface de sessão já isolada).

### 4.1 O que muda conceitualmente

| Hoje (Supabase) | Alvo (Cognito) |
|---|---|
| `supabase.auth.getUser()` valida cookie | Validar **JWT Cognito** (assinatura JWKS, issuer, audience, exp) no servidor |
| `app_user.id` = UUID do Supabase Auth | `app_user.cognito_sub` = `sub` do Cognito (nova coluna) |
| `admin.createUser()` + `ban_duration` p/ pendente | `AdminCreateUser` + `AdminDisableUser` até aprovação |
| Perfil lido via service_role | Perfil lido via `pg` por `cognito_sub` |
| Grupos: role no `app_user` | Grupos do Cognito (admin/gestor/operador/financeiro) **+** RBAC fino no `app_user` |

### 4.2 Componentes novos (`packages/auth`)

- **`cognito.ts`** — cliente do User Pool + verificação de JWT (usar `aws-jwt-verify`). Cacheia JWKS.
- **`session.ts`** — `getSessionProfile()`: lê o cookie de sessão → valida JWT → pega `sub` → `select … from app_user where cognito_sub = $1`. Mantém o tipo `Profile` atual.
- **Login flow** — duas opções:
  - **Hosted UI do Cognito** (mais rápido, menos código; redireciona pro domínio Cognito). Recomendado p/ Fase 1.
  - **SDK/`amazon-cognito-identity-js`** (login na própria tela). Mais trabalho, melhor UX. Fase 2.
- **Signup com aprovação** — `AdminCreateUser` cria já `DISABLED`; admin aprova → `AdminEnableUser` + `AdminAddUserToGroup`. Espelha o `ban_duration` atual.
- **Admin de usuários** (`dashboard/admin/actions.ts`) — trocar `supabase.auth.admin.*` por `@aws-sdk/client-cognito-identity-provider` (`AdminCreateUser`, `AdminDisableUser`, `AdminUpdateUserAttributes`, `AdminSetUserPassword`).

### 4.3 Middleware (`src/proxy.ts` / `updateSession`)

Reescrever `updateSession` para: ler cookie de sessão → validar/renovar tokens Cognito → redirecionar `/login` se inválido. A **estrutura** (matcher, redirect) permanece; muda o miolo de validação.

### 4.4 Migração dos usuários existentes

Supabase Auth → Cognito não tem export de hash de senha utilizável diretamente. Opções:
1. **Reset de senha em massa** (recomendado p/ base pequena/interna): criar todos no Cognito com senha temporária → forçar troca no 1º login. Simples, seguro.
2. Migração lazy com Lambda trigger (`USER_MIGRATION`) — mais complexo, desnecessário nesta escala.

Manter `app_user` como fonte de verdade de **perfil/permissão**; só a **identidade** vai pro Cognito. Adicionar `app_user.cognito_sub` e popular no momento da criação.

---

## 5. FASE 2 — Banco: RDS PostgreSQL

### 5.1 Provisionar (AD-05 — atenção crítica)

- RDS PostgreSQL, **subnet privada**, **criptografia KMS LIGADA NA CRIAÇÃO** (não dá pra ligar depois sem snapshot→cópia→restore).
- Security Group: 5432 **apenas** do SG da EC2.
- Backup automático (retenção ≥7 dias) + snapshot manual mensal.
- Instância inicial: `db.t4g.micro` (sobe conforme necessário).

### 5.2 Schemas (isolamento lógico, um database)

```sql
create schema auth;           -- app_user, roles, audit_logs
create schema monitoramento;  -- shopee_*, uploads, bases, cidades
create schema financeiro;     -- payroll_* (novo)
```

Hoje as tabelas Shopee vivem em `public`. Decidir: mover p/ `monitoramento` (mais limpo, exige ajustar search_path/queries) **ou** manter `public` na primeira rodada e só o financeiro nasce em schema próprio. **Recomendo manter `public` p/ o que existe** e criar `financeiro` isolado — menos risco na migração de dados.

### 5.3 Migração de dados Supabase → RDS

1. `pg_dump` do Supabase (schema + dados) — **excluir** o schema `auth` interno do Supabase e objetos de extensão (PostgREST, `auth.*`, `storage.*`).
2. Ajustar: remover policies RLS que dependem de `auth.uid()` do Supabase (no RDS a autorização é no app, não RLS). O `02_rls.sql` atual vira **obsoleto** — a segurança passa a ser 100% no servidor (já é o padrão via service_role hoje).
3. `pg_restore` no RDS.
4. Recriar a coluna/índice `app_user.cognito_sub`.
5. Validar contagens por tabela (script `scripts/check-db.mjs` já existe — adaptar p/ comparar origem×destino).

### 5.4 Framework de migrations (substitui `run-sql.mjs`)

Os 28 `sql/*.sql` numerados são migrations manuais. Para produção, adotar **node-pg-migrate** ou **Drizzle Kit**:
- Importar os `.sql` existentes como baseline (migration `0000_baseline`).
- Daqui pra frente, cada mudança = migration versionada, rodada **antes** do deploy (`infra/scripts/migrate.sh`), com rollback.
- Recomendo **Drizzle** se quiser também tipos TS das tabelas (útil pro financeiro do zero); **node-pg-migrate** se quiser ficar em SQL puro (menor curva, alinha com o estilo atual).

---

## 6. FASE 3 — S3 + presigned + worker (fecha AD-06 / fluxo 7.2)

> Hoje o upload é processado dentro do Server Action. Precisa quebrar em 3 partes.

### 6.1 Fluxo alvo

```
web: usuário escolhe planilha
  → Server Action valida permissão, cria monitoring_uploads (status=pending), gera PRESIGNED URL (PutObject)
  → browser faz upload DIRETO ao S3 (não passa pela EC2)
  → web dispara o worker (mensagem/registro), retorna "processando"
worker: baixa do S3 → valida (tamanho ≤10MB, timeout) → ExcelJS/CSV parse → insere no PG → status=done|failed
web: dashboard consulta dados processados / status
```

### 6.2 `packages/storage`

- `getUploadUrl(key, contentType)` → presigned PUT.
- `getDownloadUrl(key)` → presigned GET (worker/exports).
- Bucket privado, Block Public Access, versionado, SSE-KMS no bucket sensível (financeiro).

### 6.3 `apps/worker`

- Node standalone. **Fase 1 sem SQS** (AD-06): o web dispara via tabela `processing_jobs` (poll) ou chamada HTTP interna ao container worker. Reaproveita **toda a lógica de parse atual** de `uploads/actions.ts` (`parseCsvObjects`, `parsePnr`, `calcSla`, `calcDs`, ExcelJS) — move pra cá quase sem alterar.
- Controles obrigatórios: limite 10MB, timeout, `status` persistido, mensagem de erro (`processing_errors`).

### 6.4 Refator de `uploads/actions.ts`

Dividir em:
- **Server Action fino** (web): autoriza (mantém `requireUploadPerm`), cria registro, devolve presigned URL, enfileira job.
- **Lógica de parse** (worker): o corpo pesado atual (ExcelJS, chunks, inserts) migra pra `apps/worker`.

Tabelas novas: `monitoring_uploads`, `processing_jobs`, `processing_errors` (o `shopee_upload_log` atual vira base disso).

---

## 7. FASE 4 — Infraestrutura AWS (IaC)

> **Tudo via Terraform** em `infra/terraform/` (reprodutível, versionado). Não clicar no console.

### 7.1 Recursos a provisionar

| Recurso | Config |
|---|---|
| VPC | subnets pública (EC2) + privada (RDS) |
| EC2 | `t3.small`/`t4g.small`, IAM Role (S3+KMS+SSM), Docker + Compose |
| RDS | PostgreSQL, privado, KMS na criação, SG só-EC2, backup automático |
| S3 | bucket privado, Block Public Access, versionado, SSE-KMS |
| Cognito | User Pool, grupos (admin/gestor_monitoramento/operador_monitoramento/financeiro/leitura_auditoria), app client |
| CloudFront | TLS (ACM) + **cache split** (§7.3) |
| Route 53 | DNS → CloudFront |
| SSM Parameter Store | segredos (SecureString) sob `/app/logistica/*` |
| CloudWatch | log group por container, alarmes básicos |

### 7.2 `infra/docker-compose.yml` + `Caddyfile`

```yaml
services:
  reverse-proxy:
    image: caddy:latest
    ports: ["80:80","443:443"]
    volumes: ["./Caddyfile:/etc/caddy/Caddyfile","caddy_data:/data"]
  monitoramento-web:
    image: ${ECR}/monitoramento:${TAG}
    env_file: .env.monitoramento
    expose: ["3000"]
  financeiro-web:
    image: ${ECR}/financeiro:${TAG}
    env_file: .env.financeiro
    expose: ["3000"]
  worker:
    image: ${ECR}/worker:${TAG}
    env_file: .env.monitoramento
volumes: { caddy_data: {} }
```

```
app-monitoramento.dominio.com { reverse_proxy monitoramento-web:3000 }
app-financeiro.dominio.com    { reverse_proxy financeiro-web:3000 }
```

### 7.3 CloudFront cache split (a pegadinha que vira bug de segurança)

| Caminho | Cache | Repassar |
|---|---|---|
| `/_next/static/*` | Forte (imutável, hash no nome) | sem cookies |
| `/` e demais (páginas, Server Actions, Route Handlers) | **Desabilitado** | **Cookie, Authorization, Host** |

Nunca cachear resposta com `Set-Cookie` nem HTML por-usuário. **Alternativa válida** p/ app 100% interno: Route 53 → Caddy (TLS direto), **sem CloudFront** — elimina o risco de cache dinâmico. Recomendo essa simplificação na Fase 1 (adotar CloudFront só se precisar de CDN/WAF depois).

### 7.4 Segredos (SSM) — env alvo

```
DATABASE_URL=postgres://…@<rds-privado>:5432/postgres
AWS_REGION=us-east-1
S3_BUCKET=empresa-logistica-arquivos
COGNITO_USER_POOL_ID=…
COGNITO_CLIENT_ID=…
COGNITO_ISSUER=https://cognito-idp.<region>.amazonaws.com/<poolId>
PG_POOL_MAX=8
NODE_ENV=production
```

Injetados no deploy a partir do SSM. **Nenhum `.env` no Git** (já garantido pelo `.gitignore`).

---

## 8. FASE 5 — Build, deploy e CI

- **Dockerfile por app**: `next build` (com `output: "standalone"` no `next.config.ts` p/ imagem enxuta) → runtime `next start`. Worker = imagem Node simples.
- **CI (GitHub Actions)**: build → push p/ ECR → SSH/SSM na EC2 → `migrate.sh` (migrations antes) → `docker compose pull && up -d`.
- **Rollback**: manter tag anterior no ECR; `up -d` com TAG antiga.
- **Janela**: não deployar durante fechamento de folha (financeiro) — `up -d` reinicia containers.
- Habilitar `next.config.ts` → `output: "standalone"` e revisar `allowedDevOrigins`/`serverActions.bodySizeLimit` (30mb hoje — manter, é o upload Shopee).

---

## 8.5 Dev local — espelho da AWS (rodar tudo na máquina)

> Objetivo: rodar **o ambiente inteiro localmente** — banco, arquivos e auth equivalentes ao que roda na AWS — para testar como fica em produção **e** continuar desenvolvendo normalmente. Nada de depender do RDS/Cognito/S3 reais no dia a dia.

### 8.5.1 Princípio: as `packages/` são a fronteira

Cada serviço AWS tem um equivalente local rodando em Docker, falando o **mesmo protocolo**. O código não sabe se está local ou na AWS — só muda o `.env`.

| Serviço AWS (prod) | Equivalente local (dev) | Mesmo protocolo? |
|---|---|---|
| RDS PostgreSQL | **Postgres em container** | ✅ idêntico (é Postgres) |
| S3 | **MinIO** (container S3-compatível) | ✅ API S3, mesmo SDK `@aws-sdk/client-s3` |
| Cognito User Pool | **cognito-local** (container) ou mock atrás de flag | ⚠️ compatível o bastante p/ dev |
| SSM Parameter Store | `.env.local` (arquivo) | — (só a fonte do segredo muda) |
| CloudWatch | logs no terminal | — |

Como o `@aws-sdk/client-s3` e o `pg` são os **mesmos binários** local e prod, o teste local exercita o **código real** — só o endpoint muda (`AWS_ENDPOINT_URL` aponta pro MinIO; `DATABASE_URL` pro Postgres do container).

### 8.5.2 `infra/docker-compose.dev.yml`

```yaml
# Sobe o "clone da AWS" na máquina: Postgres (RDS), MinIO (S3), cognito-local (Cognito).
services:
  db:
    image: postgres:16                    # casar com a versão do RDS
    environment:
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: painel
    ports: ["5432:5432"]
    volumes: ["db_data:/var/lib/postgresql/data"]

  minio:                                  # S3 local
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: dev
      MINIO_ROOT_PASSWORD: devsecret
    ports: ["9000:9000", "9001:9001"]     # 9000 = API S3, 9001 = console web
    volumes: ["minio_data:/data"]

  createbucket:                           # cria o bucket no boot (one-shot)
    image: minio/mc
    depends_on: [minio]
    entrypoint: >
      /bin/sh -c "
      until mc alias set local http://minio:9000 dev devsecret; do sleep 1; done;
      mc mb -p local/painel-arquivos;
      mc anonymous set none local/painel-arquivos;
      exit 0;"

  cognito:                                # Cognito local (emulador OSS)
    image: jagregory/cognito-local
    ports: ["9229:9229"]
    volumes: ["./.cognito:/app/.cognito-local"]

  worker:                                 # opcional: rodar o worker em container tb
    build: { context: .., dockerfile: apps/worker/Dockerfile }
    env_file: ../.env.local
    depends_on: [db, minio]

volumes: { db_data: {}, minio_data: {} }
```

Os apps Next (`monitoramento`/`financeiro`) rodam **fora** do compose, com `npm run dev` (hot reload). Só a infra (db/minio/cognito/worker) sobe em container. Quem quiser testar a **imagem de produção** localmente usa o `docker-compose.yml` normal apontando pros mesmos containers de infra.

### 8.5.3 `.env.local` (dev) × prod

O mesmo conjunto de chaves, valores locais:

```bash
# --- Banco: Postgres do container (não RDS) ---
DATABASE_URL=postgres://postgres:dev@localhost:5432/painel
PG_SSL=off                                # container local não usa TLS
PG_POOL_MAX=8

# --- S3 → MinIO ---
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://localhost:9000    # <- aponta o SDK S3 pro MinIO
AWS_ACCESS_KEY_ID=dev
AWS_SECRET_ACCESS_KEY=devsecret
S3_BUCKET=painel-arquivos
S3_FORCE_PATH_STYLE=true                  # MinIO exige path-style

# --- Cognito → cognito-local ---
AUTH_MODE=cognito-local                   # cognito-local | cognito | mock
COGNITO_ENDPOINT=http://localhost:9229
COGNITO_USER_POOL_ID=local_xxxxx
COGNITO_CLIENT_ID=local_client
COGNITO_ISSUER=http://localhost:9229/local_xxxxx

NODE_ENV=development
```

Em prod, o mesmo `.env` vem do SSM com: sem `AWS_ENDPOINT_URL` (S3 real), `PG_SSL=on`, `AUTH_MODE=cognito`, endpoints reais. **O código lê as mesmas variáveis** — só o provedor por trás muda.

### 8.5.4 `packages/storage` — endpoint configurável

Escrever o client S3 já pronto pra apontar em MinIO ou S3 real:

```ts
import { S3Client } from "@aws-sdk/client-s3"

export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL,        // definido só em dev (MinIO); undefined em prod = S3 real
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
})
```

Presigned URLs funcionam igual no MinIO — o browser sobe direto pro `localhost:9000`, exatamente como subiria pro S3.

### 8.5.5 `packages/auth` — três modos

```ts
// AUTH_MODE controla o provedor de identidade, sem tocar no resto do app.
//   cognito        → Cognito real (prod)
//   cognito-local  → emulador em container (dev fiel)
//   mock           → injeta um usuário fixo, sem login (dev rápido de telas)
```

- **`cognito-local`**: fluxo real de login/signup/grupos contra o container. Testa o caminho de produção offline.
- **`mock`**: `getSessionProfile()` devolve um perfil fixo (lido de `DEV_USER_EMAIL`), pula o login. Bom pra iterar UI sem autenticar. **Nunca** habilitar fora de `NODE_ENV=development` (guardar com checagem explícita).

### 8.5.6 Fluxo de trabalho local

```bash
# 1. sobe o clone da AWS (uma vez, fica rodando)
docker compose -f infra/docker-compose.dev.yml up -d

# 2. aplica migrations no Postgres do container (mesmo comando de prod)
npm run migrate            # -> infra/scripts/migrate.sh, DATABASE_URL local

# 3. (uma vez) cria o User Pool no cognito-local + usuário de teste
npm run seed:auth          # script que chama AdminCreateUser no endpoint local

# 4. roda o app com hot reload
npm run dev -w apps/monitoramento
# e/ou
npm run dev -w apps/financeiro

# opcional: testar a IMAGEM de produção localmente (sem hot reload)
docker compose up --build  # usa os mesmos db/minio/cognito de infra
```

Console do MinIO em `localhost:9001` (ver/baixar as planilhas subidas). Dados persistem em volumes Docker — `docker compose down -v` zera tudo pra um teste limpo.

### 8.5.7 Paridade dev↔prod (o que confere e o que não)

| Aspecto | Fidelidade local |
|---|---|
| SQL / schema / migrations | **Idêntico** (mesmo Postgres) |
| Upload presigned + worker + parse | **Idêntico** (MinIO fala S3) |
| RBAC / permissões (`packages/auth`) | **Idêntico** (lógica é nossa) |
| Login/grupos Cognito | **Alta** com cognito-local; detalhes de token podem divergir |
| KMS / criptografia repouso | **Não** reproduzido local (é transparente à app — ok) |
| Rede privada / SG / IAM | **Não** local (é infra; validar em staging AWS) |
| CloudFront cache | **Não** local (rodar Next direto) |

**Regra:** o que é **código** (SQL, S3, auth, worker) roda idêntico local. O que é **infra AWS** (KMS, VPC, IAM, CloudFront) só se valida num ambiente **staging** na AWS antes de produção — recomendo uma `stack` Terraform `staging` separada (§7) pra isso.

---

## 9. Dashboard Financeiro (nasce AWS-native)

Como ainda não existe, **construir já em cima de `packages/` (auth/db/storage)** — não repetir o acoplamento a Supabase.

- `apps/financeiro` — Next full-stack próprio, imagem/deploy independentes.
- Schema `financeiro` no RDS: `financial_records`, `payroll_batches`, `payroll_items`, `payroll_calculations` (**versionado — nunca UPDATE destrutivo**, `is_current` + `calc_version`), `payment_exports`.
- **Régua de segurança maior (AD-10):** `audit_logs` (quem/o quê/quando) **e** versionamento de cálculo (quais eram os números no fechamento). Ambos obrigatórios.
- Recálculo em **transação** (`tx()` do `packages/db`): marca versões anteriores `is_current=false` e insere a nova atomicamente.
- Grupo Cognito `financeiro` sem acesso ao monitoramento por padrão; validação **no servidor**.
- Exports/comprovantes → S3 (SSE-KMS) com `hash` no banco.
- **Nunca logar** CPF/CNPJ/salário (política de logs §9.4 do doc).

---

## 10. Ordem de execução e checklist

### 10.1 Sequência recomendada (dependências reais)

```
Fase 0  Desacoplar código (pool singleton, tirar supabase-js de queries, isolar sessão)
          → roda ainda no Supabase, mergeável hoje, baixo risco
Fase 2a Provisionar RDS (KMS!) + framework de migrations + baseline
Fase 2b Migrar dados Supabase → RDS, apontar DATABASE_URL, validar
          → app agora usa RDS pra dados, Supabase só p/ Auth
Fase 1  Trocar Auth → Cognito (com sessão já isolada da Fase 0)
          → Supabase totalmente fora
Fase 3  S3 + presigned + worker (tira parse do web)
Fase 4  IaC completa (EC2/Docker/Caddy/CloudFront/SSM/IAM) + deploy do monitoramento
Fase 5  CI/CD + rollback
Fase 9  Construir financeiro sobre a base pronta
```

> Sacada: fazer **RDS antes de Cognito** permite validar o banco isoladamente (só muda `DATABASE_URL`), e Cognito depois com a camada de sessão já abstraída. Reduz risco de mexer em duas coisas ao mesmo tempo.

### 10.2 Checklist de handoff (Fase 1 AWS) — do doc, com status real

| # | Item | Status hoje |
|---|---|---|
| 1 | Pool de conexões **singleton** por processo | ❌ abre Client por chamada → **Fase 0** |
| 2 | RDS privado + backup + **KMS na criação** | ❌ é Supabase → **Fase 2** |
| 3 | S3 privado (Block Public Access) + presigned | ❌ não há S3 → **Fase 3** |
| 4 | Audit log + versionamento no financeiro | ❌ financeiro não existe → **Fase 9** |
| 5 | Controle por grupos Cognito, validado no servidor | ⚠️ RBAC existe (`permissions.ts`), falta Cognito → **Fase 1** |
| 6 | Limites/status de upload (tamanho, timeout, falha) | ⚠️ parcial (log existe, falta status/worker) → **Fase 3** |
| 7 | Política de logs (não logar CPF/salário) | ⚠️ revisar ao construir financeiro → **Fase 9** |
| 8 | Snapshot mensal + runbook EC2 stateless | ❌ → **Fase 4** |
| 9 | CloudFront cache split (ou Caddy direto) | ❌ → **Fase 4** |

### 10.3 Extras de revisão

| Pergunta | Hoje |
|---|---|
| Apps separados em código e deploy? | ❌ monolito único → monorepo (§2) |
| `next start` sem `output: 'export'`? | ✅ |
| Sessão em cookie/JWT, não em memória? | ✅ (Supabase cookie; Cognito idem) |
| Ações sensíveis validam JWT + permissão? | ✅ `requirePerm`/`requireOperacaoAccess` |
| RDS privado só via EC2? | ❌ → Fase 2 |
| Upload direto ao S3 via presigned? | ❌ → Fase 3 |
| Worker fora do processo web? | ❌ → Fase 3 |
| `.env` fora do Git, valores no SSM? | ⚠️ fora do Git ✅, SSM → Fase 4 |
| Backup + restauração testada? | ❌ → Fase 2 |
| Rollback (imagem anterior)? | ❌ → Fase 5 |

---

## 11. Riscos específicos deste código (além dos do doc)

| Risco | Onde | Mitigação |
|---|---|---|
| `supabase-js .from()` quebra no RDS (sem PostREST) | `queries.ts`, `auth.ts` | Converter tudo p/ `pg` na **Fase 0**, antes de migrar banco |
| `withPgClient` (Client por request) esgota conexões no RDS | 8 arquivos | Pool singleton **Fase 0** |
| RLS do Supabase (`02_rls.sql`, `auth.uid()`) não existe no RDS | `sql/02_rls.sql` | Segurança já é no servidor (service_role); descartar RLS, confiar em `requirePerm` |
| Migração de senhas Supabase→Cognito | base de usuários | Reset em massa + troca no 1º login (§4.4) |
| Esquecer KMS na criação do RDS | infra | Checklist bloqueante — retrofit exige migração |
| Parse de planilha grande trava o web | `uploads/actions.ts` | Mover pro worker + limite 10MB/timeout (**Fase 3**) |
| `app_user.id` (UUID Supabase) referenciado em FKs | schema | Adicionar `cognito_sub` sem quebrar FKs; `id` continua PK interna |

---

## 12. Resumo de esforço (ordem de grandeza)

| Fase | Esforço | Risco |
|---|---|---|
| 0 — Desacoplar | Médio (mecânico, testável hoje) | Baixo |
| 2 — RDS + migração dados | Médio | Médio (KMS, dump/restore) |
| 1 — Cognito | **Alto** (reescreve auth) | **Alto** |
| 3 — S3 + worker | Médio-alto | Médio |
| 4 — IaC | Médio | Médio |
| 5 — CI/CD | Baixo-médio | Baixo |
| 9 — Financeiro | Alto (feature nova) | Médio |

**Caminho crítico:** Fase 0 → 2 → 1. Depois 3/4/5 podem paralelizar. Financeiro só depois da base (packages/) pronta.

---

> **Próximo passo sugerido:** começar a **Fase 0** já — é mergeável no estado atual (roda no Supabase), reduz o risco de todas as fases seguintes e não exige nenhuma conta AWS ainda. Quando a Fase 0 estiver verde, provisionar RDS.

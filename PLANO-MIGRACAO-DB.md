# Plano de Migração — Banco de Dados Único + Front/Back Separados (v2 enxuta)

> Versão 2 — após revisão de overengineering
> Decisões fechadas em 2026-05-23
> Documento de planejamento (sem mudanças de código nesta etapa)

---

## Sumário das mudanças vs v1

Cortes feitos para reduzir complexidade ao escopo real (≤10 usuários, 5 bases, snapshots esparsos):

| Cortado | Motivo |
|---|---|
| Tabela `Session` | Supabase Auth gerencia sessão/refresh |
| Tabela `AppSetting` | Configs pequenas e fixas — código basta |
| Tabela `BaseAlias` | 13 aliases, viram Map em `packages/shared` |
| Tabela `PackageStatus` | 16 status fixos, viram enum + função |
| Campo `passwordHash` | Auth fica no Supabase, sem migração de senha |

Schema final: **~10 tabelas** (vs 17 da v1).

---

## 1. Decisões arquiteturais (fechadas)

| Decisão | Escolha |
|---|---|
| Backend framework | **Fastify** + TypeScript |
| ORM | **Prisma** |
| Frontend | **Vite + JS modular** (sem framework UI) |
| Validação | **Zod** (compartilhado front/back) |
| Auth | **Supabase Auth** (mantida) — backend valida JWT com `SUPABASE_JWT_SECRET` |
| DB | **Supabase Postgres** (já existente) |
| Upload de arquivos | parsing **server-side**, persiste só dados essenciais (não o blob) |
| Estrutura | **monorepo** com pnpm workspaces |
| Assets | arquivos estáticos no front (não DB) |

### Hospedagem da API — a confirmar entre 2 opções

**Opção A — Supabase Edge Functions (recomendada para simplicidade)**
- Tudo no Supabase: DB + Auth + API.
- Deno runtime; Prisma roda com `@prisma/adapter-pg` (suporte oficial).
- Grátis no plano atual.
- Sem servidor para gerenciar.
- Trade-off: limitado a 50MB de bundle e ~150s por execução (mais que suficiente aqui).

**Opção B — Railway**
- Node.js tradicional, deploy via git push.
- ~5 USD/mês de crédito grátis cobre o projeto.
- Trade-off: serviço extra para gerenciar, latência DB→API um pouco maior.

> **Recomendação**: começar com **Edge Functions**. Se descobrirmos limites depois, migrar para Railway é mecânico (mesmo Fastify, mesmo Prisma).

### Política de retenção (definida pelo Luiz)

| Tabela | Retenção | Regra extra |
|---|---|---|
| `SlaDsRecord` | indeterminado | nunca apaga |
| `Snapshot` | 180 dias | **apenas o último do dia** por base é mantido (snapshots intermediários são sobrescritos) |
| `Package` | 180 dias | só armazena quando status ∈ {Entregue, Devolução, Interceptado, Devolução em LH} (finalizadores) |
| `SnapshotDriver` | 180 dias | cascade com Snapshot |
| `Driver` | indeterminado | inclui nome, documento, telefone |
| `Liberacao` | indeterminado | nunca apaga |
| `CepCache` | indeterminado | cresce devagar |

Job de purga: cron diário 03:00 BRT.

---

## 2. Schema Prisma (versão enxuta)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// Identidade — espelha Supabase Auth, não armazena senhas
// ============================================================

model User {
  id           String   @id                     // == auth.users.id do Supabase
  email        String   @unique
  empresa      String?
  role         Role     @default(SUPERVISOR)
  operacaoId   String?
  baseId       String?
  isAdmin      Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  lastLoginAt  DateTime?

  operacao     Operacao? @relation(fields: [operacaoId], references: [id])
  base         Base?     @relation(fields: [baseId],     references: [id])

  uploads      Upload[]
  liberacoes   Liberacao[]
  snapshots    Snapshot[]
  slaDsRecords SlaDsRecord[]

  @@index([operacaoId])
  @@index([baseId])
}

enum Role {
  MONITORAMENTO
  SUPERVISOR
  SUPERVISOR_FINANCEIRO
  COORDENADOR
  ADMIN
}

// ============================================================
// Domínio: operação e base
// ============================================================

model Operacao {
  id        String   @id @default(uuid())
  slug      String   @unique                     // 'shopee', 'meli', ...
  label     String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  bases     Base[]
  users     User[]
}

model Base {
  id           String   @id @default(uuid())
  operacaoId   String
  slug         String                              // 'xpt-adr-02'
  label        String
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  operacao     Operacao @relation(fields: [operacaoId], references: [id])
  users        User[]
  snapshots    Snapshot[]
  slaDsRecords SlaDsRecord[]
  uploads      Upload[]
  liberacoes   Liberacao[]
  drivers      Driver[]
  packages     Package[]

  @@unique([operacaoId, slug])
}

// ============================================================
// Motoristas — entidade persistente
// ============================================================

model Driver {
  id            String   @id @default(uuid())
  baseId        String
  name          String
  normalizedKey String                              // lowercase + trim para match
  documento     String?                             // CPF ou outro
  telefone      String?
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  base          Base    @relation(fields: [baseId], references: [id])

  packages         Package[]
  snapshotDrivers  SnapshotDriver[]

  @@unique([baseId, normalizedKey])
  @@index([baseId])
}

// ============================================================
// Upload — registro de cada arquivo recebido
// (não guarda o blob; guarda só métricas e referência)
// ============================================================

model Upload {
  id           String       @id @default(uuid())
  userId       String
  baseId       String
  kind         UploadKind
  filename     String
  sizeBytes    Int
  rowsParsed   Int          @default(0)
  rowsKept     Int          @default(0)            // após filtro (ex: só finalizadores)
  rowsRejected Int          @default(0)
  errorLog     String?                              // JSON com problemas
  createdAt    DateTime     @default(now())

  user         User         @relation(fields: [userId], references: [id])
  base         Base         @relation(fields: [baseId], references: [id])

  packages       Package[]
  slaDsRecords   SlaDsRecord[]
  snapshotsAsCsv  Snapshot[] @relation("SnapshotCsvUpload")
  snapshotsAsXlsx Snapshot[] @relation("SnapshotXlsxUpload")

  @@index([baseId, kind, createdAt])
}

enum UploadKind {
  CSV_SLA
  XLSX_DS
  XLSX_SLA_DS_HISTORY
}

// ============================================================
// Package (PNR) — só com status finalizador
// Campos essenciais: pedido, base, motorista, status, ts
// ============================================================

model Package {
  id          String        @id @default(uuid())
  uploadId    String
  baseId      String
  driverId    String?
  codigo      String                              // PNR / código de rastreio
  status      PackageStatus
  finalizadoAt DateTime?                          // quando virou estado final
  importedAt  DateTime      @default(now())

  upload      Upload @relation(fields: [uploadId], references: [id], onDelete: Cascade)
  base        Base   @relation(fields: [baseId],   references: [id])
  driver      Driver? @relation(fields: [driverId], references: [id])

  @@unique([baseId, codigo])
  @@index([baseId, importedAt])
  @@index([driverId])
}

// Enum hardcoded — substitui tabela PackageStatus da v1
enum PackageStatus {
  ENTREGUE
  DEVOLUCAO
  INTERCEPTADO
  DEVOLUCAO_LH
}

// ============================================================
// Snapshot — 1 por (base, dia). UPSERT no insert.
// ============================================================

model Snapshot {
  id            String   @id @default(uuid())
  baseId        String
  userId        String?
  ts            DateTime
  dataPtBr      String                            // '22/05/2026'
  hora          String                            // '14:32' (do último snap do dia)
  slaPct        Decimal  @db.Decimal(5, 2)
  dsPct         Decimal  @db.Decimal(5, 2)
  total         Int
  entregues     Int
  emRota        Int
  ocorrencias   Int
  faltantes     Int
  devolvidos    Int
  outros        Int      @default(0)
  uploadCsvId   String?
  uploadXlsxId  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  base          Base     @relation(fields: [baseId], references: [id])
  user          User?    @relation(fields: [userId], references: [id])
  uploadCsv     Upload?  @relation("SnapshotCsvUpload",  fields: [uploadCsvId],  references: [id])
  uploadXlsx    Upload?  @relation("SnapshotXlsxUpload", fields: [uploadXlsxId], references: [id])

  drivers       SnapshotDriver[]

  // Garantia: 1 snapshot por base por dia
  @@unique([baseId, dataPtBr])
  @@index([baseId, ts])
}

model SnapshotDriver {
  id          String  @id @default(uuid())
  snapshotId  String
  driverId    String?
  driverName  String                              // congelado p/ histórico
  saiu        Int
  entregues   Int
  emRota      Int
  ocorrencias Int

  snapshot    Snapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  driver      Driver?  @relation(fields: [driverId],   references: [id])

  @@index([snapshotId])
}

// ============================================================
// Histórico SLA/DS — inserção manual ou XLSX em massa
// Retenção: indeterminada. UPSERT por (base, dataPtBr).
// ============================================================

model SlaDsRecord {
  id        String   @id @default(uuid())
  baseId    String
  uploadId  String?
  userId    String?
  ts        DateTime
  dataPtBr  String
  slaPct    Decimal? @db.Decimal(5, 2)
  slaRec    Int?
  slaEnt    Int?
  dsPct     Decimal? @db.Decimal(5, 2)
  dsRec     Int?
  dsEnt     Int?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  base      Base    @relation(fields: [baseId],   references: [id])
  upload    Upload? @relation(fields: [uploadId], references: [id])
  user      User?   @relation(fields: [userId],   references: [id])

  @@unique([baseId, dataPtBr])
  @@index([baseId, ts])
}

// ============================================================
// Liberação de pagamento
// ============================================================

model Liberacao {
  id          String   @id @default(uuid())
  userId      String
  baseId      String
  status      LiberacaoStatus
  observacao  String?
  createdAt   DateTime @default(now())

  user        User @relation(fields: [userId], references: [id])
  base        Base @relation(fields: [baseId], references: [id])

  @@index([baseId, createdAt])
}

enum LiberacaoStatus {
  OK
  NOK
}

// ============================================================
// Cache de CEP
// ============================================================

model CepCache {
  cep       String   @id                          // 8 dígitos sem máscara
  cidade    String
  bairro    String
  uf        String?
  fetchedAt DateTime @default(now())
}
```

### Constantes que ficam em código (não no DB)

Arquivo: `packages/shared/src/constants.ts`

```ts
export const BASE_ALIASES = new Map<string, string>([
  ['xpt_es_linhares',           'xpt-lrs-01'],
  ['xpt_es_colatina',           'xpt-ctn-01'],
  ['xpt_es_nova venécia',       'xpt-nvc-01'],
  ['xpt_es_nova venecia',       'xpt-nvc-01'],
  ['xpt_es_são mateus',         'xpt-smt-01'],
  ['xpt_es_sao mateus',         'xpt-smt-01'],
  ['xpt_rj_angra dos reis',     'xpt-adr-02'],
  ['xpt_rj_angra dos reis_02',  'xpt-adr-02'],
  ['xpt_rj_saquarema',          'xpt-sqr-01'],
]);

// Mapeia status bruto da Shopee → categoria interna
export const STATUS_MAP: Record<string, PackageCategory> = {
  'Delivered':                       'ENTREGUE',
  'Hub_Received':                    'RECEBIDO',
  'OnHold':                          'OCORRENCIA',
  'Delivering':                      'EM_ROTA',
  'Return_LMHub_LHTransporting':     'DEVOLUCAO_LH',
  'Return_Hub_Received':             'INTERCEPTADO',
  'Return_Hub_Packing':              'DEVOLUCAO',
  // ... faltantes (vide constants.js atual)
};

export const STATUS_FINALIZADORES = new Set(['ENTREGUE', 'DEVOLUCAO', 'INTERCEPTADO', 'DEVOLUCAO_LH']);

export const ROLE_PAGES: Record<Role, readonly string[] | null> = {
  MONITORAMENTO:         ['sup-hoje'],
  SUPERVISOR:            ['sup-home','sup-hoje','sup-historico','sup-motoristas','sup-liberacao','sup-problema'],
  SUPERVISOR_FINANCEIRO: ['sup-home','sup-historico','sup-liberacao'],
  COORDENADOR:           null,
  ADMIN:                 null,
};
```

---

## 3. Mapeamento "de onde vem → para onde vai" (final)

| Origem atual | Destino |
|---|---|
| `operacoes/<op>/<base>/logs.json` | `Snapshot` + `SnapshotDriver` (último do dia; 180d) |
| `operacoes/shopee/sla-ds-history.json` | `SlaDsRecord` (indeterminado) |
| `data/manifest.json` / `__manifest__` | Tabela `Base` |
| `localStorage['__data__*']` | **eliminado** |
| `localStorage['cep_cache']` | `CepCache` |
| Arquivo CSV (RAM `csvData`) | `Upload` + `Package` (só finalizadores; 180d) |
| Arquivo XLSX motoristas (RAM `xlsxData`) | `Upload` + `SnapshotDriver` no momento do snapshot |
| Arquivo XLSX SLA/DS em massa | `Upload` + `SlaDsRecord` |
| Supabase `auth.users` | **continua no Supabase** (não migra) |
| Supabase `profiles` | `User` (espelho com `id` igual ao `auth.users.id`) |
| Supabase `liberacoes` | `Liberacao` (migração SELECT→INSERT) |
| `constants.js: BASE_ALIAS` / `STATUS_MAP` / `ROLE_PAGES` | `packages/shared/constants.ts` |
| Logos | `apps/web/public/assets/` |

> **Decisão sobre DsRow**: a versão enxuta elimina a tabela `DsRow` da v1. Os dados que importam (saiu/entregues/emRota/ocorrências por motorista) são persistidos diretamente em `SnapshotDriver` quando o snapshot é tirado. Se o XLSX for importado mas o snapshot não for disparado, esses dados não persistem — o que já é o comportamento atual.

---

## 4. Estrutura do projeto (final)

```
painel-entregas/
├── apps/
│   ├── api/                              ← BACKEND
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts                   ← Operacao + Base inicial
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── server.ts                 ← Fastify bootstrap
│   │   │   ├── config/
│   │   │   │   ├── env.ts                ← Zod parser
│   │   │   │   └── prisma.ts
│   │   │   ├── middlewares/
│   │   │   │   ├── auth.ts               ← valida JWT do Supabase
│   │   │   │   └── error-handler.ts
│   │   │   ├── modules/
│   │   │   │   ├── users/
│   │   │   │   ├── operacoes/
│   │   │   │   ├── bases/
│   │   │   │   ├── uploads/
│   │   │   │   │   ├── routes.ts
│   │   │   │   │   ├── parsers/
│   │   │   │   │   │   ├── csv-sla.ts
│   │   │   │   │   │   ├── xlsx-ds.ts
│   │   │   │   │   │   └── xlsx-sla-ds.ts
│   │   │   │   │   └── service.ts
│   │   │   │   ├── snapshots/
│   │   │   │   ├── sla-ds/
│   │   │   │   ├── liberacoes/
│   │   │   │   └── ceps/
│   │   │   ├── jobs/
│   │   │   │   └── retention.ts          ← purga >180d
│   │   │   └── lib/
│   │   │       ├── calc.ts               ← calcSLA, calcDS
│   │   │       └── aliases.ts            ← resolveBase server-side
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                              ← FRONTEND
│       ├── public/
│       │   └── assets/
│       │       ├── logo.png
│       │       └── operacoes/
│       │           ├── shopee.png
│       │           ├── meli.png
│       │           └── ...
│       ├── src/
│       │   ├── main.ts
│       │   ├── index.html
│       │   ├── styles/main.css
│       │   ├── lib/
│       │   │   ├── api-client.ts         ← fetch tipado
│       │   │   ├── supabase.ts           ← cliente Supabase só para login
│       │   │   └── format.ts
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── monitoramento/
│       │   │   │   ├── hoje.page.ts
│       │   │   │   ├── base-panel.ts
│       │   │   │   └── imports.ts
│       │   │   ├── historico/
│       │   │   ├── motoristas/
│       │   │   ├── sla-ds/
│       │   │   ├── liberacao/
│       │   │   └── admin/
│       │   └── router/nav.ts
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── schemas/                   ← Zod
│       │   ├── types/
│       │   └── constants.ts               ← BASE_ALIASES, STATUS_MAP, ROLE_PAGES
│       └── package.json
│
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── README.md
```

---

## 5. Endpoints da API (final)

Base URL: `/api/v1` — JWT do Supabase no header `Authorization: Bearer <token>`.

| Método | Path | Notas |
|---|---|---|
| **Users (admin)** |||
| GET | `/users` | lista |
| POST | `/users` | cria via Supabase Admin API + linha em `User` |
| PATCH | `/users/:id` | edita role/base |
| **Operações / Bases** |||
| GET | `/operacoes` | substitui ALL_OPS hardcoded |
| GET | `/operacoes/:slug/bases` | substitui Storage.listDir |
| POST | `/operacoes/:slug/bases` | substitui promptNewBase |
| **Uploads** |||
| POST | `/bases/:id/uploads?kind=CSV_SLA` | multipart |
| POST | `/bases/:id/uploads?kind=XLSX_DS` | multipart |
| POST | `/bases/:id/uploads?kind=XLSX_SLA_DS_HISTORY` | multipart |
| GET | `/bases/:id/uploads?kind=...` | lista uploads |
| **Snapshots** |||
| POST | `/bases/:id/snapshots` | UPSERT por (baseId, dataPtBr); usa últimos uploads |
| GET | `/bases/:id/snapshots?from=&to=` | lista (timeline) |
| GET | `/bases/:id/snapshots/latest` | último (UI Hoje) |
| **SLA/DS** |||
| GET | `/operacoes/:slug/sla-ds?from=&to=&base=` | com filtros |
| POST | `/operacoes/:slug/sla-ds` | inserção manual |
| **Liberação** |||
| POST | `/liberacoes` | substitui submitLib |
| GET | `/liberacoes` | admin |
| **CEP** |||
| GET | `/cep/:cep` | proxy ViaCEP + cache em `CepCache` |
| **Sistema** |||
| GET | `/health` | |

---

## 6. Plano de fases (final — 10 fases)

| # | Fase | Dias estimados | Critério de saída |
|---|---|---|---|
| 0 | Setup do monorepo (pnpm + Fastify + Vite + Prisma) | 1 | `pnpm dev` sobe api `:3001` e web `:5173` |
| 1 | Schema Prisma + migration + seed (Operacao, Base existentes) | 1 | Prisma Studio abre, dados visíveis |
| 2 | Backend: middleware de JWT Supabase + users/operacoes/bases + ceps proxy | 3 | Postman: login real → bater endpoint protegido |
| 3 | Backend: uploads (3 parsers) + Package + SnapshotDriver + SlaDsRecord (com filtro de finalizadores e UPSERT) | 3 | Subir CSV/XLSX no Postman cria linhas certas |
| 4 | Backend: snapshots + sla-ds + liberacoes + retention job | 2 | Snapshot com UPSERT por dia funciona |
| 5 | Frontend: shell, auth, roteamento, login contra Supabase | 2 | Logo, navego entre páginas |
| 6 | Frontend: monitoramento (Hoje + Base Panel) + uploads + snapshot | 3 | Fluxo end-to-end funciona |
| 7 | Frontend: SLA/DS, Histórico, Motoristas, Liberação | 3 | Todas as páginas atuais funcionando contra API |
| 8 | Frontend: Admin (Users, Bases) | 1 | CRUD de usuários funciona |
| 9 | Migração de dados existentes + assets locais + descomissionar GH_TOKEN | 2 | App rodando 100% no novo, sem `GH_TOKEN` no client |

**Estimativa total: ~21 dias úteis** (1 dev em tempo integral).

---

## 7. Migração de dados existentes

Script único `scripts/migrate-legacy.ts` (executar via `pnpm migrate:legacy`):

1. Lê todos os `operacoes/<op>/<base>/logs.json` via API do GitHub (uma vez).
2. Para cada base: identifica o **último snapshot de cada dia** dos últimos 180 dias → INSERT em `Snapshot` + `SnapshotDriver`.
3. Lê `operacoes/shopee/sla-ds-history.json` → INSERT em `SlaDsRecord` (todos, sem filtro de data).
4. Lê Supabase `profiles` → INSERT em `User` (com `id` igual ao `auth.users.id`).
5. Lê Supabase `liberacoes` → INSERT em `Liberacao`.
6. Imprime relatório: contagens antes/depois.

Cutover:
1. Modo paralelo (1 semana) — API nova em domínio separado, dados de teste.
2. Janela de manutenção (1–2h) — banner no front antigo.
3. Roda `migrate-legacy.ts` em produção.
4. Troca URL do front pro novo build.
5. Mantém o repo antigo congelado por 30 dias para emergência.

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Edge Functions com limite de cold start | Health check periódico via cron externo se necessário |
| Filtro de finalizadores em Package pode excluir dado útil | Validar com 1 import real antes de migrar. Ajustar `STATUS_FINALIZADORES` se necessário |
| Snapshot UPSERT pode mascarar evolução do dia | Manter `Snapshot.updatedAt` para auditar; se houver demanda futura, criar `SnapshotHistory` |
| Migração de senhas | **Não há** — Supabase Auth continua. Usuários logam normalmente |
| Retenção apaga PNRs ainda referenciados | `onDelete: Cascade` em `Package` cobre o caso de Upload deletado; `Snapshot` independente |
| `GH_TOKEN` ainda exposto no modo paralelo | Revogar imediatamente após cutover |
| Parser XLSX divergir entre client antigo e server novo | Comparar saída lado a lado em 3+ arquivos reais antes do cutover |

---

## 9. Pontos abertos finais

1. **Hospedagem da API**: Edge Functions (recomendado) ou Railway?
2. **Status finalizadores**: confirmar a lista `{ENTREGUE, DEVOLUCAO, INTERCEPTADO, DEVOLUCAO_LH}` — adicionar/remover algum?
3. **`User.id` igual ao `auth.users.id`**: confirma que mantemos a chave do Supabase como nossa PK?

Após validação, Fase 0 pode iniciar.

---

## Apêndice — O que ficou de fora (consciente)

Estas ideias da v1 foram **conscientemente descartadas** para manter simplicidade. Reintroduzir só se houver necessidade concreta:

- `AppSetting` (configs em DB) → código basta
- `BaseAlias` (tabela) → Map em código
- `PackageStatus` (tabela) → enum em código
- `Session` (sessões próprias) → Supabase gerencia
- `DsRow` (todas as linhas brutas de DS) → só persiste no momento do snapshot
- Cliente HTTP gerado / OpenAPI → tipos manuais via Zod em `packages/shared`
- tRPC → REST simples basta
- NestJS → Fastify direto
- Refresh token próprio → Supabase emite

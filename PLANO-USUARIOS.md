# Plano — Estrutura de Usuários, Acessos e Isolamento

> Decisões fechadas em 2026-05-25.
> Encaixa no [PLANO-MIGRACAO-DB.md](PLANO-MIGRACAO-DB.md). Pressupõe a stack já decidida: Supabase Auth + Postgres, backend Fastify, monorepo pnpm.

---

## 1. Cargos como presets + permissões individuais

5 cargos como **presets** de permissões. Cada usuário pode receber extras ou ter permissões retiradas, sem nova tabela.

### Schema (delta sobre PLANO-MIGRACAO-DB.md §2)

```prisma
model User {
  id           String     @id                     // == auth.users.id Supabase
  email        String     @unique
  empresa      String?
  role         Role       @default(SUPERVISOR)
  operacaoId   String?
  baseScope    BaseScope  @default(SINGLE)
  extraPerms   String[]   @default([])            // permissões adicionadas além do preset
  deniedPerms  String[]   @default([])            // permissões removidas do preset
  isAdmin      Boolean    @default(false)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  lastLoginAt  DateTime?

  operacao     Operacao?  @relation(fields: [operacaoId], references: [id])
  bases        UserBase[]                         // 0..N — substitui o `baseId` único da v2

  uploads      Upload[]
  liberacoes   Liberacao[]
  snapshots    Snapshot[]
  slaDsRecords SlaDsRecord[]

  @@index([operacaoId])
}

model UserBase {
  userId String
  baseId String
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  base   Base @relation(fields: [baseId], references: [id], onDelete: Cascade)
  @@id([userId, baseId])
  @@index([baseId])
}

enum Role {
  MONITORAMENTO
  SUPERVISOR
  SUPERVISOR_FINANCEIRO
  COORDENADOR
  ADMIN
}

enum BaseScope {
  SINGLE        // acessa só as bases em UserBase
  OP_WIDE       // acessa todas as bases da operacaoId
  ALL           // acessa tudo (admin)
}
```

> Mudança vs PLANO-MIGRACAO-DB.md original: o campo `baseId` único no `User` foi substituído por `UserBase` (relação 1:N). Tudo o mais do schema do plano de migração permanece.

### Catálogo de permissões (em código, não DB)

`packages/shared/src/constants.ts`:

```ts
export const PERMS = {
  // upload e dados
  UPLOAD_CSV_SLA:        'upload:csv_sla',
  UPLOAD_XLSX_DS:        'upload:xlsx_ds',
  UPLOAD_XLSX_SLA_DS:    'upload:xlsx_sla_ds',
  SAVE_SNAPSHOT:         'snapshot:save',
  SAVE_SLA_DS_MANUAL:    'sla_ds:save',

  // visualização
  VIEW_HOJE:             'view:hoje',
  VIEW_HISTORICO:        'view:historico',
  VIEW_MOTORISTAS:       'view:motoristas',
  VIEW_SLA_DS:           'view:sla_ds',
  VIEW_LIBERACAO:        'view:liberacao',

  // ação
  SUBMIT_LIBERACAO:      'liberacao:submit',

  // admin
  MANAGE_USERS:          'admin:users',
  MANAGE_BASES:          'admin:bases',
  VIEW_ALL_BASES:        'admin:view_all',
} as const;

export type Permission = typeof PERMS[keyof typeof PERMS];

export const ROLE_PRESETS: Record<Role, Permission[]> = {
  MONITORAMENTO: [
    PERMS.VIEW_HOJE,
    PERMS.UPLOAD_CSV_SLA, PERMS.UPLOAD_XLSX_DS,
    PERMS.SAVE_SNAPSHOT,
  ],
  SUPERVISOR: [
    PERMS.VIEW_HOJE, PERMS.VIEW_HISTORICO, PERMS.VIEW_MOTORISTAS,
    PERMS.VIEW_SLA_DS, PERMS.VIEW_LIBERACAO,
    PERMS.UPLOAD_CSV_SLA, PERMS.UPLOAD_XLSX_DS,
    PERMS.SAVE_SNAPSHOT, PERMS.SUBMIT_LIBERACAO,
  ],
  SUPERVISOR_FINANCEIRO: [
    PERMS.VIEW_HOJE, PERMS.VIEW_HISTORICO, PERMS.VIEW_LIBERACAO,
    PERMS.SUBMIT_LIBERACAO,
  ],
  COORDENADOR: [
    // tudo de SUPERVISOR + visão da operação inteira + SLA/DS manual
    PERMS.VIEW_HOJE, PERMS.VIEW_HISTORICO, PERMS.VIEW_MOTORISTAS,
    PERMS.VIEW_SLA_DS, PERMS.VIEW_LIBERACAO,
    PERMS.UPLOAD_CSV_SLA, PERMS.UPLOAD_XLSX_DS, PERMS.UPLOAD_XLSX_SLA_DS,
    PERMS.SAVE_SNAPSHOT, PERMS.SAVE_SLA_DS_MANUAL,
    PERMS.SUBMIT_LIBERACAO, PERMS.VIEW_ALL_BASES,
  ],
  ADMIN: Object.values(PERMS),
};

export function hasPerm(user: { role: Role; extraPerms: string[]; deniedPerms: string[] }, perm: Permission) {
  if (user.deniedPerms.includes(perm)) return false;
  return ROLE_PRESETS[user.role].includes(perm) || user.extraPerms.includes(perm);
}
```

### Landing page por cargo

```ts
export const LANDING_PAGE: Record<Role, string> = {
  MONITORAMENTO:         'sup-hoje',
  SUPERVISOR:            'sup-home',
  SUPERVISOR_FINANCEIRO: 'sup-home',
  COORDENADOR:           'admin-home',
  ADMIN:                 'admin-home',
};
```

A sidebar do front é construída só com itens em que `hasPerm(user, VIEW_X)` retorna true.

---

## 2. Escopo de acesso (isolamento por base)

O campo `baseScope` define o raio do usuário:

| baseScope | Significado | Cargos típicos |
|---|---|---|
| `SINGLE`  | acessa apenas as bases em `user.bases` | monitoramento, supervisor, sup-financeiro |
| `OP_WIDE` | acessa todas as bases da `user.operacaoId` | coordenador |
| `ALL`     | acessa tudo | admin |

### Filtro server-side (Fastify)

Toda query ganha um `where` derivado do usuário autenticado:

```ts
// apps/api/src/middlewares/scope.ts
export function baseScopeWhere(user: AuthedUser): Prisma.BaseWhereInput {
  if (user.baseScope === 'ALL')     return {};
  if (user.baseScope === 'OP_WIDE') return { operacaoId: user.operacaoId! };
  return { id: { in: user.bases.map(b => b.baseId) } };
}

// uso: prisma.snapshot.findMany({ where: { base: baseScopeWhere(user), ... } })
```

**Regra firme:** nenhum endpoint devolve dado fora do escopo, mesmo se o front pedir explicitamente. O backend rejeita com 403 se o `baseId` solicitado não está no escopo do usuário.

---

## 3. RLS no Postgres (cinto + suspensório)

Liga policies no Supabase Postgres para que, **mesmo se um endpoint esquecer o filtro**, o banco bloqueie.

### Visão geral

- `auth.uid()` no Postgres bate com `User.id` (mesmo valor — é o id do Supabase Auth).
- Cada tabela com `baseId` ganha policy que só libera linhas cuja `base_id` está nas bases do usuário (ou se o usuário é `ALL`/`OP_WIDE` cobrindo).

### Exemplo de policy

```sql
-- Função helper
create or replace function public.user_can_access_base(b_id uuid)
returns boolean language sql stable as $$
  select
    exists(select 1 from "User" u where u.id = auth.uid() and u."isAdmin" = true)
    or exists(
      select 1 from "User" u
      where u.id = auth.uid() and u."baseScope" = 'OP_WIDE'
        and u."operacaoId" = (select b."operacaoId" from "Base" b where b.id = b_id)
    )
    or exists(
      select 1 from "UserBase" ub
      join "User" u on u.id = ub."userId"
      where u.id = auth.uid() and ub."baseId" = b_id and u."baseScope" = 'SINGLE'
    );
$$;

-- Habilitar RLS
alter table "Snapshot"       enable row level security;
alter table "SnapshotDriver" enable row level security;
alter table "Upload"         enable row level security;
alter table "Package"        enable row level security;
alter table "SlaDsRecord"    enable row level security;
alter table "Liberacao"      enable row level security;

-- Policy uniforme (SELECT)
create policy snapshot_read on "Snapshot"
  for select using (public.user_can_access_base("baseId"));
-- mesma policy nas outras tabelas com baseId

-- Writes (INSERT/UPDATE/DELETE) ficam restritas ao backend usando SERVICE_ROLE_KEY,
-- que bypassa RLS por design. Front só faz leitura via PostgREST não-direta —
-- todo write passa pelo backend.
```

### Onde liga

- **SELECT pelo cliente:** se algum dia o front for ler direto via `supabase-js` com o JWT do usuário, RLS protege.
- **Backend Fastify:** usa `SUPABASE_SERVICE_ROLE_KEY` ou conexão Prisma com role admin do Postgres — bypassa RLS, mas continua aplicando `baseScopeWhere`.

### Custo estimado

~30min de policies + 1h de testes (login com 2 usuários de bases diferentes, garantir que A não vê dados de B).

---

## 4. Uploads simultâneos sem interferência

O problema atual é estrutural: todos gravam no mesmo `logs.json` do GitHub e não há atomicidade ([FLUXO-DE-DADOS.md §riscos](FLUXO-DE-DADOS.md#riscos-e-pontos-cegos)). Com o banco isso desaparece.

```
Usuário A (base X) ──► POST /bases/X/uploads ──► INSERT Upload + Package (transação)
Usuário B (base Y) ──► POST /bases/Y/uploads ──► INSERT Upload + Package (transação)
                       (linhas independentes, sem conflito)

Usuário C (base X) ──► POST /bases/X/uploads ──► INSERT Upload + Package (transação)
                       (linhas distintas no Upload, não conflita com A)
```

**Snapshot do mesmo dia/base:** já decidido em PLANO-MIGRACAO-DB.md — `@@unique([baseId, dataPtBr])` + UPSERT. O último a salvar ganha. Sem 409 do GitHub.

---

## 5. Visibilidade compartilhada na mesma base

Sai natural do modelo: dado da base X tem `baseId=X`. Qualquer usuário com X no escopo, ao chamar `GET /bases/X/snapshots/latest` ou `GET /bases/X/uploads`, vê o que o colega acabou de subir.

**Refresh manual basta** pra ≤10 usuários — não introduzir Realtime no V1. Se aparecer pedido concreto de "ao vivo", liga Supabase Realtime na tabela `Upload` filtrada por `baseId` (1 listener no front, sem código novo no backend).

---

## 6. Segurança: token e senhas

| Hoje | Depois |
|---|---|
| `GH_TOKEN` em `config.js`, visível no DevTools | **Eliminado** — não há mais GitHub-as-DB |
| `SUPABASE_KEY` admin embarcada no front pra criar users | Backend chama `auth/v1/admin/users` com `SUPABASE_SERVICE_ROLE_KEY` que vive **só no servidor** |
| Senhas | **Inacessíveis** — Supabase Auth armazena bcrypt server-side; nenhum admin (nem do app, nem do Supabase) lê senha em texto puro. Reset é via email |

### O que sobra no browser depois da migração

- `SUPABASE_URL` — público
- `SUPABASE_ANON_KEY` — público por design (RLS bloqueia o que não deve aparecer)
- JWT do usuário logado — vinculado a ele, expira (~1h, refresh automático pelo SDK Supabase)

### O que **nunca** vai pro browser

- `SUPABASE_SERVICE_ROLE_KEY` (admin do banco)
- `SUPABASE_JWT_SECRET` (pra validar JWT no Fastify)
- `DATABASE_URL` (Prisma)
- Qualquer credencial de fornecedor

Tudo isso fica em `.env` da API (Edge Function secrets ou Railway env vars).

---

## 7. Endpoints novos vs PLANO-MIGRACAO-DB.md

Acréscimos ao §5 do plano de migração:

| Método | Path | Notas |
|---|---|---|
| GET | `/api/v1/me` | substitui `GET /rest/v1/profiles?id=eq.X`. Devolve `{ id, email, role, baseScope, bases[], perms[], landingPage }` |
| PATCH | `/api/v1/users/:id/perms` | admin altera `extraPerms` / `deniedPerms` / `baseScope` |
| PATCH | `/api/v1/users/:id/bases` | admin associa/desassocia bases (UserBase) |
| POST | `/api/v1/users/:id/reset-password` | dispara email de reset via Supabase Admin API |

---

## 8. UI de admin para permissões (Fase 8)

Tela `admin-users-detail` (acessada ao clicar num usuário em `admin-clients`):

```
┌─ Editar usuário ──────────────────────────────────┐
│ Email: ana@empresa.com                            │
│ Cargo (preset):  [ Supervisor      ▼ ]            │
│ Escopo:          [ SINGLE          ▼ ]            │
│                                                   │
│ Bases atribuídas:                                 │
│   ☑ xpt-adr-02   ☑ xpt-sqr-01   ☐ xpt-lrs-01    │
│                                                   │
│ Permissões individuais (sobre o preset):          │
│   ☐ +upload:xlsx_sla_ds  (extra)                  │
│   ☐ −view:liberacao      (denied)                 │
│   ☐ +admin:view_all      (extra)                  │
│   ...                                             │
│                                                   │
│ Permissões efetivas (preview):                    │
│   view:hoje, view:historico, view:motoristas,     │
│   upload:csv_sla, upload:xlsx_ds, snapshot:save,  │
│   liberacao:submit                                │
│                                                   │
│ [ Salvar ]  [ Resetar senha (email) ]             │
└───────────────────────────────────────────────────┘
```

Cada checkbox de permissão tem 3 estados visuais:

- preset traz → cinza marcado (não-editável a não ser via `denied`)
- preset não traz, marcado → `extraPerms`
- preset traz, mas excluído → `deniedPerms`

Implementação: 1 página + 1 endpoint PATCH. Estimativa: **~0,5 dia** adicional na Fase 8 do PLANO-MIGRACAO-DB.md.

---

## 9. Impacto no cronograma

Acréscimos sobre as 10 fases do PLANO-MIGRACAO-DB.md:

| Fase | Adição | Custo |
|---|---|---|
| 1 (schema) | Inclui `UserBase`, `extraPerms`, `deniedPerms`, `baseScope` | 0 (entra junto) |
| 2 (auth + users/operacoes/bases) | Middleware `requireScope` + `requirePerm` + endpoint `/me` | +1 dia |
| 3 (uploads) | Cada upload passa por `requirePerm(UPLOAD_*)` + escopo | 0 (já incluído no design) |
| 8 (admin) | Tela de detalhe do usuário com checkboxes de permissão | +0,5 dia |
| — | Migration SQL com policies RLS + testes manuais | +0,5 dia |

**Total adicional: ~2 dias.** Estimativa final do projeto: **~23 dias úteis**.

---

## 10. Migração de dados (delta sobre §7 do plano de migração)

Acréscimo ao script `migrate-legacy.ts`:

```ts
// Pra cada profile existente:
// 1. Cria User com:
//    - role conforme antigo
//    - baseScope = role === 'coordenador' ? 'OP_WIDE' : 'SINGLE'
//    - extraPerms = []
//    - deniedPerms = []
// 2. Se profiles.base não-nulo: cria UserBase(userId, baseId resolvido pelo slug)
// 3. Admin (ADMIN_EMAIL) recebe isAdmin=true, baseScope='ALL'
```

---

## 11. Pontos abertos finais

1. **`COORDENADOR` precisa ver `liberacoes` de toda a operação?** Hoje só supervisores submetem. Confirmar se coordenador também submete ou só consulta.
2. **Reset de senha self-service:** liberar fluxo "Esqueci minha senha" na tela de login (Supabase suporta nativamente). Recomendo sim.
3. **Email de boas-vindas ao criar usuário:** Supabase já dispara confirmação por padrão; só configurar template em pt-BR.

---

## Apêndice — Por que não tabela de permissões?

Considerado e descartado:

- `Permission(id, code, label)` + `RolePermission(roleId, permissionId)` + `UserPermissionOverride(userId, permissionId, mode)`
- Custo: 3 tabelas novas, 2 joins por check, UI de cadastro de permissão (pra que? lista é fixa).
- Benefício: permitiria criar permissões novas via UI. Realidade: permissões mudam quando a aplicação muda (precisa de código novo de toda forma), então fazer via deploy é mais honesto.

Lista fixa em `constants.ts` + 2 colunas `String[]` no User cobre tudo com 5 linhas de SQL e 1 função pura.

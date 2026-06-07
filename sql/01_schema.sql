-- ============================================================================
-- Painel de Entregas — Schema (Postgres / Supabase)
-- ============================================================================
-- Corresponde aos models SQLModel (rx.Model) descritos em PLANO-MIGRACAO-PYTHON.md.
--
-- Duas formas de criar o schema:
--   (A) Rodar `reflex db migrate` (Alembic gera as tabelas a partir dos models).
--   (B) Colar este arquivo no SQL Editor do Supabase (cria tudo de uma vez).
--
-- Use texto + CHECK no lugar de ENUM nativo para facilitar evolução.
-- Tabela de usuário chamada "app_user" para não colidir com `auth.users`
-- (gerenciada pelo Supabase) nem com a palavra reservada `user`.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Operação e Base
-- ---------------------------------------------------------------------------
create table if not exists operacao (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,                 -- 'shopee', 'meli', ...
  label       text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists base (
  id          uuid primary key default gen_random_uuid(),
  operacao_id uuid not null references operacao(id) on delete cascade,
  slug        text not null,                        -- 'xpt-adr-02'
  label       text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (operacao_id, slug)
);

-- ---------------------------------------------------------------------------
-- Usuário (espelha Supabase Auth — id == auth.users.id; nunca guarda senha)
-- ---------------------------------------------------------------------------
create table if not exists app_user (
  id            text primary key,                   -- == auth.users.id
  email         text not null unique,
  empresa       text,
  role          text not null default 'SUPERVISOR'
                  check (role in ('MONITORAMENTO','SUPERVISOR','SUPERVISOR_FINANCEIRO','COORDENADOR','ADMIN')),
  operacao_id   uuid references operacao(id),
  base_scope    text not null default 'SINGLE'
                  check (base_scope in ('SINGLE','OP_WIDE','ALL')),
  extra_perms   text[] not null default '{}',
  denied_perms  text[] not null default '{}',
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_login_at timestamptz
);
create index if not exists idx_app_user_operacao on app_user(operacao_id);

create table if not exists user_base (
  user_id text not null references app_user(id) on delete cascade,
  base_id uuid not null references base(id) on delete cascade,
  primary key (user_id, base_id)
);
create index if not exists idx_user_base_base on user_base(base_id);

-- ---------------------------------------------------------------------------
-- Motoristas
-- ---------------------------------------------------------------------------
create table if not exists driver (
  id             uuid primary key default gen_random_uuid(),
  base_id        uuid not null references base(id) on delete cascade,
  name           text not null,
  normalized_key text not null,                     -- lowercase + trim p/ match
  documento      text,
  telefone       text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (base_id, normalized_key)
);
create index if not exists idx_driver_base on driver(base_id);

-- ---------------------------------------------------------------------------
-- Upload (registro de cada arquivo; não guarda o blob, só métricas)
-- ---------------------------------------------------------------------------
create table if not exists upload (
  id            uuid primary key default gen_random_uuid(),
  user_id       text references app_user(id),
  base_id       uuid not null references base(id) on delete cascade,
  kind          text not null
                  check (kind in ('CSV_SLA','XLSX_DS','XLSX_SLA_DS_HISTORY')),
  filename      text not null,
  size_bytes    integer not null default 0,
  rows_parsed   integer not null default 0,
  rows_kept     integer not null default 0,
  rows_rejected integer not null default 0,
  error_log     text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_upload_base_kind on upload(base_id, kind, created_at);

-- ---------------------------------------------------------------------------
-- Package (PNR) — só status finalizador; retenção 180d
-- ---------------------------------------------------------------------------
create table if not exists package (
  id            uuid primary key default gen_random_uuid(),
  upload_id     uuid not null references upload(id) on delete cascade,
  base_id       uuid not null references base(id) on delete cascade,
  driver_id     uuid references driver(id),
  codigo        text not null,
  status        text not null
                  check (status in ('ENTREGUE','DEVOLUCAO','INTERCEPTADO','DEVOLUCAO_LH')),
  finalizado_at timestamptz,
  imported_at   timestamptz not null default now(),
  unique (base_id, codigo)
);
create index if not exists idx_package_base_imported on package(base_id, imported_at);
create index if not exists idx_package_driver on package(driver_id);

-- ---------------------------------------------------------------------------
-- Snapshot — 1 por (base, dia). UPSERT no insert.
-- ---------------------------------------------------------------------------
create table if not exists snapshot (
  id            uuid primary key default gen_random_uuid(),
  base_id       uuid not null references base(id) on delete cascade,
  user_id       text references app_user(id),
  ts            timestamptz not null,
  data_pt_br    text not null,                      -- '22/05/2026'
  hora          text,
  sla_pct       numeric(5,2),
  ds_pct        numeric(5,2),
  total         integer not null default 0,
  entregues     integer not null default 0,
  em_rota       integer not null default 0,
  ocorrencias   integer not null default 0,
  faltantes     integer not null default 0,
  devolvidos    integer not null default 0,
  outros        integer not null default 0,
  upload_csv_id  uuid references upload(id),
  upload_xlsx_id uuid references upload(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (base_id, data_pt_br)                      -- 1 snapshot por base por dia
);
create index if not exists idx_snapshot_base_ts on snapshot(base_id, ts);

create table if not exists snapshot_driver (
  id          uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references snapshot(id) on delete cascade,
  driver_id   uuid references driver(id),
  driver_name text not null,                        -- congelado p/ histórico
  saiu        integer not null default 0,
  entregues   integer not null default 0,
  em_rota     integer not null default 0,
  ocorrencias integer not null default 0
);
create index if not exists idx_snapshot_driver_snap on snapshot_driver(snapshot_id);

-- ---------------------------------------------------------------------------
-- Histórico SLA/DS — manual ou XLSX em massa. UPSERT por (base, dia).
-- ---------------------------------------------------------------------------
create table if not exists sla_ds_record (
  id         uuid primary key default gen_random_uuid(),
  base_id    uuid not null references base(id) on delete cascade,
  upload_id  uuid references upload(id),
  user_id    text references app_user(id),
  ts         timestamptz not null,
  data_pt_br text not null,
  sla_pct    numeric(5,2),
  sla_rec    integer,
  sla_ent    integer,
  ds_pct     numeric(5,2),
  ds_rec     integer,
  ds_ent     integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (base_id, data_pt_br)
);
create index if not exists idx_sla_ds_base_ts on sla_ds_record(base_id, ts);

-- ---------------------------------------------------------------------------
-- Liberação de pagamento
-- ---------------------------------------------------------------------------
create table if not exists liberacao (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references app_user(id),
  base_id    uuid not null references base(id) on delete cascade,
  status     text not null check (status in ('OK','NOK')),
  observacao text,
  created_at timestamptz not null default now()
);
create index if not exists idx_liberacao_base_created on liberacao(base_id, created_at);

-- ---------------------------------------------------------------------------
-- Cache de CEP (ViaCEP)
-- ---------------------------------------------------------------------------
create table if not exists cep_cache (
  cep        text primary key,                      -- 8 dígitos sem máscara
  cidade     text not null,
  bairro     text not null,
  uf         text,
  fetched_at timestamptz not null default now()
);

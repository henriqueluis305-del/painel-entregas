-- ============================================================================
-- Migração 25 — SLA/DS por cidade (cidade resolvida do CEP do CSV de SLA)
-- ============================================================================
-- A "cidade" não vem numa coluna do export; é resolvida do CEP (Postal Code)
-- via o mesmo motor do Stuck (cep_cache + ViaCEP). Guardamos:
--   - shopee_sla_cidade        : agregado SLA por (base, dia, cidade)
--   - shopee_sla_driver_cidade : cidade dominante de cada motorista no SLA do dia
--                                (usado como PROCV nome→cidade no DS)
--   - shopee_base_cidade       : cidades descobertas por base + visibilidade
--                                (liga/desliga no SLA e no DS, auto-descoberta)
-- O total do SLA continua em shopee_sla_record (todas as linhas do arquivo);
-- a soma das cidades é um subconjunto.
-- ============================================================================

create table if not exists shopee_sla_cidade (
  id          bigserial primary key,
  base_id     varchar not null references base(id) on delete cascade,
  data_pt_br  varchar not null,
  cidade      varchar not null,                 -- município do CEP; '' = sem cidade
  total       integer not null default 0,
  entregues   integer not null default 0,
  em_rota     integer not null default 0,
  ocorrencias integer not null default 0,
  faltantes   integer not null default 0,
  outros      integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (base_id, data_pt_br, cidade)
);
create index if not exists idx_shopee_sla_cidade on shopee_sla_cidade(base_id, data_pt_br);

create table if not exists shopee_sla_driver_cidade (
  id          bigserial primary key,
  base_id     varchar not null references base(id) on delete cascade,
  data_pt_br  varchar not null,
  driver_id   varchar not null references driver(id),
  driver_name varchar not null,
  cidade      varchar not null default '',
  updated_at  timestamptz not null default now(),
  unique (base_id, data_pt_br, driver_id)
);
create index if not exists idx_shopee_sla_driver_cidade
  on shopee_sla_driver_cidade(base_id, data_pt_br);

-- Visibilidade por base: novas cidades entram visíveis (true) e o toggle persiste.
create table if not exists shopee_base_cidade (
  id         bigserial primary key,
  base_id    varchar not null references base(id) on delete cascade,
  cidade     varchar not null,
  show_sla   boolean not null default true,
  show_ds    boolean not null default true,
  created_at timestamptz not null default now(),
  unique (base_id, cidade)
);
create index if not exists idx_shopee_base_cidade on shopee_base_cidade(base_id);

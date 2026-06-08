-- ============================================================================
-- Migração 10 — Motoristas (ID externo) + modelo de Stuck da Shopee
-- ============================================================================
-- Aplicada em 2026-06-08. Decisões em docs/PLANO-SHOPEE.md §2.2 e §2.3.
-- Tabelas afetadas estavam VAZIAS (backup pré-migração em backups/).
-- NOTA: o DB foi criado pelo SQLModel com TODOS os ids como `varchar`
--       (não uuid). Por isso driver.id é varchar guardando o número
--       externo como texto (ex.: '99067') — mantém o ID e a consistência
--       com package.driver_id / snapshot_driver.driver_id (já varchar).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) DRIVER reformulado
--    id = ID externo das planilhas ([99067] em "Latest User Name"/fleets).
--    Motorista é GLOBAL da operação (não por base).
--    spx_driver_id = "Driver ID" do CSV de SLA (ex.: 1251914).
-- ---------------------------------------------------------------------------
alter table package         drop constraint if exists package_driver_id_fkey;
alter table snapshot_driver drop constraint if exists snapshot_driver_driver_id_fkey;
drop table if exists driver cascade;

create table driver (
  id             varchar primary key,                  -- ID externo [99067] (texto)
  operacao_id    varchar not null references operacao(id) on delete cascade,
  name           varchar not null,
  normalized_key varchar not null,                     -- lower+trim p/ match por nome
  spx_driver_id  varchar,                              -- Driver ID do CSV de SLA
  documento      varchar,
  telefone       varchar,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (operacao_id, normalized_key)
);
create index idx_driver_operacao on driver(operacao_id);
create index idx_driver_spx      on driver(spx_driver_id);

-- re-adiciona FKs antigas (colunas já são varchar; sem alter type)
alter table package         add constraint package_driver_id_fkey
  foreign key (driver_id) references driver(id);
alter table snapshot_driver add constraint snapshot_driver_driver_id_fkey
  foreign key (driver_id) references driver(id);

-- ---------------------------------------------------------------------------
-- 2) STUCK — estado atual, histórico de eventos e snapshot diário
-- ---------------------------------------------------------------------------

-- Estado ATUAL de cada pacote (upsert por base+codigo). Nunca deletar.
create table shopee_package (
  id             bigserial primary key,
  base_id        varchar not null references base(id) on delete cascade,
  codigo         varchar not null,                     -- Shipment ID / Order ID
  status         varchar not null,                     -- status Shopee cru
  driver_id      varchar references driver(id),
  dias_preso     numeric(6,2),                         -- LM Hub Days
  agency         varchar,
  first_seen_at  timestamptz not null default now(),
  last_status_at timestamptz not null default now(),
  delivered_at   timestamptz,
  updated_at     timestamptz not null default now(),
  unique (base_id, codigo)
);
create index idx_shopee_package_base   on shopee_package(base_id, status);
create index idx_shopee_package_driver on shopee_package(driver_id);

-- Histórico append-only de mudanças (evolução / auditoria).
create table shopee_package_event (
  id               bigserial primary key,
  package_id       bigint not null references shopee_package(id) on delete cascade,
  status           varchar not null,
  dias_preso       numeric(6,2),
  driver_id        varchar references driver(id),
  source_upload_id varchar references upload(id),
  observed_at      timestamptz not null default now()
);
create index idx_shopee_package_event_pkg on shopee_package_event(package_id, observed_at);

-- Snapshot diário do conjunto stuck (cron 23:30). 1 por (base, dia).
create table shopee_stuck_snapshot (
  id               bigserial primary key,
  base_id          varchar not null references base(id) on delete cascade,
  data_pt_br       varchar not null,                   -- '08/06/2026'
  ts               timestamptz not null default now(),
  total_stuck      integer not null default 0,
  entregues_no_dia integer not null default 0,
  por_status       jsonb,
  por_motorista    jsonb,
  created_at       timestamptz not null default now(),
  unique (base_id, data_pt_br)
);
create index idx_shopee_stuck_snapshot_base on shopee_stuck_snapshot(base_id, ts);

-- ---------------------------------------------------------------------------
-- 3) upload.kind — novos tipos de arquivo da Shopee
-- ---------------------------------------------------------------------------
alter table upload drop constraint if exists upload_kind_check;
alter table upload add constraint upload_kind_check
  check (kind in (
    'CSV_SLA','XLSX_DS','XLSX_SLA_DS_HISTORY',
    'XLSX_BACKLOG','CSV_STUCK_TRACK','XLSX_FLEETS','CSV_PNR'
  ));

commit;

-- ============================================================================
-- Migração 16 — DS por motorista (encaminhados vs entregues do dia)
-- ============================================================================
-- Porta o fluxo do app antigo (calcDS): xlsx por motorista com colunas
-- A=Driver, F=saiu, I=entregues, K=em rota, M=ocorrências. DS% = Σent/Σsaiu.
-- 1 linha por (base, dia, motorista).
-- ============================================================================
create table if not exists shopee_ds_driver (
  id          bigserial primary key,
  base_id     varchar not null references base(id) on delete cascade,
  data_pt_br  varchar not null,                 -- '08/06/2026'
  driver_id   varchar references driver(id),
  driver_name varchar not null,
  saiu        integer not null default 0,
  entregues   integer not null default 0,
  em_rota     integer not null default 0,
  ocorrencias integer not null default 0,
  is_demo     boolean not null default false,   -- dados de exemplo (protótipo)
  updated_at  timestamptz not null default now(),
  unique (base_id, data_pt_br, driver_id)
);
create index if not exists idx_shopee_ds_driver_base on shopee_ds_driver(base_id, data_pt_br);

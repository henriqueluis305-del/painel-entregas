-- ============================================================================
-- Migração 18 — SLA por base/dia (nível de serviço)
-- ============================================================================
-- Porta o calcSLA antigo: SLA% = entregues/total (do CSV export_return_order).
-- 1 linha por (base, dia) com a quebra por categoria p/ os cards + evolução.
-- ============================================================================
create table if not exists shopee_sla_record (
  id          bigserial primary key,
  base_id     varchar not null references base(id) on delete cascade,
  data_pt_br  varchar not null,
  total       integer not null default 0,
  entregues   integer not null default 0,
  em_rota     integer not null default 0,
  ocorrencias integer not null default 0,
  faltantes   integer not null default 0,
  outros      integer not null default 0,
  sla_pct     numeric(5,2) not null default 0,
  updated_at  timestamptz not null default now(),
  unique (base_id, data_pt_br)
);
create index if not exists idx_shopee_sla_record_base on shopee_sla_record(base_id, data_pt_br);

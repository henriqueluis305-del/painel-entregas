-- ============================================================================
-- Migração 26 — Checkpoints de SLA (crescimento do SLA por upload no dia)
-- ============================================================================
-- Cada upload de SLA grava 1 checkpoint por base com os totais daquele momento.
-- Crescimento SLA = SLA% (entregues/total) ao longo dos uploads do dia atual
-- (espelha o shopee_ds_checkpoint, que faz o mesmo pro DS).
-- ============================================================================
create table if not exists shopee_sla_checkpoint (
  id          bigserial primary key,
  base_id     varchar not null references base(id) on delete cascade,
  data_pt_br  varchar not null,
  seq         integer not null,
  ts          timestamptz not null default now(),
  label       varchar not null,
  total       integer not null default 0,
  entregues   integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (base_id, data_pt_br, seq)
);
create index if not exists idx_shopee_sla_ckpt_base on shopee_sla_checkpoint(base_id, data_pt_br, seq);

-- ============================================================================
-- Migração 17 — Checkpoints de DS (burn-down do DS por upload)
-- ============================================================================
-- Cada upload do fleets grava 1 checkpoint por base com os totais do dia.
-- Burn-down DS = % ainda não entregue ao longo dos uploads.
-- ============================================================================
create table if not exists shopee_ds_checkpoint (
  id          bigserial primary key,
  base_id     varchar not null references base(id) on delete cascade,
  data_pt_br  varchar not null,
  seq         integer not null,
  ts          timestamptz not null default now(),
  label       varchar not null,
  saiu        integer not null default 0,
  entregues   integer not null default 0,
  em_rota     integer not null default 0,
  ocorrencias integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (base_id, data_pt_br, seq)
);
create index if not exists idx_shopee_ds_ckpt_base on shopee_ds_checkpoint(base_id, data_pt_br, seq);

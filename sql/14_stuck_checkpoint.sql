-- ============================================================================
-- Migração 14 — Checkpoints de Stuck (burn-down por upload)
-- ============================================================================
-- Cada upload (backlog inicial + cada tracking CSV) grava 1 checkpoint por base
-- com o total do dia, quantos ainda estão stuck e quantos foram resolvidos.
-- Alimenta o gráfico de burn-down (% ainda stuck ao longo dos uploads).
-- ============================================================================
create table if not exists shopee_stuck_checkpoint (
  id          bigserial primary key,
  base_id     varchar not null references base(id) on delete cascade,
  upload_id   varchar references upload(id) on delete set null,
  seq         integer not null,                 -- ordem no dia (0 = backlog)
  data_pt_br  varchar not null,                 -- '08/06/2026'
  ts          timestamptz not null default now(),
  label       varchar not null,                 -- 'Backlog', 'Tracking 07:34', ...
  total       integer not null default 0,       -- conjunto do dia (denominador)
  ainda_stuck integer not null default 0,
  resolvidos  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (base_id, data_pt_br, seq)
);
create index if not exists idx_shopee_stuck_ckpt_base on shopee_stuck_checkpoint(base_id, data_pt_br, seq);

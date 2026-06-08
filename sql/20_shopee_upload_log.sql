-- ============================================================================
-- Migração 20 — histórico de uploads in-app
-- ============================================================================
create table if not exists shopee_upload_log (
  id          bigserial primary key,
  user_email  varchar,
  kind        varchar not null,            -- backlog | tracking | ds | sla
  filenames   text,
  rows        integer not null default 0,  -- linhas/registros processados
  summary     text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_shopee_upload_log_created on shopee_upload_log(created_at desc);

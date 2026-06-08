-- ============================================================================
-- Migração 15 — Config por operação + dia do backlog (limpeza diária da VISÃO)
-- ============================================================================
-- NÃO limpa o DB. Marca a que dia/backlog cada pacote pertence, p/ o dash poder
-- mostrar só o backlog do dia. Toggle fica em operacao.config (jsonb).
-- ============================================================================

-- config por operação (ex.: { "stuck_daily_reset": true })
alter table operacao add column if not exists config jsonb not null default '{}'::jsonb;

-- dia do backlog mais recente em que o pacote apareceu
alter table shopee_package add column if not exists last_backlog_date date;
update shopee_package set last_backlog_date = current_date where last_backlog_date is null;
create index if not exists idx_shopee_package_backlog_date
  on shopee_package(base_id, last_backlog_date);

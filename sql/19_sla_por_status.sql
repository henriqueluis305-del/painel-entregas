-- ============================================================================
-- Migração 19 — quebra por status no SLA (tabela de detalhamento)
-- ============================================================================
-- Guarda a contagem por status cru (ex.: {"Delivered": 20882, "OnHold": 175}).
-- ============================================================================
alter table shopee_sla_record add column if not exists por_status jsonb not null default '{}'::jsonb;

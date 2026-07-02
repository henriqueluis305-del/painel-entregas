-- ============================================================================
-- PROPOSTA (não roda automaticamente — está fora de migrations/*.sql de raiz).
--
-- Drop das tabelas LEGADAS da era pré-Shopee (fluxo Reflex/planilhas antigo).
-- Evidências (produção, 01/07/2026 — ver docs/DB-OTIMIZACAO.md §1):
--   • todas com 0 linhas;
--   • nenhuma query no app (telas hoje/motoristas/liberacao = placeholder,
--     historico/sla-ds = redirect);
--   • shopee_package_event.source_upload_id: 100% NULL (FK morta p/ upload).
--
-- Antes de promover a migrations/0005_...sql:
--   1) remover o count de sla_ds_record em src/lib/queries.ts (getDashboardStats);
--   2) conferir que nenhum script de scripts/ que você ainda usa grava nelas;
--   3) mover este arquivo pra migrations/ e rodar npm run migrate.
-- ============================================================================

-- FK morta que prende a tabela upload
alter table shopee_package_event drop column if exists source_upload_id;

-- ordem respeita as FKs entre elas
drop table if exists snapshot_driver;
drop table if exists snapshot;
drop table if exists sla_ds_record;
drop table if exists liberacao;
drop table if exists user_base;
drop table if exists package;
drop table if exists upload;
drop table if exists shopee_stuck_snapshot;
drop table if exists alembic_version;

-- ============================================================================
-- Migração 22 — operação principal do usuário (default do Painel Live)
-- ============================================================================
-- Cada usuário tem uma operação "principal" (default). Se nula, cai no operacao_id.
-- Setável pelo próprio user (entre as permitidas) e pelo super-adm.
-- ============================================================================
-- (ids no DB real são varchar — ver sql/10)
alter table app_user add column if not exists principal_operacao_id varchar references operacao(id);

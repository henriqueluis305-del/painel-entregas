-- ============================================================================
-- 0003 — Índices alinhados ao consumo REAL do app (ver docs/DB-OTIMIZACAO.md).
-- Tudo aditivo; seguro em produção.
-- ============================================================================

-- getDriverPerformance / ranking: filtra por driver_id cruzando dias — hoje só
-- existe unique (base_id, data_pt_br, driver_id), que não serve pra busca por
-- motorista. Parcial: linhas sem motorista resolvido ficam fora do índice.
create index if not exists idx_shopee_ds_driver_driver
  on shopee_ds_driver (driver_id)
  where driver_id is not null;

-- PNR: todas as telas filtram por período de created_time (rangeClause) e a
-- maioria por base — (base_id, created_time) cobre o par; índices atuais só
-- tinham driver_id e status.
create index if not exists idx_shopee_pnr_base_time
  on shopee_pnr (base_id, created_time);

-- Fila do worker: o poll só olha status='pending' ordenado por created_at.
-- Índice parcial é menor e mais quente que o (status, created_at) completo.
drop index if exists idx_processing_jobs_status;
create index if not exists idx_processing_jobs_pending
  on processing_jobs (created_at)
  where status = 'pending';

-- Auditoria de upload por usuário (tela de monitoramento filtra/agrupa por email)
create index if not exists idx_shopee_upload_log_user
  on shopee_upload_log (user_email, created_at desc);

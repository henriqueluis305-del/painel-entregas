-- ============================================================================
-- Migração 23 — aprovação de cadastro de usuário
-- ============================================================================
-- Self-signup no /login cria o app_user com approval_status='pending' e a
-- conta já banida na Auth (ban_duration). Aprovar = approval_status='approved'
-- + active=true + desbane. Rejeitar = approval_status='rejected' (continua
-- banida; registro fica pra auditoria, admin pode excluir depois).
-- Usuários existentes (criados antes desta migração) entram como 'approved'.
-- ============================================================================
alter table app_user add column if not exists approval_status varchar not null default 'approved';

alter table app_user drop constraint if exists app_user_approval_status_check;
alter table app_user add constraint app_user_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

create index if not exists idx_app_user_approval_status on app_user(approval_status);

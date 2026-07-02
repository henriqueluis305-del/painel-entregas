-- ============================================================================
-- 0005 — Normalização preventiva das tabelas legadas (vão receber dados de novo).
--
-- Elas estão VAZIAS hoje — mudança de tipo/constraint é instantânea e sem risco.
-- Depois que os dados chegarem, cada um desses fixes viraria migração com
-- backfill/lock. Consertar agora é de graça. (Análise: docs/DB-OTIMIZACAO.md §1)
--
-- Nada é dropado. Só tipos, constraints, uniques e índices.
-- ============================================================================

-- ── 1. timestamptz em tudo (era Alembic gravava timestamp SEM fuso) ─────────
-- Valores existentes (poucos, em app_user/base/operacao/cep_cache) foram
-- gravados por now() com timezone UTC do servidor — interpretação correta.
alter table app_user
  alter column created_at    type timestamptz using created_at at time zone 'UTC',
  alter column updated_at    type timestamptz using updated_at at time zone 'UTC',
  alter column last_login_at type timestamptz using last_login_at at time zone 'UTC';
alter table operacao
  alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table base
  alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table cep_cache
  alter column fetched_at type timestamptz using fetched_at at time zone 'UTC';
alter table upload
  alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table package
  alter column finalizado_at type timestamptz using finalizado_at at time zone 'UTC',
  alter column imported_at   type timestamptz using imported_at at time zone 'UTC';
alter table snapshot
  alter column ts         type timestamptz using ts at time zone 'UTC',
  alter column created_at type timestamptz using created_at at time zone 'UTC',
  alter column updated_at type timestamptz using updated_at at time zone 'UTC';
alter table sla_ds_record
  alter column ts         type timestamptz using ts at time zone 'UTC',
  alter column created_at type timestamptz using created_at at time zone 'UTC',
  alter column updated_at type timestamptz using updated_at at time zone 'UTC';
alter table liberacao
  alter column created_at type timestamptz using created_at at time zone 'UTC';

-- ── 2. app_user: json → jsonb + domínios fechados ───────────────────────────
-- json guarda texto cru (sem índice, comparação lenta); jsonb é o tipo certo.
alter table app_user
  alter column extra_perms  type jsonb using extra_perms::jsonb,
  alter column denied_perms type jsonb using denied_perms::jsonb,
  alter column extra_perms  set default '[]'::jsonb,
  alter column denied_perms set default '[]'::jsonb;

-- role/base_scope eram texto livre (só approval_status tinha CHECK).
-- Valores validados contra produção antes de fechar o domínio.
alter table app_user
  add constraint app_user_role_check check (role in
    ('USER','MONITORAMENTO','SUPERVISOR','SUPERVISOR_FINANCEIRO','COORDENADOR'));
alter table app_user
  add constraint app_user_base_scope_check check (base_scope in
    ('SINGLE','OP_WIDE','ALL'));
-- default refletia o fluxo antigo; cadastro público hoje nasce USER
alter table app_user alter column role set default 'USER';

-- ── 3. dia tipado nas legadas com data_pt_br (mesmo padrão da 0004) ─────────
alter table snapshot
  add column if not exists data date generated always as (br_date(data_pt_br)) stored;
create index if not exists idx_snapshot_base_data on snapshot (base_id, data);

alter table sla_ds_record
  add column if not exists data date generated always as (br_date(data_pt_br)) stored;
create index if not exists idx_sla_ds_record_base_data on sla_ds_record (base_id, data);

-- ── 4. uniques anti-duplicata que faltavam ──────────────────────────────────
-- package: mesmo código duas vezes no mesmo upload = dado sujo silencioso
alter table package
  add constraint uq_package_upload_codigo unique (upload_id, codigo);
-- snapshot_driver: mesmo motorista duas vezes na mesma foto
alter table snapshot_driver
  add constraint uq_snapshot_driver unique (snapshot_id, driver_id);

-- ── 5. percentuais: double precision → numeric(5,2) ─────────────────────────
-- Alinha com as shopee_* (sla_pct numeric(5,2)); float pra percentual exibido
-- gera 93.30000000000001. Tabelas vazias → conversão livre.
alter table snapshot
  alter column sla_pct type numeric(5,2),
  alter column ds_pct  type numeric(5,2);
alter table sla_ds_record
  alter column sla_pct type numeric(5,2),
  alter column ds_pct  type numeric(5,2);

-- ── 6. índices de consumo previsto (FKs sem índice) ─────────────────────────
create index if not exists idx_liberacao_base_created on liberacao (base_id, created_at desc);
create index if not exists idx_liberacao_user on liberacao (user_id);
create index if not exists idx_package_upload on package (upload_id);
create index if not exists idx_package_driver on package (driver_id) where driver_id is not null;
create index if not exists idx_snapshot_user on snapshot (user_id);

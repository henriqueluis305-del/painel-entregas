-- ============================================================================
-- Painel de Entregas — Row Level Security (Supabase Postgres)
-- ============================================================================
-- "Cinto + suspensório": mesmo que um endpoint esqueça o filtro de escopo,
-- o banco bloqueia leitura fora do escopo do usuário.
--
-- Pressupõe que auth.uid() (Supabase) == app_user.id.
-- ESCRITAS passam pelo backend usando a SERVICE_ROLE_KEY, que bypassa RLS por
-- design — por isso só criamos policies de SELECT aqui.
--
-- Rodar DEPOIS de 01_schema.sql, no SQL Editor do Supabase.
-- ============================================================================

create or replace function public.user_can_access_base(b_id uuid)
returns boolean
language sql
stable
as $$
  select
    -- admin / escopo ALL vê tudo
    exists (
      select 1 from app_user u
      where u.id = auth.uid()::text
        and (u.is_admin = true or u.base_scope = 'ALL')
    )
    -- escopo OP_WIDE: todas as bases da operação do usuário
    or exists (
      select 1 from app_user u
      where u.id = auth.uid()::text
        and u.base_scope = 'OP_WIDE'
        and u.operacao_id = (select b.operacao_id from base b where b.id = b_id)
    )
    -- escopo SINGLE: só as bases associadas em user_base
    or exists (
      select 1 from user_base ub
      join app_user u on u.id = ub.user_id
      where u.id = auth.uid()::text
        and ub.base_id = b_id
        and u.base_scope = 'SINGLE'
    );
$$;

-- Habilita RLS nas tabelas com base_id
alter table snapshot        enable row level security;
alter table snapshot_driver enable row level security;
alter table upload          enable row level security;
alter table package         enable row level security;
alter table sla_ds_record   enable row level security;
alter table liberacao       enable row level security;

-- Policies de SELECT (idempotentes)
drop policy if exists snapshot_read on snapshot;
create policy snapshot_read on snapshot
  for select using (public.user_can_access_base(base_id));

drop policy if exists upload_read on upload;
create policy upload_read on upload
  for select using (public.user_can_access_base(base_id));

drop policy if exists package_read on package;
create policy package_read on package
  for select using (public.user_can_access_base(base_id));

drop policy if exists sla_ds_read on sla_ds_record;
create policy sla_ds_read on sla_ds_record
  for select using (public.user_can_access_base(base_id));

drop policy if exists liberacao_read on liberacao;
create policy liberacao_read on liberacao
  for select using (public.user_can_access_base(base_id));

-- snapshot_driver não tem base_id direto; herda do snapshot
drop policy if exists snapshot_driver_read on snapshot_driver;
create policy snapshot_driver_read on snapshot_driver
  for select using (
    exists (
      select 1 from snapshot s
      where s.id = snapshot_driver.snapshot_id
        and public.user_can_access_base(s.base_id)
    )
  );

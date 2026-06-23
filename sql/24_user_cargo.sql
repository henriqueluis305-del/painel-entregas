-- ============================================================================
-- Migração 24 — cargo (texto livre) separado de role (perfil de permissão)
-- ============================================================================
-- `cargo` é só informativo (ex.: "Desenvolvedor", "Analista de Sistemas") —
-- não afeta permissão. Quem decide acesso é `role` (preset) + `is_admin`
-- (flag independente — ser admin não é mais um valor de role).
-- No cadastro público o usuário só informa `cargo`; `role` nasce 'USER' e
-- só o admin ajusta na aprovação.
-- ============================================================================
alter table app_user add column if not exists cargo varchar;

-- Contas que tinham role='ADMIN' (role deixou de ter esse valor — is_admin já
-- cobre a elevação). Migra para COORDENADOR (preset mais aberto) e preenche
-- o cargo real dessas duas contas.
update app_user set role = 'COORDENADOR' where role = 'ADMIN';
update app_user set cargo = 'Desenvolvedor' where email = 'pedro.antunes.ha@gmail.com';
update app_user set cargo = 'Analista de Sistemas' where email = 'luiz.henrique@gmail.com';

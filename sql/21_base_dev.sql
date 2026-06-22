-- ============================================================================
-- Base de TESTE — XPT-DEV (rota exclusiva p/ validar o dashboard)
-- ============================================================================
-- Resolve a partir da estação "XPT_DEV" (resolveBaseSlug → 'xpt-dev').
-- Para esconder depois: update base set active=false where slug='xpt-dev';
-- Para remover de vez: delete from base where slug='xpt-dev'; (cascata limpa os dados)
-- ============================================================================
insert into base (operacao_id, slug, label)
select o.id, 'xpt-dev', 'XPT-DEV (Teste)'
from operacao o
where o.slug = 'shopee'
on conflict (operacao_id, slug) do update set label = excluded.label, active = true;

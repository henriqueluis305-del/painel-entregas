-- ============================================================================
-- Seed 11 — base XPT-SMT-01 (São Mateus) da Shopee
-- ============================================================================
-- Apareceu nos backlogs (4883 pacotes) mas não estava no seed inicial.
-- Decisão 2026-06-08: criar (dado operacional; base real e ativa).
-- ============================================================================
insert into base (operacao_id, slug, label)
select o.id, 'xpt-smt-01', 'XPT-SMT-01 (São Mateus)'
from operacao o
where o.slug = 'shopee'
on conflict (operacao_id, slug) do update set label = excluded.label;

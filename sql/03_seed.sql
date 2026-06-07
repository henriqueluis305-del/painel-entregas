-- ============================================================================
-- Painel de Entregas — Seed inicial (operações + bases existentes)
-- ============================================================================
-- Rodar DEPOIS de 01_schema.sql. Idempotente (ON CONFLICT DO NOTHING).
-- Bases extraídas de operacoes/shopee/* do repositório atual.
-- ============================================================================

-- Operações
insert into operacao (slug, label) values
  ('shopee', 'Shopee'),
  ('meli',   'Mercado Livre'),
  ('jt',     'J&T'),
  ('loggi',  'Loggi'),
  ('imile',  'iMile')
on conflict (slug) do nothing;

-- Bases da Shopee
insert into base (operacao_id, slug, label)
select o.id, v.slug, v.label
from operacao o
join (values
  ('xpt-adr-02', 'XPT-ADR-02'),
  ('xpt-ctn-01', 'XPT-CTN-01'),
  ('xpt-lrs-01', 'XPT-LRS-01'),
  ('xpt-nvc-01', 'XPT-NVC-01'),
  ('xpt-sqr-01', 'XPT-SQR-01')
) as v(slug, label) on true
where o.slug = 'shopee'
on conflict (operacao_id, slug) do nothing;

-- ============================================================================
-- Seed 13 — cidades nos labels das bases Shopee (exibido nos seletores)
-- ============================================================================
update base b set label = v.label
from operacao o, (values
  ('xpt-adr-02', 'XPT-ADR-02 (Angra dos Reis)'),
  ('xpt-ctn-01', 'XPT-CTN-01 (Colatina)'),
  ('xpt-lrs-01', 'XPT-LRS-01 (Linhares)'),
  ('xpt-nvc-01', 'XPT-NVC-01 (Nova Venécia)'),
  ('xpt-sqr-01', 'XPT-SQR-01 (Saquarema)'),
  ('xpt-smt-01', 'XPT-SMT-01 (São Mateus)')
) as v(slug, label)
where b.operacao_id = o.id and o.slug = 'shopee' and b.slug = v.slug;

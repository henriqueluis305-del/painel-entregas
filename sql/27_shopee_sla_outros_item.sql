-- ============================================================================
-- Migração 27 — Itens do balde "Outros" do SLA (código por cidade)
-- ============================================================================
-- Guarda cada pacote que cai em "Outros" (faltantes + demais categorias, ou
-- seja, tudo que não é Entregue/Em rota/Ocorrência) com o código (BR/Order ID)
-- e a cidade resolvida do CEP. Serve pro drill "Outros por cidade" no painel:
-- ao abrir, mostra de onde é cada pacote e permite copiar a lista de IDs.
-- Regravado por (base, dia) a cada upload de SLA (o arquivo é o estado completo).
-- ============================================================================
create table if not exists shopee_sla_outros_item (
  id          bigserial primary key,
  base_id     varchar not null references base(id) on delete cascade,
  data_pt_br  varchar not null,
  cidade      varchar not null default '',       -- município do CEP; '' = sem cidade
  status      varchar not null default '',       -- status cru do Shopee
  codigo      varchar not null,                  -- Order ID (BR...)
  created_at  timestamptz not null default now()
);
create index if not exists idx_shopee_sla_outros
  on shopee_sla_outros_item(base_id, data_pt_br);

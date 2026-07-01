-- ============================================================================
-- Migração 28 — Cidade da base: um único switch (SLA + DS + Stuck), opt-in
-- ============================================================================
-- Antes havia dois toggles por cidade (show_sla, show_ds), default LIGADO.
-- Agora é um switch só (`enabled`) que vale para as três visões por cidade
-- (SLA, DS e o "Fora de Abrangência" do Stuck) e o padrão passa a ser DESLIGADO
-- (opt-in: o admin liga só as cidades da base que quiser).
--
-- A coluna nova com default false já ZERA todas as cidades existentes — é o
-- "começar do zero" combinado. A auto-descoberta de cidades no upload de SLA
-- (uploads/actions.ts, insert ... on conflict do nothing) segue igual: novas
-- cidades entram desligadas pelo default.
-- ============================================================================

alter table shopee_base_cidade add column if not exists enabled boolean not null default false;
alter table shopee_base_cidade drop column if exists show_sla;
alter table shopee_base_cidade drop column if exists show_ds;

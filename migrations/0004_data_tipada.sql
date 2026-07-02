-- ============================================================================
-- 0004 — Data com tipo DATE nas tabelas que guardam dia como texto 'DD/MM/YYYY'.
--
-- Problema estrutural (ver docs/DB-OTIMIZACAO.md §2): data_pt_br é varchar no
-- formato BR. Consequências hoje:
--   • ordenar/rangear por dia exige parse no app (parseBrDate espalhado);
--   • "dia mais recente" é aproximado por updated_at (semanticamente errado:
--     re-upload de um dia antigo viraria o "mais recente");
--   • índice em varchar 'DD/MM/YYYY' não ordena cronologicamente.
--
-- Solução SEM tocar no app: coluna GERADA `data date` derivada de data_pt_br.
-- O app continua gravando data_pt_br como sempre; o banco mantém a data tipada
-- em sincronia automaticamente. A migração do código pra ler/ordenar por `data`
-- é follow-up incremental (query a query).
--
-- to_date() é STABLE no catálogo; generated column exige IMMUTABLE — wrapper
-- com formato fixo é determinístico e seguro aqui.
-- ============================================================================

create or replace function br_date(txt text) returns date
language sql immutable strict
as $$ select to_date(txt, 'DD/MM/YYYY') $$;

-- Dia BR de um timestamp (PNR usa created_time; corte de dia = Brasília).
-- timezone() é STABLE (tzdata pode mudar), mas p/ America/Sao_Paulo o wrapper
-- immutable é o compromisso padrão — offset estável desde 2019 (fim do horário
-- de verão); mudança futura exigiria reindexar, risco aceito e documentado.
create or replace function br_day(ts timestamptz) returns date
language sql immutable strict
as $$ select (ts at time zone 'America/Sao_Paulo')::date $$;

-- ── coluna gerada + índice cronológico ──────────────────────────────────────
alter table shopee_ds_driver
  add column if not exists data date generated always as (br_date(data_pt_br)) stored;
create index if not exists idx_shopee_ds_driver_base_data
  on shopee_ds_driver (base_id, data);

alter table shopee_sla_record
  add column if not exists data date generated always as (br_date(data_pt_br)) stored;
create index if not exists idx_shopee_sla_record_base_data
  on shopee_sla_record (base_id, data);

alter table shopee_sla_cidade
  add column if not exists data date generated always as (br_date(data_pt_br)) stored;
create index if not exists idx_shopee_sla_cidade_base_data
  on shopee_sla_cidade (base_id, data);

alter table shopee_sla_driver_cidade
  add column if not exists data date generated always as (br_date(data_pt_br)) stored;
create index if not exists idx_shopee_sla_driver_cidade_base_data
  on shopee_sla_driver_cidade (base_id, data);

alter table shopee_sla_outros_item
  add column if not exists data date generated always as (br_date(data_pt_br)) stored;
create index if not exists idx_shopee_sla_outros_base_data
  on shopee_sla_outros_item (base_id, data);

alter table shopee_ds_checkpoint
  add column if not exists data date generated always as (br_date(data_pt_br)) stored;

alter table shopee_sla_checkpoint
  add column if not exists data date generated always as (br_date(data_pt_br)) stored;

alter table shopee_stuck_checkpoint
  add column if not exists data date generated always as (br_date(data_pt_br)) stored;

-- PNR: dia BR tipado a partir de created_time (substitui to_char/date_trunc
-- por expressão nas queries; semana = date_trunc('week', created_date_br)).
alter table shopee_pnr
  add column if not exists created_date_br date generated always as (br_day(created_time)) stored;
create index if not exists idx_shopee_pnr_base_dia
  on shopee_pnr (base_id, created_date_br);

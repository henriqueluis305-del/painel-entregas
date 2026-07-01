-- ============================================================================
-- Bases ES que só existem em PNR (mesmo estilo de sql/17): active=false →
-- aparecem só na aba PNR. id = código aleatório de 4 dígitos (base.id é varchar).
-- Obs.: Linhares tem hub E xpt — LES-05 (hub) coexiste com XPT-LRS-01 (xpt).
-- Idempotente.
-- ============================================================================
do $$
declare op_id varchar;
begin
  select id into op_id from operacao where slug = 'shopee';

  insert into base (id, operacao_id, slug, label, active) values
    ('8164', op_id, 'les-01', 'LES-01 (Cachoeiro de Itapemirim)', false),
    ('9275', op_id, 'les-05', 'LES-05 (Linhares)',                false)
  on conflict (operacao_id, slug) do update
    set label = excluded.label, active = excluded.active;
end $$;

-- Backfill dos PNRs já existentes (se houver) por estação.
update shopee_pnr set base_id = '8164' where base_id is null and station_raw = 'LM Hub_ES_Cachoeiro de Itap';
update shopee_pnr set base_id = '9275' where base_id is null and station_raw = 'LM Hub_ES_Linhares';

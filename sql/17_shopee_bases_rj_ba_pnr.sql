-- ============================================================================
-- Bases RJ/BA que só existem em PNR (estações sem base cadastrada).
-- Criadas com active=false → NÃO aparecem em stuck/ds/sla/geral/uploads/home
-- (essas telas listam só bases ativas). Aparecem apenas na aba PNR, que lista
-- bases via join com shopee_pnr (sem olhar active).
-- id = código aleatório de 4 dígitos (base.id é varchar; ids atuais são UUID).
-- Idempotente: pode rodar de novo sem duplicar.
-- ============================================================================
do $$
declare op_id varchar;
begin
  select id into op_id from operacao where slug = 'shopee';

  insert into base (id, operacao_id, slug, label, active) values
    ('4821', op_id, 'lrj-21', 'LRJ-21 (Cabo Frio - Jd Flamb)',        false),
    ('5093', op_id, 'lrj-24', 'LRJ-24 (Campos dos Goytacazes)',       false),
    ('6147', op_id, 'lrj-32', 'LRJ-32 (Ilha do Governador)',          false),
    ('7312', op_id, 'lrj-05', 'LRJ-05 (Macaé - Imboassica)',          false),
    ('2984', op_id, 'lrj-07', 'LRJ-07 (São Cristóvão)',               false),
    ('3756', op_id, 'lrj-01', 'LRJ-01 (São João de Meriti)',          false),
    ('4408', op_id, 'lrj-02', 'LRJ-02 (Nova Friburgo)',               false),
    ('5521', op_id, 'lrj-04', 'LRJ-04 (Rio de Janeiro - Campo G)',    false),
    ('6630', op_id, 'lrj-08', 'LRJ-08 (São Gonçalo)',                 false),
    ('7749', op_id, 'lrj-27', 'LRJ-27 (Nova Iguaçu)',                 false),
    ('2205', op_id, 'lrj-15', 'LRJ-15 (Magé)',                        false),
    ('3318', op_id, 'lba-18', 'LBA-18 (Salvador - Pirajá)',           false)
  on conflict (operacao_id, slug) do update
    set label = excluded.label, active = excluded.active;
end $$;

-- Backfill: liga os PNRs já existentes (base_id nulo) à base correta por estação.
update shopee_pnr set base_id = '4821' where base_id is null and station_raw = 'LM Hub_RJ_Cabo Frio_Jd Flamb';
update shopee_pnr set base_id = '5093' where base_id is null and station_raw = 'LM Hub_RJ_Cps dos Goytacazes';
update shopee_pnr set base_id = '6147' where base_id is null and station_raw = 'LM Hub_RJ_Ilha do Governador';
update shopee_pnr set base_id = '7312' where base_id is null and station_raw = 'LM Hub_RJ_Macae_ Imboassica';
update shopee_pnr set base_id = '2984' where base_id is null and station_raw = 'LM Hub_RJ_São Cristóvão';
update shopee_pnr set base_id = '3756' where base_id is null and station_raw = 'LM Hub_RJ_São João do Meriti';
update shopee_pnr set base_id = '4408' where base_id is null and station_raw = 'LM Hub_RJ_Nova Friburgo';
update shopee_pnr set base_id = '5521' where base_id is null and station_raw = 'LM Hub_RJ_Rio de Janeiro_Campo G';
update shopee_pnr set base_id = '6630' where base_id is null and station_raw = 'LM Hub_RJ_São Gonçalo_02';
update shopee_pnr set base_id = '7749' where base_id is null and station_raw = 'LM Hub_RJ_Nova Iguaçu';
update shopee_pnr set base_id = '6630' where base_id is null and station_raw = 'LM Hub_RJ_São Gonçalo';
update shopee_pnr set base_id = '2205' where base_id is null and station_raw = 'LM Hub_RJ_Mage';
update shopee_pnr set base_id = '3318' where base_id is null and station_raw = 'LM Hub_BA_Salvador_Pirajá';

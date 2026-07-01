-- ============================================================================
-- Migração 16 — CEP por pacote no Stuck da Shopee
-- ============================================================================
-- Descongela GEL-001 (resolução de CEP → cidade via ViaCEP).
-- O CEP chega nos uploads (backlog/tracking) e agora é persistido por pacote;
-- a cidade é resolvida na leitura (cache cep_cache + ViaCEP).
-- Pacotes antigos ficam com cep NULL até o próximo upload que o traga.
-- ============================================================================

begin;

alter table shopee_package add column if not exists cep varchar;  -- 8 dígitos sem máscara

commit;

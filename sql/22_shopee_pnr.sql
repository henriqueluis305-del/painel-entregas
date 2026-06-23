-- ============================================================================
-- Migração 22 — PNR da Shopee (prejuízos por ticket)
-- ============================================================================
-- Fonte: CSV pnr_station_ticket (colunas IHS Ticket ID, SPXTN, Driver, Station,
-- SLA Deadline, PNR Order Value, Rejection Reason, Created Time, Status).
-- Decisão (2026-06-22): a unidade de PNR é o SPXTN (coluna C). O mesmo SPXTN
-- aparece em vários tickets — colapsa-se por SPXTN mantendo a linha de maior
-- Created Time. Na reimportação só o `status` é atualizado (valor/motivo/prazo
-- nunca são substituídos). Nunca deletar.
-- ============================================================================
create table if not exists shopee_pnr (
  spxtn          varchar primary key,                 -- coluna C (Order ID) = chave da PNR
  driver_id      varchar references driver(id),
  driver_name    varchar not null default '',
  base_id        varchar references base(id) on delete set null,
  station_raw    varchar,                             -- estação crua (nem toda resolve p/ base)
  valor          numeric(12,2),                       -- PNR Order Value
  status         varchar not null,                    -- status Shopee cru
  motivo         varchar,                             -- Rejection Reason
  prazo          timestamptz,                         -- SLA Deadline
  created_time   timestamptz,                         -- Created Time
  first_seen_at  timestamptz not null default now(),
  last_status_at timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_shopee_pnr_driver on shopee_pnr(driver_id);
create index if not exists idx_shopee_pnr_status on shopee_pnr(status);

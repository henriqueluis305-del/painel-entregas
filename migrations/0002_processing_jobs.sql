-- Fila de processamento de planilhas (AD-06 do plano AWS: worker fora do web)
-- + arquivamento dos originais no S3 (RF-09: auditoria/reprocessamento).

create table if not exists processing_jobs (
  id            bigserial primary key,
  kind          text not null,                     -- sla | ds | backlog | tracking | pnr | ...
  s3_key        text not null,                     -- arquivo no bucket
  filename      text,
  size_bytes    bigint,
  status        text not null default 'pending',   -- pending | processing | done | failed
  error_message text,
  requested_by  text,                              -- email de quem subiu
  payload       jsonb,                             -- parâmetros extras (baseSlug etc.)
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

create index if not exists idx_processing_jobs_status
  on processing_jobs (status, created_at);

-- Original arquivado do upload (rastreabilidade do que gerou cada carga).
alter table shopee_upload_log
  add column if not exists s3_keys text[];

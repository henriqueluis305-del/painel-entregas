# Dev local — clone da AWS

Como rodar o ambiente inteiro na sua máquina, espelhando o que vai rodar na AWS
(RDS/S3/Cognito), e continuar desenvolvendo com hot reload. Detalhes de
arquitetura: `docs/PLANO-MIGRACAO-AWS.md` (§8.5).

| AWS (prod) | Local (dev) | Fidelidade |
|---|---|---|
| RDS PostgreSQL | Postgres 17 em container (porta **5433**) | idêntica |
| S3 | MinIO (`localhost:9000`, console `:9001`) | idêntica (mesmo SDK) |
| Cognito | cognito-local (`localhost:9229`) | alta |
| SSM | `.env.local` | — |

## Subir (primeira vez)

```bash
# 1. infra em containers (Postgres + MinIO + cognito-local)
npm run dev:infra

# 2. schema no Postgres local (mesmas migrations de prod)
DATABASE_URL=postgresql://postgres:dev@localhost:5433/painel PG_SSL=off npm run migrate

# 3. User Pool + admin de teste no cognito-local (grava os IDs no .env.local)
npm run seed:auth
#    → admin@dev.local / admin12345
```

## Rodar o app contra o clone

No `.env.local`, aponte pro clone (ver `.env.example`, blocos comentados):

```
DATABASE_URL=postgresql://postgres:dev@localhost:5433/painel
PG_SSL=off
AUTH_MODE=cognito-local
COGNITO_ENDPOINT=http://localhost:9229
S3_BUCKET=painel-arquivos
AWS_ENDPOINT_URL=http://localhost:9000
S3_FORCE_PATH_STYLE=true
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=dev
AWS_SECRET_ACCESS_KEY=devsecret
```

```bash
npm run dev        # app com hot reload → http://localhost:3000
npm run worker     # (opcional) worker de planilhas em outro terminal
```

Login: `admin@dev.local` / `admin12345`.
Pra voltar pro fluxo Supabase atual: `AUTH_MODE=supabase` + `DATABASE_URL` do
Supabase (e remova/comente as vars de MinIO).

## Validar tudo de uma vez

```bash
npm run test:e2e-local
# ✓ login cognito-local + verificação de JWT + perfil no Postgres
# ✓ MinIO put/get + upload via presigned URL
# ✓ worker processa job da fila processing_jobs
```

## Comandos úteis

```bash
npm run migrate:status       # migrations aplicadas × pendentes
npm run dev:infra:down       # para os containers (dados persistem em volumes)
docker compose -f infra/docker-compose.dev.yml down -v   # ZERA tudo
```

Console do MinIO: http://localhost:9001 (dev / devsecret) — ver/baixar as
planilhas arquivadas.

## O que NÃO se valida local

KMS, VPC/Security Groups, IAM e TLS/Caddy são infra — valide num ambiente
`staging` na AWS (mesma stack Terraform de `infra/terraform/` com
`environment=staging`) antes de produção.

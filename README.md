# Painel de Entregas

Painel interno para acompanhar **SLA** e **DS** (Daily Service) de operações de
última milha (Shopee, Mercado Livre, J&T, Loggi, iMile), com importação de
planilhas, snapshots diários, histórico, gestão de motoristas, liberação de
pagamento e administração de usuários.

> **Status:** em migração para uma stack **100% Python**. A versão antiga
> (vanilla JS + GitHub como banco) está congelada na branch `main`; o novo
> desenvolvimento acontece em `python-migration`.

---

## Índice

1. [Stack](#stack)
2. [Arquitetura](#arquitetura)
3. [Pré-requisitos](#pré-requisitos)
4. [Setup local (passo a passo)](#setup-local-passo-a-passo)
5. [Rodar o projeto](#rodar-o-projeto)
6. [Banco de dados](#banco-de-dados)
7. [Conectar pelo DBeaver](#conectar-pelo-dbeaver)
8. [Variáveis de ambiente](#variáveis-de-ambiente)
9. [Estrutura de pastas](#estrutura-de-pastas)
10. [Migrations](#migrations)
11. [Build e Deploy (Render)](#build-e-deploy-render)
12. [Roadmap](#roadmap)
13. [Troubleshooting](#troubleshooting)

---

## Stack

| Camada | Tecnologia | Observação |
|---|---|---|
| Front + Back | **[Reflex](https://reflex.dev)** | Pure Python que compila para **React + Next.js + Tailwind**. É um FastAPI por baixo → front e back num só codebase. |
| UI / gráficos | Componentes Reflex + **`rx.recharts`** | Substituem HTML/CSS/Chart.js da versão antiga. |
| ORM / models | **SQLModel** via `rx.Model` | SQLAlchemy + Pydantic. |
| Migrations | **Alembic** (`reflex db ...`) | Geradas a partir dos models. |
| Banco (dev) | **SQLite** | Zero setup — roda na hora. |
| Banco (prod) | **Supabase Postgres** | Permanente, gratuito, acessível externamente (DBeaver). |
| Auth | **Supabase Auth** | JWT validado no backend (PyJWT). Senhas nunca tocam o app. |
| Parsing | **pandas + openpyxl** | CSV (SLA) e XLSX (DS / histórico) processados no servidor. |
| Hospedagem | **Render** (web service free, Docker) | Banco fica no Supabase, não no Render. |

Por que esta stack e quais alternativas foram descartadas: ver
[PLANO-MIGRACAO-PYTHON.md](PLANO-MIGRACAO-PYTHON.md).

---

## Arquitetura

```
┌──────────────────────── App Reflex (1 codebase Python) ───────────────────┐
│  components/ (UI bonita)  ── websocket ──  states/ (event handlers)        │
│                                                  │                          │
│                                          services/ (parsing, calc, escopo) │
│                                                  │                          │
│                                          models/ (rx.Model / SQLModel)      │
└──────────────────────────────────────────────────┼────────────────────────┘
                                                     │
                          dev: SQLite  ◄─────────────┤────────► Supabase
                                                     │          (Postgres + Auth)
                                              ViaCEP (proxy + cache)
```

- **Sem REST API entre nosso front e back**: a UI chama métodos Python (event
  handlers) direto via websocket.
- **Escopo/permissões** aplicados nos `services/` antes de qualquer query, e
  reforçados por **RLS** no Postgres (ver [sql/02_rls.sql](sql/02_rls.sql)).

---

## Pré-requisitos

| Ferramenta | Versão | Notas |
|---|---|---|
| **Python** | **3.13** | ⚠️ **NÃO use 3.14** — o Reflex quebra no build (Pydantic v1 × typing do 3.14). |
| Git | qualquer | — |
| DBeaver | qualquer | Só para inspecionar o banco (opcional em dev). |
| Conta Supabase | grátis | Só necessária para produção / DBeaver. Dev roda em SQLite. |

Instalar o Python 3.13 no Windows:

```powershell
winget install Python.Python.3.13
# confira:
py -3.13 --version
```

### Extensões VSCode recomendadas

- `ms-python.python` (Python)
- `ms-python.vscode-pylance` (tipos/autocomplete)
- `charliermarsh.ruff` (lint + format)
- `ms-azuretools.vscode-docker` (Dockerfile)

---

## Setup local (passo a passo)

```powershell
# 1. clonar e entrar na branch de desenvolvimento
git clone <repo>
cd painel-entregas
git checkout python-migration

# 2. ambiente virtual com Python 3.13
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1

# 3. dependências
pip install -r requirements.txt

# 4. (opcional) variáveis de ambiente — só se for usar Supabase
copy .env.example .env
#    edite .env com os valores do seu projeto Supabase
```

Em dev, **sem `.env`**, o app usa SQLite automaticamente — você pode pular o
passo 4 e já rodar.

---

## Rodar o projeto

```powershell
reflex run
```

- Front: **http://localhost:3000**
- Backend: http://localhost:8000 (interno)

O primeiro `reflex run` baixa o runtime de front (Bun) e compila — pode demorar
um pouco. Depois é rápido e tem **hot reload**.

---

## Banco de dados

| Ambiente | Banco | Como é definido |
|---|---|---|
| **Dev** | SQLite (`painel_dev.db`, criado sozinho) | padrão quando não há `DATABASE_URL` |
| **Prod** | Supabase Postgres | via `DATABASE_URL` no `.env` / Render |

O schema vive em dois lugares equivalentes:

1. **Models** em [painel/models/](painel/models/) → tabelas criadas por
   `reflex db migrate`.
2. **SQL** em [sql/](sql/) para aplicar direto no Supabase e para versionar
   RLS/seed (que o Alembic não gera):
   - [sql/01_schema.sql](sql/01_schema.sql) — todas as tabelas, índices e constraints.
   - [sql/02_rls.sql](sql/02_rls.sql) — Row Level Security (isolamento por base).
   - [sql/03_seed.sql](sql/03_seed.sql) — operações e bases iniciais.

**Aplicar no Supabase:** abra o **SQL Editor** do projeto e rode os três arquivos
na ordem (01 → 02 → 03).

---

## Conectar pelo DBeaver

1. No Supabase: **Project Settings → Database → Connection string → Session pooler**.
2. No DBeaver: **New Connection → PostgreSQL**, preencha (nos campos, não na URL):

| Campo | Valor |
|---|---|
| Host | `aws-0-<regiao>.pooler.supabase.com` |
| Port | `5432` |
| Database | `postgres` |
| Username | `postgres.<ref-do-projeto>` |
| Password | a *Database password* do Supabase |
| SSL | habilitado (`sslmode=require`) |

> A *anon key* do app **não** conecta no Postgres — use a senha do banco
> (Settings → Database → Reset database password, se não tiver).

---

## Variáveis de ambiente

Template completo em [.env.example](.env.example). Resumo:

| Variável | Para quê | Onde achar |
|---|---|---|
| `DATABASE_URL` | conexão do app (SQLAlchemy/psycopg) | Supabase → Database → Session pooler |
| `SUPABASE_URL` | endpoint do projeto | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | login/REST (pública) | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | criar usuários (admin) — **só no servidor** | Supabase → Settings → API |
| `SUPABASE_JWT_SECRET` | validar JWT no backend | Supabase → Settings → API → JWT |
| `ADMIN_EMAIL` | e-mail tratado como admin | você define |
| `API_URL` | URL pública do app (prod) | Render injeta |

Nada disso vai para o browser — no Reflex os segredos ficam no backend Python.
O `.env` está no `.gitignore` e **não deve ser commitado**.

---

## Estrutura de pastas

```
painel-entregas/
├── rxconfig.py            # config Reflex (db_url, api_url)
├── requirements.txt
├── .env.example           # template de segredos
├── Dockerfile / Caddyfile # deploy em container (Render)
├── painel/                # app Reflex
│   ├── painel.py          # rx.App + páginas
│   ├── models/            # rx.Model (SQLModel)
│   ├── shared/            # constantes, permissões, enums
│   ├── services/          # parsing, cálculo, escopo, retenção
│   ├── auth/              # login Supabase + AuthState
│   ├── states/            # rx.State por domínio
│   ├── components/        # UI reutilizável (tema, sidebar, cards, charts)
│   └── pages/             # páginas
├── sql/                   # schema + RLS + seed (Supabase)
├── scripts/               # migrate_legacy.py
├── tests/
├── assets/                # logos
└── PLANO-*.md             # documentos de planejamento
```

> A árvore acima é o alvo; nem todas as pastas existem ainda — estão sendo
> criadas fase a fase (ver [Roadmap](#roadmap)).

---

## Migrations

Geradas pelo Alembic via Reflex, a partir dos models:

```powershell
reflex db makemigrations --message "descrição da mudança"
reflex db migrate
```

Em produção, aponte `DATABASE_URL` para o Supabase antes de migrar. RLS e seed
(que o Alembic não cobre) são aplicados pelos arquivos em [sql/](sql/).

---

## Build e Deploy (Render)

O app vira um container único (Caddy serve o front + proxy do backend numa porta
só), publicado como **web service free** no Render. O banco **não** é o do
Render (que expira em 30 dias) — é o Supabase.

1. **Render → New → Web Service → Docker**, conectar o repo (branch de deploy).
2. Plano **Free**.
3. **Environment**: setar `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `API_URL`.
4. (Opcional) **Render Cron Job** para o job de retenção (purga >180 dias).

**Cold start:** o serviço free dorme após 15 min ocioso; a 1ª request seguinte
demora ~1 min. Mitigação opcional: um cron externo batendo em `/ping` em horário
comercial.

> O Dockerfile/Caddyfile atuais são um ponto de partida e serão validados na
> fase de deploy.

---

## Roadmap

Fases detalhadas em [PLANO-MIGRACAO-PYTHON.md §9](PLANO-MIGRACAO-PYTHON.md).
Resumo:

- **Fase 0** — setup + landing rodando local + deploy "hello" no Render ← *atual*
- **Fase 1** — models + migrations + seed
- **Fase 2** — auth Supabase + permissões + escopo
- **Fase 3** — uploads + parsing + cálculo SLA/DS
- **Fase 4** — snapshots + SLA/DS + liberações + CEP + retenção
- **Fase 5** — tema + componentes bonitos
- **Fase 6-7** — todas as páginas (monitoramento, histórico, motoristas, SLA/DS, liberação)
- **Fase 8** — admin (usuários, bases, permissões)
- **Fase 9** — migração dos dados legados + cutover + revogar `GH_TOKEN`

Contexto e mapeamento da versão antiga:
[FLUXO-DE-DADOS.md](FLUXO-DE-DADOS.md), [PLANO.md](PLANO.md),
[PLANO-MIGRACAO-DB.md](PLANO-MIGRACAO-DB.md), [PLANO-USUARIOS.md](PLANO-USUARIOS.md).

---

## Troubleshooting

| Problema | Causa / solução |
|---|---|
| `reflex` falha ao instalar/buildar | Você está no **Python 3.14**. Crie o venv com **3.13** (`py -3.13 -m venv .venv`). |
| Front não conecta no backend | `api_url` errado em `rxconfig.py` / env `API_URL`. |
| DBeaver não conecta no Supabase | Use o **Session pooler** (porta 5432) e a **senha do banco**, não a anon key. |
| App não acha o banco em prod | `DATABASE_URL` não setada — cai para SQLite. Configure no Render. |
| Primeira request lenta em prod | Cold start do Render free (esperado). |
| Porta 3000/8000 ocupada | Feche instâncias antigas do `reflex run` ou troque a porta. |
```

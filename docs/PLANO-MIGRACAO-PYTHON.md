# Plano de Migração — Stack 100% Python (Reflex + Supabase)

> Substitui a stack TS (Fastify + Prisma + Vite) dos planos anteriores por **Python de ponta a ponta**.
> Decisões fechadas em 2026-06-06.
> Reaproveita o modelo de dados e regras de [PLANO-MIGRACAO-DB.md](PLANO-MIGRACAO-DB.md) e [PLANO-USUARIOS.md](PLANO-USUARIOS.md).
> Documento de planejamento — sem mudança de código nesta etapa.

---

## 0. Decisões fechadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Linguagem | **Python** (front + back) | Objetivo do projeto; parsing com pandas/openpyxl |
| Framework full-stack | **Reflex** | Pure Python que compila p/ **React+Next+Tailwind**; bonito e altamente customizável; **é um FastAPI por baixo** → front e back num só app |
| ORM / migrations | **SQLModel** via `rx.Model` + **Alembic** (`reflex db`) | Já embutido no Reflex; mesmo schema dos planos anteriores |
| Validação | **Pydantic v2** | Nativo (SQLModel e FastAPI usam) |
| Parsing planilhas | **pandas + openpyxl** (XLSX) / `csv`/pandas (CSV) | Server-side, robusto |
| Gráficos | **`rx.recharts`** (nativo do Reflex) | Substitui Chart.js, em Python |
| Auth | **Supabase Auth** (mantida) | Sem migração de senha; app valida JWT |
| Banco | **Supabase Postgres** | Permanente, grátis, conecta no **DBeaver** via Session Pooler |
| Hospedagem do app | **Render** (web service free, container Docker) | Grátis; aceitar cold start (~1min após 15min ocioso) |
| Cache de estado prod | **Redis opcional** (dispensável p/ ≤10 usuários, 1 worker) | Só necessário com múltiplos workers |

### O que NÃO usar (e por quê)

- **Postgres do Render (free):** ❌ **expira em 30 dias** e os dados são apagados. O banco fica no Supabase; o Render hospeda só o app.
- REST API própria para o nosso front: ❌ desnecessária — no Reflex o front chama *event handlers* Python direto via websocket. (FastAPI routes só se houver integração externa.)

---

## 1. Como o Reflex muda o desenho (vs. plano TS)

No plano TS havia **2 apps** (web Vite + API Fastify) e uma **REST API** que o front consumia. No Reflex isso colapsa:

```
                 ANTES (plano TS)                      AGORA (Reflex)
   ┌─────────┐  fetch /api  ┌──────────┐        ┌──────────────────────────┐
   │ Web Vite│ ───────────► │ Fastify  │        │  App Reflex (1 codebase)  │
   │  (JS)   │ ◄─────────── │  (TS)    │        │  ┌────────────────────┐  │
   └─────────┘   JSON       └────┬─────┘        │  │ Componentes (UI)   │  │
                                 │              │  │  ↕ websocket        │  │
                            ┌────▼─────┐        │  │ State (event hdlrs) │  │
                            │ Postgres │        │  │  ↕                  │  │
                            └──────────┘        │  │ Services + Models   │  │
                                                │  └─────────┬──────────┘  │
                                                └────────────┼─────────────┘
                                                        ┌────▼─────┐
                                                        │ Supabase │ (PG + Auth)
                                                        └──────────┘
```

- **Páginas** = funções que retornam componentes Reflex.
- **Estado/lógica** = classes `rx.State` com *event handlers* (substituem `state.js`, `render.js`, `admin.js`, `app.js`).
- **"Endpoints"** do plano TS (§5 de PLANO-MIGRACAO-DB.md) viram **métodos de State + funções de service**. A tabela de endpoints continua válida como mapa de *capacidades*, mas não há mais HTTP entre nosso front e back.
- **Escopo/permissões** (PLANO-USUARIOS.md) são aplicados **dentro dos services**, antes de qualquer query — mesma regra firme: nada fora do escopo do usuário.

---

## 2. Estrutura do projeto

```
painel-entregas/
├── rxconfig.py                      ← config Reflex (db_url Supabase, api_url, tema)
├── requirements.txt                 ← reflex, sqlmodel, pandas, openpyxl, httpx, pyjwt, python-dotenv
├── .env                             ← segredos (NÃO commitar): DATABASE_URL, SUPABASE_*, etc.
├── .env.example
├── Dockerfile                       ← container único (Caddy serve front + proxy backend)
├── alembic.ini / alembic/           ← migrations (geradas por `reflex db`)
│
├── assets/                          ← estáticos servidos pelo front (logo, logos de operação)
│   ├── logo.png
│   └── operacoes/{shopee,meli,jt,loggi,imile}.png
│
├── painel/                          ← pacote principal do app
│   ├── painel.py                    ← rx.App, registro de páginas e tema global
│   │
│   ├── models/                      ← rx.Model (SQLModel) — 1 arquivo por entidade
│   │   ├── user.py                  ← User, UserBase
│   │   ├── operacao.py              ← Operacao, Base
│   │   ├── driver.py                ← Driver
│   │   ├── upload.py                ← Upload, Package
│   │   ├── snapshot.py              ← Snapshot, SnapshotDriver
│   │   ├── sla_ds.py                ← SlaDsRecord
│   │   ├── liberacao.py             ← Liberacao
│   │   └── cep.py                   ← CepCache
│   │
│   ├── shared/                      ← constantes e tipos (porta do constants.js + planos)
│   │   ├── constants.py             ← BASE_ALIASES, STATUS_MAP, STATUS_FINALIZADORES, OP_LABELS
│   │   ├── perms.py                 ← PERMS, ROLE_PRESETS, has_perm(), LANDING_PAGE
│   │   └── enums.py                 ← Role, BaseScope, PackageStatus, LiberacaoStatus, UploadKind
│   │
│   ├── services/                    ← lógica de negócio pura (testável sem UI)
│   │   ├── calc.py                  ← calc_sla(), calc_ds() (porta de calcs.js)
│   │   ├── parsers.py               ← parse_csv_sla, parse_xlsx_ds, parse_xlsx_sla_ds (pandas)
│   │   ├── aliases.py               ← resolve_base()
│   │   ├── scope.py                 ← base_scope_filter(user) → where SQLModel
│   │   ├── snapshots.py             ← upsert por (base, dia)
│   │   ├── sla_ds.py                ← upsert por (base, dia)
│   │   ├── ceps.py                  ← proxy ViaCEP + cache em CepCache
│   │   └── retention.py             ← purga >180d (job)
│   │
│   ├── auth/
│   │   ├── supabase_auth.py         ← login/logout via Supabase, validação de JWT (pyjwt)
│   │   └── state.py                 ← AuthState (sessão por conexão; gate de páginas)
│   │
│   ├── states/                      ← rx.State por domínio (UI + event handlers)
│   │   ├── monitoramento_state.py   ← uploads, calc ao vivo, snapshot
│   │   ├── historico_state.py
│   │   ├── motoristas_state.py
│   │   ├── sla_ds_state.py
│   │   ├── liberacao_state.py
│   │   └── admin_state.py           ← users, bases, permissões
│   │
│   ├── components/                  ← componentes reutilizáveis e bonitos
│   │   ├── theme.py                 ← paleta, tipografia (DM Sans/Mono), radius, sombras
│   │   ├── layout.py                ← shell: sidebar + topbar + área de conteúdo
│   │   ├── sidebar.py               ← itens filtrados por has_perm(VIEW_*)
│   │   ├── kpi_card.py              ← cartões de KPI (SLA%, DS%, gauges)
│   │   ├── data_table.py            ← tabela com busca/ordenação (porta de ui.js)
│   │   ├── charts.py                ← wrappers de rx.recharts
│   │   └── upload_box.py            ← rx.upload estilizado
│   │
│   └── pages/                       ← 1 função por página
│       ├── login.py
│       ├── sup_home.py
│       ├── sup_hoje.py              ← import CSV/XLSX + KPIs + snapshot
│       ├── sup_historico.py
│       ├── sup_motoristas.py
│       ├── sup_liberacao.py
│       ├── sla_ds.py
│       └── admin_*.py               ← dashboard, clients, user-detail, bases
│
├── scripts/
│   └── migrate_legacy.py            ← importa dados do GitHub + Supabase p/ o banco novo
└── tests/
    ├── test_calc.py
    ├── test_parsers.py
    └── test_scope.py
```

---

## 3. Modelo de dados

**Reaproveita integralmente** o schema enxuto de [PLANO-MIGRACAO-DB.md §2](PLANO-MIGRACAO-DB.md) com os deltas de usuários de [PLANO-USUARIOS.md §1](PLANO-USUARIOS.md) (`UserBase`, `extraPerms`, `deniedPerms`, `baseScope`). Só muda a **sintaxe**: Prisma → `rx.Model` (SQLModel).

### Exemplo de tradução (Prisma → rx.Model)

```python
# painel/models/snapshot.py
import reflex as rx
from datetime import datetime
from decimal import Decimal

class Snapshot(rx.Model, table=True):
    base_id: str = rx.Field(foreign_key="base.id", index=True)
    user_id: str | None = None
    ts: datetime
    data_pt_br: str            # '22/05/2026'
    hora: str
    sla_pct: Decimal
    ds_pct: Decimal
    total: int
    entregues: int
    em_rota: int
    ocorrencias: int
    faltantes: int
    devolvidos: int
    outros: int = 0
    upload_csv_id: str | None = None
    upload_xlsx_id: str | None = None
    created_at: datetime = rx.field(default_factory=datetime.utcnow)
    updated_at: datetime = rx.field(default_factory=datetime.utcnow)
    # Garantia "1 snapshot por base por dia" → UniqueConstraint(base_id, data_pt_br)
    # via __table_args__ (UPSERT no service)
```

Tabelas (mesmas dos planos): `User`, `UserBase`, `Operacao`, `Base`, `Driver`, `Upload`, `Package`, `Snapshot`, `SnapshotDriver`, `SlaDsRecord`, `Liberacao`, `CepCache`.

Constraints únicas importantes (UPSERT): `Snapshot(base_id, data_pt_br)`, `SlaDsRecord(base_id, data_pt_br)`, `Package(base_id, codigo)`, `Base(operacao_id, slug)`, `Driver(base_id, normalized_key)`.

### Migrations

```bash
reflex db makemigrations --message "schema inicial"
reflex db migrate
```

Aponta para o Supabase via `db_url` (ver §6). As `UniqueConstraint` que o autogen do Alembic não pegar entram manualmente no script de migration.

### Retenção (igual aos planos)

`SlaDsRecord`, `Driver`, `Liberacao`, `CepCache` = indeterminado. `Snapshot`/`SnapshotDriver`/`Package` = 180 dias. Job de purga diário 03:00 BRT → `services/retention.py`, agendado como **Render Cron Job** (gratuito) ou APScheduler dentro do app.

---

## 4. Autenticação (Supabase Auth mantida)

```
Tela login (componente Reflex)
   │ on_submit → AuthState.login(email, senha)
   ▼
auth/supabase_auth.py
   ├─ POST {SUPABASE_URL}/auth/v1/token?grant_type=password   (httpx)
   │    → { access_token (JWT), user }
   ├─ valida/decodifica JWT com SUPABASE_JWT_SECRET (pyjwt)
   ├─ carrega o User do nosso Postgres (id == auth.users.id)
   └─ grava em AuthState: user_id, email, role, base_scope, bases[], perms[]
          │
          ▼
   redireciona p/ LANDING_PAGE[role]; sidebar montada por has_perm(VIEW_*)
```

- **AuthState** vive por conexão (estado de sessão do Reflex). Cada página protegida checa `AuthState.is_authed` no `on_load` e redireciona para `/login` se não estiver.
- **Reset de senha**: fluxo nativo do Supabase (email).
- `SUPABASE_SERVICE_ROLE_KEY` (criar usuários via Admin API) e `SUPABASE_JWT_SECRET` ficam **só no `.env` do servidor** — nunca no bundle do front (no Reflex, o front é compilado e os secrets ficam no backend Python).

---

## 5. Permissões, escopo e isolamento

Porta direta de [PLANO-USUARIOS.md](PLANO-USUARIOS.md):

- `shared/perms.py`: `PERMS`, `ROLE_PRESETS`, `has_perm(user, perm)`, `LANDING_PAGE`.
- `services/scope.py`: `base_scope_filter(user)` devolve o `where` SQLModel (ALL → tudo; OP_WIDE → operação; SINGLE → bases do usuário). **Todo service aplica esse filtro antes da query.**
- **RLS no Postgres** (cinto + suspensório): mesmas policies SQL do plano (§3 de PLANO-USUARIOS) — escrita só pelo backend com service role; leitura protegida por `auth.uid()`.

> Regra firme mantida: nenhum service devolve dado fora do escopo, mesmo se a UI pedir. Pedido inválido → erro/observação na UI, sem vazar dado.

---

## 6. Hospedagem — passo a passo

### 6.1 Banco: Supabase Postgres

1. Usar o projeto Supabase já existente (mesmo do Auth).
2. **String para o app (Reflex/SQLAlchemy)** — usar o **Session Pooler** (compatível IPv4, conexões longas):
   ```
   DATABASE_URL=postgresql+psycopg://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres
   ```
   (em `rxconfig.py`: `db_url=os.environ["DATABASE_URL"]`)
3. A pausa por inatividade do Supabase (1 semana sem requests) **não acontece** porque o app/cron batem no banco direto.

### 6.2 Conectar pelo DBeaver (externo)

No painel Supabase: **Project Settings → Database → Connection string → Session pooler**. No DBeaver, **nova conexão PostgreSQL** e preencher nos campos (não na URL):

| Campo | Valor |
|---|---|
| Host | `aws-0-<regiao>.pooler.supabase.com` |
| Port | `5432` (session pooler) |
| Database | `postgres` |
| Username | `postgres.<ref>` |
| Password | a senha do banco do Supabase |
| SSL | habilitado (`sslmode=require`) |

> Dica: se um dia migrar o banco para Neon, no DBeaver configurar **Keep-Alive = 60s** (Edit Connection → Initialization) por causa do scale-to-zero. No Supabase não é necessário.

### 6.3 App: Render (web service free, Docker)

O Reflex em produção tem 2 processos (frontend estático :3000 + backend websocket :8000). O Render free expõe **uma porta**, então usamos o **Dockerfile unificado** do Reflex (`docker-example`), que sobe **Caddy** servindo o front e fazendo proxy do backend numa porta só.

1. `Dockerfile` baseado no exemplo oficial do Reflex (Caddy + `reflex run --env prod`).
2. Em `rxconfig.py`, `api_url` aponta para a URL pública do Render (Render injeta o host).
3. No Render: **New → Web Service → Docker**, conectar o repo, plano **Free**.
4. **Environment** (secrets, só no servidor): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`.
5. **Render Cron Job** separado (free) para `python -m painel.services.retention` às 03:00 BRT.

**Cold start:** após 15 min ocioso, a 1ª request demora ~1 min. Mitigação opcional: cron externo (ex. cron-job.org) batendo num `/health` a cada ~10 min em horário comercial — mantém quente sem estourar as 750h/mês.

---

## 7. Mapeamento "de onde vem → para onde vai"

### Dados (igual aos planos)

| Origem atual | Destino |
|---|---|
| `operacoes/<op>/<base>/logs.json` | `Snapshot` + `SnapshotDriver` (último do dia; 180d) |
| `operacoes/shopee/sla-ds-history.json` | `SlaDsRecord` (indeterminado) |
| `localStorage['cep_cache']` | `CepCache` |
| Supabase `profiles` | `User` (+ `UserBase`) |
| Supabase `liberacoes` | `Liberacao` |
| `constants.js` (aliases/status/roles) | `shared/constants.py` + `shared/perms.py` |
| Logos | `assets/` |
| GitHub-as-DB + `GH_TOKEN` | **eliminados** |

### Código (JS → Python/Reflex)

| Arquivo JS atual | Vira |
|---|---|
| `state.js`, `app.js` | `rx.State` + `AuthState` + roteamento do Reflex |
| `calcs.js` | `services/calc.py` |
| `data.js` (parse CSV/XLSX, CEP) | `services/parsers.py` + `services/ceps.py` |
| `github.js`, `storage.js` | **removidos** (banco real via SQLModel) |
| `auth.js` | `auth/supabase_auth.py` |
| `render.js`, `ui.js` | `components/*` (tabelas, cards, charts) |
| `pages.js` | `pages/*` |
| `admin.js` | `states/admin_state.py` + `pages/admin_*.py` |
| `print.js` ("gerar print") | página de relatório + `window.print()`/export (rever na Fase 7) |

---

## 8. Migração de dados legados

`scripts/migrate_legacy.py` (rodar uma vez):

1. Lê todos `operacoes/<op>/<base>/logs.json` via raw GitHub → **último snapshot de cada dia** (180d) → `Snapshot` + `SnapshotDriver`.
2. Lê `sla-ds-history.json` → `SlaDsRecord` (sem filtro de data).
3. Lê Supabase `profiles` → `User` (id == auth.users.id) + `UserBase`; `baseScope = OP_WIDE` p/ coordenador, `ALL` p/ admin, senão `SINGLE`.
4. Lê Supabase `liberacoes` → `Liberacao`.
5. Relatório de contagens antes/depois.

Cutover: app novo em paralelo (~1 semana) → janela de manutenção → rodar script → trocar URL → **revogar `GH_TOKEN`** → manter repo antigo congelado 30 dias.

---

## 9. Plano de fases

| # | Fase | Critério de saída |
|---|---|---|
| 0 | Setup: `reflex init`, `rxconfig.py` apontando p/ Supabase, Dockerfile, deploy "hello" no Render | URL pública abre app vazio; DBeaver conecta no banco |
| 1 | Models (`rx.Model`) + migrations + constraints + seed (Operacao/Base) | `reflex db migrate` cria tabelas; visíveis no DBeaver |
| 2 | Auth Supabase + AuthState + gate de páginas + `shared/perms.py` + `services/scope.py` | Login real entra; sidebar reflete permissões; escopo barra base alheia |
| 3 | `services/parsers.py` (3 parsers pandas) + `calc.py` + uploads (`rx.upload`) | Subir CSV/XLSX calcula SLA/DS ao vivo |
| 4 | Snapshots (UPSERT/dia) + SLA/DS + liberações + CEP proxy + job de retenção | Snapshot do dia faz upsert; cron de purga roda |
| 5 | Tema + layout + componentes bonitos (sidebar, KPI cards, gauges, tabelas, charts recharts) | Visual profissional e consistente; dark/light se desejado |
| 6 | Páginas monitoramento (Home, Hoje, Histórico, Motoristas) end-to-end | Fluxo completo contra o banco |
| 7 | SLA/DS, Liberação, "gerar print"/relatório | Todas as páginas atuais cobertas |
| 8 | Admin (users, bases, tela de permissões com extra/denied) | CRUD de usuários + permissões individuais |
| 9 | `migrate_legacy.py` + cutover + revogar `GH_TOKEN` | App 100% no novo, sem token exposto |

> Estimativa: comparável ao plano TS (~3-4 semanas, 1 dev). Reflex economiza por unificar front+back, mas tem curva de aprendizado inicial (conceito de State/event handlers).

---

## 10. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Cold start do Render free (~1min) | Cron ping em horário comercial; ou Fly.io; ou upgrade futuro |
| Estado Reflex em memória com múltiplos workers | Manter **1 worker** (escala atual basta); se crescer, ligar **Redis** |
| Curva de aprendizado do Reflex | Fase 0/5 isolam o aprendizado de UI antes da lógica pesada |
| Parser pandas divergir do XLSX.js antigo | Comparar saída lado a lado em 3+ arquivos reais antes do cutover |
| Limite ViaCEP | Manter cache em `CepCache` + lote controlado (igual hoje) |
| Supabase pausa por inatividade | App/cron mantêm o banco ativo |
| `GH_TOKEN` exposto durante o paralelo | Revogar imediatamente no cutover |
| Deploy 2-portas do Reflex no Render | Dockerfile unificado (Caddy numa porta só) — padrão oficial |

---

## 11. Pontos abertos

1. **Tema visual**: definir paleta/identidade (cores, logo, dark mode?) na Fase 5 — base do "extremamente bonito".
2. **Redis agora ou depois?** Recomendo **depois** (só se múltiplos workers).
3. **Manter cron ping** contra cold start desde o início ou só se incomodar? Recomendo ligar já (custa ~nada).
4. **"Gerar print"**: confirmar se basta `window.print()` de uma página de relatório ou se precisa PDF server-side.

---

## Fontes da pesquisa de hospedagem/stack

- Render free (spin-down 15min, 750h): https://render.com/docs/free
- Render Postgres free expira em 30 dias: https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90
- Supabase — conectar/DBeaver: https://supabase.com/docs/guides/database/dbeaver
- Supabase free (pausa por inatividade, conexões): https://aiagencyplus.com/supabase-free-tier-limits/
- Neon free (alternativa de banco): https://neon.com/guides/dbeaver-hosted-postgres
- Reflex self-hosting (2 processos, Docker, `reflex run --env prod`): https://reflex.dev/docs/hosting/self-hosting/
- Reflex database (rx.Model/SQLModel/Alembic, `db_url`): https://reflex.dev/docs/database/overview/
- Comparativo de frameworks Python front: https://reflex.dev/blog/top-python-web-frameworks/

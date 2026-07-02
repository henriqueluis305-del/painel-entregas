# Análise estrutural do banco — diagnóstico e otimização

**Julho/2026.** Base: schema real (`migrations/0001_baseline.sql`, dump do Supabase), volumetria de produção medida em 01/07/2026 e o consumo real das queries (pós-conversão pra SQL puro na branch `feat/aws-migration`).

Estado: 28 tabelas, ~26 MB total. Volume pequeno — as otimizações aqui são de **correção estrutural e preparo pra escala/financeiro**, não de incêndio de performance.

| # | Tema | Severidade | Status |
|---|---|---|---|
| 1 | Tabelas legadas (vão reviver): normalização preventiva | **estrutural** | ✅ migration 0005 aplicada |
| 1b | Redundâncias entre legadas × shopee_* | **decisão de design** | matriz abaixo — decidir antes de reativar |
| 2 | Data como texto `'DD/MM/YYYY'` | **estrutural, o mais grave** | mitigado (migration 0004 aplicada; 0005 estende às legadas) |
| 3 | "Dia mais recente" via `updated_at` | bug latente | corrigir no código (follow-up) |
| 4 | Índices fora do padrão de consumo | performance futura | corrigido (migration 0003 aplicada) |
| 5 | Timestamps sem fuso (era Alembic, 12 colunas) | consistência | ✅ corrigido na 0005 (timestamptz em tudo) |
| 6 | Crescimento sem retenção (event/outros) | operação | política via worker (proposta) |
| 7 | Formas normais — desvios conscientes | documentação | documentado abaixo |

---

## 1. Tabelas legadas — análise de normalização (vão receber dados de novo)

`package`, `upload`, `snapshot`, `snapshot_driver`, `sla_ds_record`, `liberacao`, `user_base` estão vazias hoje mas **serão reativadas**. Vazias = janela de ouro: mudança de tipo/constraint é instantânea agora e vira migração com backfill+lock depois. A **migration 0005** (aplicada em prod e local) endureceu tudo que dava pra endurecer sem mudar semântica:

### 1.1 O que a 0005 corrigiu (por quê)

| Fix | Tabelas | Problema que evitava |
|---|---|---|
| `timestamp` → `timestamptz` (12 colunas) | todas as legadas + app_user/base/operacao/cep_cache | era Alembic gravava sem fuso; metade do banco tinha fuso e metade não — comparação entre eras daria hora errada |
| `json` → `jsonb` (`extra_perms`, `denied_perms`) | app_user | `json` é texto cru: sem índice, comparação por string; inconsistente com `config jsonb` da operacao |
| CHECK em `role` e `base_scope` | app_user | texto livre (só `approval_status` tinha CHECK); typo em role viraria usuário sem permissão silencioso. Valores validados contra produção antes |
| default de `role`: `'SUPERVISOR'` → `'USER'` | app_user | default antigo dava permissão a mais por omissão — o cadastro público nasce USER |
| `data date` gerada + índice (padrão 0004) | snapshot, sla_ds_record | mesmas patologias do `data_pt_br` texto (§2) — nascem certas quando reviverem |
| UNIQUE `(upload_id, codigo)` | package | mesmo pacote 2× no mesmo upload = dado sujo silencioso (não tinha unique NENHUM além da PK) |
| UNIQUE `(snapshot_id, driver_id)` | snapshot_driver | mesmo motorista 2× na mesma foto |
| `double precision` → `numeric(5,2)` (4 colunas de %) | snapshot, sla_ds_record | float pra percentual exibido = `93.30000000000001`; alinha com `numeric(5,2)` das shopee_* |
| Índices de FK/consumo | liberacao, package, snapshot | FKs sem índice (Postgres não cria sozinho) |

### 1.2 Normalização por tabela (forma normal + problemas restantes)

- **`upload`** — 3NF ok (metadados de arquivo, tudo depende da PK; CHECK de `kind` já existia). Restante: nada estrutural. Quando reviver, considerar coluna `s3_key` (original no bucket, padrão do fluxo novo).
- **`package`** — 3NF ok após unique. `status` texto livre (domínio aberto — CHECK quando os valores do novo fluxo estiverem definidos).
- **`snapshot`** — dois desvios de 3NF **documentados, não corrigidos** (decisão de quem reativar):
  - `hora varchar` é derivável de `ts` (dependência transitiva) — redundância de exibição; recomendo preencher sempre via `to_char(ts, 'HH24:MI')` ou parar de gravar;
  - `sla_pct`/`ds_pct` são deriváveis dos contadores (`entregues/total`) — armazenar valor derivado arrisca inconsistência; ou grava sempre recalculado no mesmo INSERT, ou vira coluna gerada;
  - `upload_csv_id` + `upload_xlsx_id` (duas FKs nullable por tipo de arquivo) — padrão "grupo repetido"; se um dia houver 3º arquivo, virar junção `snapshot_upload(snapshot_id, upload_id, papel)`. Com 2 tipos fixos, tolerável.
- **`sla_ds_record`** — mesma observação dos `pct` deriváveis (`sla_pct` = f(`sla_ent`,`sla_rec`)). `ts` (momento da captura) + `data` (dia de negócio) NÃO são redundantes entre si — papéis distintos, ok.
- **`snapshot_driver`** — espelho exato de `shopee_ds_driver` (mesmas 4 métricas + `driver_name` snapshot). Normalização ok; redundância conceitual → §1.3.
- **`liberacao`** — 3NF ok. `status` texto livre: fechar domínio (CHECK) quando os estados do fluxo novo existirem.
- **`user_base`** — junção pura `(user_id, base_id)` com PK composta: **a tabela mais normalizada do banco**. Problema não é ela — é coexistir com outro modelo de acesso (§1.3).

### 1.3 Matriz de redundância — legadas × shopee_* (decidir ANTES de reativar)

O risco real não é forma normal — é **a mesma entidade do mundo real modelada 2–3×**. Cada par abaixo precisa de um dono claro antes dos dados voltarem:

| Entidade real | Modelo legado | Modelo novo | Conflito / recomendação |
|---|---|---|---|
| **Pacote** | `package` (linha por import, upload_id NOT NULL) | `shopee_package` (estado atual, upsert por `(base_id,codigo)`) + `shopee_package_event` (histórico) | Mesma entidade, ciclos de vida diferentes. Se `package` voltar como *staging de import cru* → ok, papéis distintos (documentar). Se voltar como "estado do pacote" → **duplicação direta**; usar shopee_package e aposentar |
| **Upload/arquivo** | `upload` (1 linha/arquivo, contadores parsed/kept/rejected, por base) | `shopee_upload_log` (1 linha/LOTE, `filenames` **string com vírgulas** ⚠, `user_email` sem FK ⚠) + `processing_jobs` (fila por arquivo) | **Três formas do mesmo fato.** A melhor estrutura é a LEGADA (1 linha/arquivo + FK de usuário). Recomendo: `upload` vira o registro canônico por arquivo (ganha `s3_key`); `shopee_upload_log` referencia `upload.id` em vez de duplicar filenames/email — o `filenames` com vírgula viola 1NF e o `user_email` cria anomalia (troca de e-mail órfã o log) |
| **Foto agregada do dia** | `snapshot` + `snapshot_driver` | `shopee_sla_record` + `shopee_ds_driver` + checkpoints | Sobreposição ~90% das colunas. Legítimo SE `snapshot` servir às operações NÃO-Shopee (genérico por base). Se reativar pra Shopee → duplicação; usar as shopee_* |
| **Acesso do usuário** | `user_base` (junção N:N explícita) | `app_user.base_scope`+`operacao_id`+`sidebar_operacoes[]` (colunas de escopo) | **Dois modelos de autorização.** Se `user_base` voltar, definir precedência (ex.: user_base = allowlist fina DENTRO do escopo) e escrever `hasPerm`/`requireOperacaoAccess` contra UM modelo só — hoje o código lê apenas as colunas de escopo |
| Motorista (nome) | `snapshot_driver.driver_name` | `shopee_ds_driver.driver_name`, `shopee_pnr.driver_name` | Igual nos dois mundos: snapshot histórico intencional — ok |

**Regra prática na reativação:** pra cada tela nova que usar uma legada, responder "quem é o dono desta entidade?" — se a resposta citar duas tabelas, uma delas referencia a outra por FK (nunca copiar colunas).

## 2. Data como texto `'DD/MM/YYYY'` (o problema estrutural central)

`data_pt_br varchar` existe em **8 tabelas ativas** (ds_driver, ds/sla/stuck_checkpoint, sla_record, sla_cidade, sla_driver_cidade, sla_outros_item). Formato de exibição gravado como dado:

- índice em `'DD/MM/YYYY'` ordena alfabeticamente, não cronologicamente → range por período no SQL é impossível sem `to_date` por linha;
- o app compensa parseando no cliente (`parseBrDate` espalhado em 4+ arquivos);
- PNR pior: dia derivado de `created_time` com `to_char(... at time zone ...)` por linha em 5 queries — expressão não indexável.

**Aplicado (migration 0004, prod + dev):** coluna **gerada** `data date` (via `br_date()`, wrapper immutable de `to_date`) nas 8 tabelas + `created_date_br date` no PNR (via `br_day()`, corte de dia em Brasília — validado: 02:30 UTC → 30/06). Índices `(base_id, data)` nas consultadas por dia. **Zero mudança no app**: ele segue gravando `data_pt_br`; o banco mantém a data tipada em sincronia.

**Follow-up de código (incremental, query a query):** trocar filtros/ordenar por `data`/`created_date_br`; eliminar `parseBrDate` e os `to_char` dos WHEREs. Longo prazo (cutover RDS): inverter a dependência — `data date` vira a coluna física e `data_pt_br` vira gerada (ou some, formatando na borda).

## 3. Bug latente: "dia mais recente" = `order by updated_at desc limit 1`

`latestDay()` (cidade-queries) e equivalentes em sla/ds/stuck-queries definem o dia exibido pelo **updated_at** do registro. Re-upload de um dia antigo (correção de planilha de ontem) faria o painel inteiro "voltar" pro dia errado.

**Correção (agora possível com a 0004):** `select max(data) ...` — semântica certa e indexada. Follow-up de código; uma linha por query.

## 4. Índices × consumo real (aplicado — migration 0003)

Padrões reais de acesso (pós-auditoria de todas as queries):

| Query | Predicado real | Índice que faltava |
|---|---|---|
| `getDriverPerformance`/ranking | `ds_driver.driver_id = $1` cruzando dias | `(driver_id) where driver_id is not null` (parcial) |
| PNR (todas as telas) | `base_id` + range de `created_time` | `(base_id, created_time)` |
| Worker poll | `status='pending' order by created_at` | parcial `(created_at) where status='pending'` — substitui o `(status, created_at)` completo |
| Uploads por usuário | `user_email` + recentes | `(user_email, created_at desc)` |

Não criado de propósito: índice pra `join cep_cache on regexp_replace(p.cep,...)` — produção tem **0 CEPs sujos** (`cep ~ '\D'` = 0), então o `regexp_replace` no join de `getCidadeConfigBase` é defensivo-morto. Follow-up de código: join direto `cc.cep = p.cep` (aí o PK de cep_cache já serve).

## 5. Consistência de tipos

- ~~`timestamp` sem fuso na era Alembic~~ → **corrigido na 0005**: as 12 colunas viraram `timestamptz` (interpretação UTC, que era o fuso do servidor que gravou).
- IDs `varchar` com `default gen_random_uuid()::text` (operacao/base): uuid nativo seria 16 bytes vs 36 e validaria formato, mas a troca cascateia por todas as FKs. **Veredito: não vale agora.** O `::text` nos filtros é no-op (coluna já é varchar). Se quiser, padronizar no cutover RDS — não antes. Bônus dessa escolha: `app_user.id text` aceita o `sub` do Cognito sem migração.
- `driver.id varchar` = ID externo Shopee → correto ser texto (chave natural de fora).

## 6. Crescimento e retenção (o "cron" que não existe)

Hoje **não há job agendado nenhum** — a "limpeza diária" do stuck é lógica (`last_backlog_date` marca o dia; a visão filtra). Quem cresce sem política:

| Tabela | Hoje | Ritmo | Política proposta |
|---|---|---|---|
| `shopee_package_event` | 49k linhas (7 MB) | ~2 eventos/pacote/dia — **maior crescimento do banco** | reter 90 dias (histórico de pacote resolvido não é consultado além do drill recente) |
| `shopee_sla_outros_item` | itemizado por dia | centenas/dia | reter 30–60 dias (só a visão do dia usa) |
| `processing_jobs` | novo | baixo | apagar `done` > 30 dias |
| `cep_cache` | 2k | estável | **não expirar** (CEP↔cidade é quase imutável; cache eterno é feature) |

**Onde rodar:** o `apps/worker` (já existe, já tem loop) ganha um tick diário de manutenção — mais simples que pg_cron/EventBridge nesta escala, e o mesmo container serve local e AWS. Esboço:

```sql
delete from shopee_package_event where observed_at < now() - interval '90 days';
delete from shopee_sla_outros_item where data < current_date - 60;
delete from processing_jobs where status='done' and finished_at < now() - interval '30 days';
```

## 7. Formas normais — o que é violação e o que é decisão

- **`driver_name` duplicado** em `shopee_ds_driver`/`shopee_pnr` (3NF: depende de `driver_id`, não da PK): **manter** — é snapshot histórico (nome no dia) + fallback pra linha sem motorista resolvido. Renomear motorista não deve reescrever histórico. Desnormalização clássica de fato imutável.
- **`sidebar_operacoes`/`extra_perms`/`denied_perms` como arrays** em `app_user` (1NF): pragmático pra preferência de UI/permissão fina; tabela associativa só se precisar consultar "quem tem a perm X" com frequência (hoje não consulta). **Manter**; nota: `sidebar_operacoes` guarda *slug* — renomear slug de operação quebra a preferência do usuário silenciosamente (usar id se isso incomodar).
- **`por_status jsonb`** em `sla_record`: agregado do dia, nunca filtrado por chave → jsonb é o tipo certo; tabela satélite seria burocracia.
- **3 tabelas de checkpoint** (ds/sla/stuck) com esqueleto igual e métricas diferentes: unificar exigiria jsonb/colunas nullable — perderia tipagem. **Manter separadas**; é particionamento vertical por métrica, não redundância.
- **`shopee_pnr.station_raw`** ao lado de `base_id`: proveniência do dado cru — correto manter.
- FKs: **completas** nas tabelas ativas (42 constraints), com `on delete cascade` nos filhos de base — ok.

## 8. Preparo pro RDS/financeiro (estrutural)

- **Schemas**: manter `public` pro monitoramento no cutover (menos risco); `financeiro` nasce em schema próprio com audit log + versionamento de cálculo (nunca UPDATE destrutivo) — já desenhado no plano AWS §9.
- **`schema_migrations`** agora versiona tudo (baseline + 0002–0004 aplicadas em prod e no clone local) — RDS nasce por replay ou por dump+`--baseline`.
- Upserts diários grandes (`shopee_package` 26k) geram bloat de update em massa — autovacuum default dá conta nesta escala; se um dia doer: `vacuum (analyze)` pós-upload no worker.

## Estado das ações

| Ação | Onde | Status |
|---|---|---|
| Índices de consumo real | `0003` | ✅ aplicada (prod + local) |
| `data date` gerada + índices cronológicos | `0004` | ✅ aplicada (prod + local) |
| Normalização preventiva das legadas (timestamptz, jsonb, CHECKs, uniques, numeric) | `0005` | ✅ aplicada (prod + local) |
| Decidir donos das entidades duplicadas (§1.3) antes de reativar legadas | design | ⏸ decisão de produto |
| Código: "dia mais recente" por `data desc` (6 queries), PNR por `created_date_br` (7 pontos), dias ordenados no SQL, join cep direto | src/lib | ✅ feito |
| `shopee_upload_log`: referenciar `upload.id` (fim do filenames-com-vírgula / user_email sem FK) | código + migration | ⏸ junto da reativação de `upload` |
| Retenção via tick diário no worker (claim atômico via processing_jobs kind=maintenance) | apps/worker | ✅ feito |

# Análise estrutural do banco — diagnóstico e otimização

**Julho/2026.** Base: schema real (`migrations/0001_baseline.sql`, dump do Supabase), volumetria de produção medida em 01/07/2026 e o consumo real das queries (pós-conversão pra SQL puro na branch `feat/aws-migration`).

Estado: 28 tabelas, ~26 MB total. Volume pequeno — as otimizações aqui são de **correção estrutural e preparo pra escala/financeiro**, não de incêndio de performance.

| # | Tema | Severidade | Status |
|---|---|---|---|
| 1 | 9 tabelas legadas mortas | limpeza | proposta pronta (`migrations/_propostas/0005`) |
| 2 | Data como texto `'DD/MM/YYYY'` | **estrutural, o mais grave** | mitigado (migration 0004 aplicada) |
| 3 | "Dia mais recente" via `updated_at` | bug latente | corrigir no código (follow-up) |
| 4 | Índices fora do padrão de consumo | performance futura | corrigido (migration 0003 aplicada) |
| 5 | Timestamps sem fuso em 2 tabelas | consistência | corrigir no cutover RDS |
| 6 | Crescimento sem retenção (event/outros) | operação | política via worker (proposta) |
| 7 | Formas normais — desvios conscientes | documentação | documentado abaixo |

---

## 1. Tabelas mortas (era pré-Shopee / Reflex)

Medido em produção: **todas com 0 linhas** e **zero uso no app** (telas `hoje`/`motoristas`/`liberacao` são `PagePlaceholder`; `historico`/`sla-ds` são redirect):

`package`, `upload`, `snapshot`, `snapshot_driver`, `sla_ds_record`, `liberacao`, `user_base`, `shopee_stuck_snapshot`, `alembic_version` (resquício do Alembic/Python).

Além disso `shopee_package_event.source_upload_id` é **100% NULL** — FK morta que prende a tabela `upload`.

**Ação:** `migrations/_propostas/0005_drop_legado.sql` (não roda sozinha; promover a `migrations/` quando decidir). Pré-requisito único no código: tirar o count de `sla_ds_record` do `getDashboardStats` em `src/lib/queries.ts`.

**Ganho:** schema 28 → 19 tabelas; baseline menor; zero tabela órfã chegando no RDS.

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

- `base.created_at` e `cep_cache.fetched_at` são `timestamp` **sem** fuso; todo o resto é `timestamptz`. Corrigir no cutover RDS (`alter ... type timestamptz using ... at time zone 'UTC'`) — barato, tabelas minúsculas.
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
| Drop das 9 tabelas mortas | `_propostas/0005` | ⏸ aguardando seu ok (1 ajuste de código antes) |
| Código: ordenar/filtrar por `data`, `max(data)` no latestDay, join cep direto | src/lib | ⏸ follow-up incremental |
| Retenção via tick diário no worker | apps/worker | ⏸ follow-up |
| `timestamptz` nas 2 colunas sem fuso | cutover RDS | ⏸ |

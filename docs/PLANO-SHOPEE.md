# Plano de Implementação — Operação Shopee (Dashboard)

> Documento vivo de planejamento e tracking. Atualizar os checkboxes conforme avança.
> Criado em: 2026-06-08 · Branch: `nextjs-rewrite` · Stack: Next.js 16 + Supabase (Postgres) + TailwindCSS + shadcn/Base UI.

---

## 0. Como usar este documento

- Cada fase tem checkboxes `- [ ]` → marcar `- [x]` quando concluído.
- **Itens marcados com ⚠ APROVAÇÃO** mexem no banco ou adicionam dependências/custos → **não executar sem o Pedro confirmar** (ver [§2](#2-decisões-que-precisam-da-sua-aprovação)).
- O [§13 Log de progresso](#13-log-de-progresso) registra o que já foi feito de fato.

---

## 1. Sumário executivo

Construir a **página da operação Shopee** com:

1. **Título** + **navbar de subtabs** no topo: `Geral · SLA · DS · Stuck · PNR(WIP)`.
2. **Filtros** com dois níveis:
   - **Básico**: dropdown de base única.
   - **Avançado**: painel (botão "Filtros") com status de tempo + seleção múltipla de bases.
3. **Upload manual de dados** (somente ADM) com barra de progresso, **preview de diff** e confirmação antes de gravar no DB. Padrão reutilizável por todas as subtabs.
4. **Histórico** dos dados da operação.
5. **Export PDF** vertical A4, multipágina, com a **mesma aparência do dash**.
6. **Snapshot diário automático às 23:30** (cron) + seção de configuração do cron.
7. **Cadastro de motoristas via planilha**, usando o ID que vem no nome (`[99067] Nome`) como ID no DB.

### Estado atual (o que já existe)

| Área | Situação |
|---|---|
| Auth (Supabase) + login | ✅ funcionando |
| Layout dashboard + sidebar | ✅ existe (`src/app/dashboard/layout.tsx`, `app-sidebar.tsx`) |
| Página de operação genérica | ⚠️ stub (`src/app/dashboard/operacao/[slug]/page.tsx` — só lista bases) |
| Schema DB | ✅ 13 tabelas (gerido por Alembic). Sem modelo de **Stuck**; `driver.id` é uuid |
| Permissões/roles | ✅ `src/lib/permissions.ts` (MONITORAMENTO→ADMIN) |
| Componentes UI | ✅ shadcn/Base UI (table, dialog, drawer, sheet, select, tabs, chart, sonner...) |
| Dados operacionais no DB | ⬜ vazio (start limpo) |
| PDF export | ⬜ inexistente (o antigo era PNG via html2canvas) |
| Cron / snapshot automático | ⬜ inexistente |

### O que dá pra reaproveitar da branch `main` (app antigo JS vanilla)

- `js/constants.js`: **`STATUS_MAP`** (status Shopee → categoria PT), **`BASE_ALIAS`** (estação → slug de base), `normalizePct`, `parseQty`, parsers de SLA/DS colados.
- `js/calcs.js`: fórmulas de **SLA** (`entregues/total`) e **DS**.
- `js/print.js`: layout do "print" (referência visual do consolidado; reescrever como PDF real).
- `FLUXO-DE-DADOS.md`: mapa completo do fluxo antigo (já analisado).

---

## 2. Decisões que precisam da sua aprovação

> Estas travam fases inteiras. Recomendação minha em **negrito**; confirme ou ajuste.

> **✅ Decididas em 2026-06-08:**
> - **Driver ID** (§2.2): `[99067]` é a PK no DB. ⚠️ **Corrigido 2026-06-08:** o `Driver ID` do CSV é o MESMO número do `[id]` (195/195 batem) — **um sistema só**, sem match por nome. Coluna `spx_driver_id` mantida por decisão do Pedro, mas redundante.
> - **Regra Stuck** (§2.3/§4.4): coluna **`LM Hub Days`**, `floor(dias) >= 1` **E** `status != Delivered`.
> - **PDF** (§2.4): **Puppeteer + `@sparticuz/chromium`** (rota `/print` renderizada server-side).
> - **Cron** (§2.5): **Vercel Cron** (granularidade fixa → rota checa `cron_config.hora` no DB).
> - **Migrations** (§2.1): seguir `sql/` + scripts `.mjs`; ignorar `alembic_version`.
> - **Início**: Fase 1 (esqueleto da página).
> ~~Ainda pendente de OK explícito antes de rodar: criar as tabelas do Stuck (§2.3) e a migração da `driver` (§2.2).~~ **✅ Aprovado e APLICADO em 2026-06-08** (`sql/10_shopee_stuck.sql`).

### 2.1 Ferramenta de migrations do DB (quase decidido)
A `alembic_version` no DB é órfã (resquício do plano Reflex). O projeto **já versiona via `sql/` + scripts `.mjs`** (`scripts/migrate-config.mjs`, `fix-defaults.mjs`).
- **Recomendado (seguir o que já existe):** novos schemas em **arquivos SQL numerados** `sql/10_*.sql` aplicados via script `.mjs`/SQL Editor; ignorar a `alembic_version`. Só confirmar que está ok.

### 2.2 Identidade do motorista ⚠ APROVAÇÃO
Há **dois sistemas de ID** nos dados:
- Nas planilhas DS/backlog: `[99067] Nome`, `[2956602] Nome` → você disse que **este número é o ID no DB**.
- No CSV de SLA: colunas separadas `Driver ID` (ex. `1251914`) + `Driver Name` — magnitude diferente, provavelmente **outro sistema** (SPX).
- **Recomendado:** `driver.id` = ID bracketado (`[99067]`) como PK (bigint/text). Guardar o `Driver ID` do CSV num campo secundário `spx_driver_id`. Motorista é **global da operação** (não por base) — ele pode rodar em mais de uma base. → muda a tabela `driver` atual (hoje é por base, uuid). **Precisa do seu OK.**
- ❓ Confirmar: `[99067]` e `1251914` são a mesma pessoa em sistemas diferentes, ou IDs sem relação?

### 2.3 Modelo de dados do Stuck ⚠ APROVAÇÃO
Volume estimado: ~3k+ pacotes/dia/base × 5 bases, acumulando. Proposta de 3 tabelas (detalhe em [§4.4](#44-stuck)). **Precisa do seu OK** antes de criar.

### 2.4 Biblioteca de PDF ⚠ APROVAÇÃO (custo/infra)
Para PDF A4 fiel ao dash, ver [§9](#9-export-pdf-a4). Como o deploy é **Vercel** (serverless), Puppeteer puro não cabe — precisaria de `puppeteer-core` + `@sparticuz/chromium` (cabe nos limites, mas é setup chato). Opções:
- **A) Puppeteer + @sparticuz/chromium** na Vercel: fidelidade máxima (usa o CSS do próprio dash), porém mais frágil/pesado.
- **B) `@react-pdf/renderer`:** recriar o layout em primitivos; leve e estável na Vercel, mas não fica "pixel-idêntico".
- **C) `window.print()` + CSS `@page A4`** numa rota `/print`: zero dependência, o usuário "salva como PDF". Mais simples; menos controle do arquivo final.

### 2.5 Onde roda o cron das 23:30 (decidido: Vercel)
Hospedagem = **Vercel** (confirmado). → **Vercel Cron** chamando `/api/cron/snapshot` (rota protegida por secret).
- ⚠ Nuance: Vercel Cron tem **granularidade fixa por agendamento** (não dá pra "alterar a hora" só pelo DB sem alterar `vercel.json`). Solução: cron roda de hora em hora (ou a cada 15min) e a rota checa `cron_config.hora` no DB pra decidir se executa. Assim a hora vira configurável pela UI. Confirmar abordagem.

### 2.6 Storage dos arquivos crus ⚠ APROVAÇÃO
Para diff e reprocessamento, **recomendado** subir o arquivo cru para um **bucket privado do Supabase Storage** (`shopee-uploads/`), processar server-side, e guardar só métricas na tabela `upload`. Alternativa: processar em memória sem persistir o cru (mais simples, sem reprocessar depois).

---

## 3. Arquitetura de UI

### 3.1 Rota e layout
```
src/app/dashboard/operacao/shopee/
  layout.tsx                ← título + navbar de subtabs + barra de filtros (compartilhada)
  page.tsx                  ← redirect → ./geral
  geral/page.tsx
  sla/page.tsx
  ds/page.tsx
  stuck/page.tsx
  pnr/page.tsx              ← WIP
  uploads/page.tsx          ← (ADM) central de uploads (ver §5)
```
> A operação Shopee ganha rota dedicada. A `[slug]` genérica continua para as outras operações até serem migradas.

### 3.2 Navbar de subtabs (topo)
- Barra horizontal sticky abaixo do título, com as subtabs como links (estado ativo via `usePathname`).
- `PNR` exibe badge **"WIP"**; conteúdo = placeholder.
- Subtab `Uploads` só aparece para ADM.

### 3.3 Barra de filtros (compartilhada no layout)
Estado dos filtros vive na URL (searchParams) → compartilhável, sobrevive a refresh, e o Server Component lê direto.

- **Filtro básico (sempre visível):** `Select` de base única → `?base=xpt-adr-02`.
- **Botão "Filtros" (avançado):** abre um `Sheet`/`Popover` com:
  - **Status de tempo**: hoje / ontem / últimos 7 / últimos 30 / intervalo custom → `?range=...&from=...&to=...`.
  - **Bases (multi)**: checkboxes → `?bases=xpt-adr-02,xpt-lrs-01`.
- Regra: se `bases` (multi) presente, ignora `base` (single). Indicador visual de "filtro avançado ativo".

```
┌──────────────────────────────────────────────────────────────┐
│  🛍️  Shopee                                   [ Export PDF ]   │
├──────────────────────────────────────────────────────────────┤
│  Geral │ SLA │ DS │ Stuck │ PNR(wip) │            (Uploads)    │  ← subtabs
├──────────────────────────────────────────────────────────────┤
│  Base: [ XPT-ADR-02 ▼ ]   [ Filtros ▾ ]   Período: Hoje       │  ← filtros
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Arquitetura de dados + lógica por subtab

> Convenção: tabelas novas da Shopee com prefixo `shopee_` para isolar do core.

### 4.1 Geral
Consolidado de tudo: KPIs de SLA, DS, total de Stuck, e um **espaço reservado "PNR (WIP)"**.
- Lê os agregados mais recentes de cada subtab (do snapshot do dia ou do estado atual conforme filtro).
- Cards: SLA %, DS %, Stuck (qtd), PNR (placeholder), + mini-gráficos de tendência (histórico).
- **Sem tabela nova** — consome as das outras subtabs.

### 4.2 SLA
Alimentado por CSVs `export_return_order_*.csv` (64 colunas; chave `Order ID`, status na coluna `Status`).
- **Cálculo (do app antigo):** `total = nº pacotes`; `entregues = status==Delivered`; `SLA% = entregues/total`. Categorias via `STATUS_MAP` (Em rota=Delivering, Ocorrência=OnHold, Faltante=vários, etc.).
- Dedupe por `Order ID` (CSV vem em chunks de 10k linhas).
- Base resolvida via `Current Station` → `BASE_ALIAS`.
- ❓ **Fluxo a validar com você antes de implementar** (você pediu). Proposta em [§6](#6-fluxos-a-validar-sla-e-ds).
- Tabela sugerida: reusar/expandir `sla_ds_record` (já existe: base, data, sla_pct, sla_rec, sla_ent...).

### 4.3 DS (encaminhados vs entregues do dia)
Alimentado por xlsx. **Atenção:** o `fleets (1).xlsx` de exemplo só tem 1 coluna (`Driver Name` com `[ID] Nome`) — é **lista de motoristas**, não os números de DS. O app antigo lia colunas `saiu/entregues/emRota/ocorrências` de outro xlsx.
- ❓ **Preciso do xlsx real de DS** (com as quantidades) pra mapear colunas. Por ora, o `fleets` serve pro **cadastro de motoristas** ([§5.3](#53-cadastro-de-motoristas)).
- ❓ **Fluxo a validar com você** ([§6](#6-fluxos-a-validar-sla-e-ds)).
- Tabela sugerida: reusar `sla_ds_record` (ds_pct, ds_rec, ds_ent) + `snapshot_driver` p/ por-motorista.

### 4.4 Stuck
Pacotes "presos". Alimentado **inicialmente** por `backlogs.xlsx` (18 colunas) e depois **atualizado** por `export_return_order_*.csv` (mesmas 64 colunas do SLA).

**Colunas-chave do backlog:** `Shipment ID` (=código), `LM Hub Days`/`LM Leg Days` (dias preso), `Latest Status` (OnHold/Delivering/Delivered…), `Latest User Name` (`[ID]Nome` do motorista), `Station Name`/`Destination Station` (base), `Agency Name`.

**Regra de "é stuck" (a confirmar — ver ❓):**
> Considerar stuck o pacote em que **`floor(dias) >= 1`** (NÃO chegou hoje) **E** `status != Delivered`.
> Ou seja, descartam-se: os que chegaram hoje (`floor(dias)==0`) e os já entregues.
- ❓ Confirmar qual coluna de dias (`LM Hub Days` vs `LM Leg Days`).
- ❓ Confirmar a interpretação da regra (a frase original era ambígua).

**Comportamentos:**
- **Nunca deletar** pacote. Entregue vira `status=Delivered` (fica no histórico).
- **Export da lista de IDs** dos stuck atuais: gera texto com 1 ID por linha e **joga direto no clipboard** (Ctrl+V pronto). Toast de confirmação.
- **Upload incremental** (CSV de tracking): casa por `Shipment ID`/`Order ID`, atualiza status, mostra **diff** (quantos novos, quantos mudaram status, quantos viraram entregue) e pede confirmação.
- **Tabela** com paginação + busca + **filtro "esconder entregues"** (`@tanstack/react-table` já instalado).
- **Snapshot final do dia** via cron (23:30) congela o conjunto de stuck.

**Modelo proposto (⚠ APROVAÇÃO — §2.3):**
```sql
-- estado ATUAL de cada pacote stuck (upsert por base+codigo)
shopee_package (
  id bigserial pk,
  base_id uuid fk,
  codigo text,                  -- Shipment ID / Order ID
  status text,                  -- status Shopee cru (Delivered, OnHold, ...)
  driver_id ... fk null,        -- do [ID] em Latest User Name
  dias_preso numeric,           -- LM Hub Days (ou Leg)
  agency text,
  first_seen_at timestamptz,    -- 1ª vez no backlog
  last_status_at timestamptz,
  delivered_at timestamptz null,
  updated_at timestamptz,
  unique (base_id, codigo)
);
-- histórico append-only de mudanças de status (p/ evolução/auditoria)
shopee_package_event (
  id bigserial pk,
  package_id bigint fk,
  status text, dias_preso numeric, driver_id ...,
  source_upload_id uuid fk,
  observed_at timestamptz
);
-- snapshot diário do conjunto stuck (do cron 23:30)
shopee_stuck_snapshot (
  id uuid pk, base_id uuid fk, data_pt_br text, ts timestamptz,
  total_stuck int, entregues_no_dia int, por_status jsonb, por_motorista jsonb,
  unique (base_id, data_pt_br)
);
```

### 4.5 PNR (WIP)
Monitoramento de prejuízos por motorista. **Dados virão depois.**
- Por agora: placeholder na subtab `PNR` + card "PNR (WIP)" no Geral.
- Planejado: total de prejuízo (Σ valores), estratificado por motorista / status / reclamação; lista de motoristas com **evolução temporal**.
- Modelo planejado (criar só quando vierem os dados): `shopee_pnr` (driver_id, codigo, valor, status, motivo, data) + agregações por snapshot.

---

## 5. Sistema de upload (somente ADM) — reutilizável

### 5.1 Decisão de UX
**Recomendado:** botão **"Subir dados"** em cada subtab (SLA/DS/Stuck) que abre um **modal de upload** padronizado, **+** uma subtab `Uploads` (ADM) que centraliza histórico de uploads e re-uploads. Mesmo componente reaproveitado por todas as operações futuras.

### 5.2 Pipeline
```
ADM seleciona arquivo(s)
   → upload do cru p/ Supabase Storage (bucket privado)        [§2.6]
   → Server Action/Route parseia (stream) com barra de progresso
   → calcula DIFF vs estado atual (novos / alterados / entregues / inalterados)
   → modal mostra resumo do diff + amostra
   → ADM confirma → grava no DB (transação) + registra em `upload`
   → toast de sucesso + refresh dos dados
```
- **Progresso:** processamento server-side reportando % via streaming (Route Handler com `ReadableStream`) ou polling de uma linha `upload_job`. Decidir na implementação.
- **Parsers:** CSV (reusar `parseCSVRow` robustecido p/ aspas), XLSX (lib `xlsx`/SheetJS no server). ⚠ adicionar dependência `xlsx`.
- **Guard ADM:** checagem de role no Server Action (nunca confiar no client). Subtab `Uploads` escondida no nav p/ não-ADM.

### 5.3 Cadastro de motoristas
> **✅ Verificado 2026-06-08:** o `Driver ID` do CSV é o MESMO número do `[id]` no nome (195/195 motoristas batem). **Um único sistema de ID** — sem match por nome.

- Toda planilha que traz motorista passa por um **resolver de motorista**, que pega o ID de onde estiver:
  - `[ID] Nome` (DS/fleets e backlog `Latest User Name`) → regex `^\s*\[\s*(\d+)\s*\]\s*(.+)$`.
  - `Driver ID` + `Driver Name` (CSV SLA/stuck_track) → o número é o mesmo id.
  - Upsert por `id`: não existe → cadastra (`id`=número, `name`=nome); existe → atualiza nome se mudou.
- **Filtro de contas de sistema (decisão do Pedro):** ignorar `Latest User Name` que seja email (`@shopeemobile-external.com`, `@shopee.com`), `driver confirm`, `spx@shopee.com`. Só vira motorista quem tem ID real. (No exemplo, 8 contas filtradas; 0 motoristas reais sem ID.)
- `spx_driver_id`: coluna **mantida** (decisão do Pedro), embora redundante com `id`. Resolver não depende dela.
- Relatório no diff: "X motoristas novos cadastrados".

---

## 6. Fluxos a validar (SLA e DS)

Você pediu pra discutir SLA/DS com calma. **Proposta inicial** (responder antes de implementar a Fase 4):

**SLA** — input: 1+ CSVs do dia. Passos: parse → dedupe por `Order ID` → resolve base por `Current Station` → conta por `STATUS_MAP` → `SLA% = Delivered/total` → grava 1 registro por (base, dia) em `sla_ds_record` (upsert) → snapshot. Pergunta: SLA é por **dia de quê** (data de recebimento? do export?) e a meta é **98%** (como no código antigo)?

**DS** — input: xlsx do dia (formato real a definir). Passos: parse linhas por motorista → soma `saiu`/`entregues` → `DS% = entregues/saiu` → grava por (base, dia) + por motorista. Pergunta: o DS é agregado da base ou vem por motorista e somamos? Qual a planilha real?

---

## 7. Histórico

- Página/aba de histórico por subtab + visão geral, lendo `snapshot` / `sla_ds_record` / `shopee_stuck_snapshot`.
- Filtro por período (reusa a barra de filtros) e por base.
- Gráficos de tendência (recharts, já instalado) + tabela exportável.
- Permite abrir um dia específico e ver o snapshot congelado.

---

## 8. (reservado)

---

## 9. Export PDF A4

Objetivo: PDF **vertical A4 multipágina**, **visual idêntico ao dash**, consolidando os dados atuais (respeitando filtros).

- **Recomendado:** rota dedicada `/dashboard/operacao/shopee/print` renderizada com CSS de impressão (`@page { size: A4 portrait }`, quebras `break-inside: avoid`), e **Puppeteer** server-side (`/api/pdf/shopee`) que abre essa rota autenticada e gera o PDF para download. Fidelidade máxima (usa o próprio CSS/Tailwind do dash). ⚠ dependência Puppeteer/Chromium ([§2.4](#24-biblioteca-de-pdf--aprovação-custoinfra)).
- Alternativa sem browser: `@react-pdf/renderer` (recriar layout em primitivos — mais trabalho, menos "idêntico").
- Conteúdo: header com logos (empresa + Shopee) + data/hora + base/período (espelha o `print.js` antigo), depois cards e gráficos, paginado.

---

## 10. Snapshot diário (cron 23:30) + configuração

- **Job** `snapshot-diario`: para cada base ativa da Shopee, congela SLA/DS/Stuck do dia em `snapshot`/`sla_ds_record`/`shopee_stuck_snapshot` (1 por base por dia, upsert).
- **Onde roda:** ⚠ [§2.5](#25-onde-roda-o-cron-das-2330--aprovação-infra).
- **Tabela de config** `cron_config (job text pk, enabled bool, hora text, last_run_at, last_status)`.
- **Seção em Configurações** (ver §11): ver histórico de execuções, **alterar hora**, **forçar snapshot agora**, **desabilitar**.

---

## 11. Configurações (seção)

Adicionar em `dashboard` uma área de **Configurações** (ADM) com:
- **Cron/Snapshot**: estado, hora, histórico, forçar, on/off ([§10](#10-snapshot-diário-cron-2330--configuração)).
- **Operações/Bases**: já parcialmente existe (admin).
- (futuro) parâmetros de negócio: meta SLA, coluna de dias do Stuck, etc.

---

## 12. Fases de implementação (tracking)

### Fase 0 — Fundação e segurança
- [x] Backup read-only do DB (`scripts/backup-db.mjs` → `backups/`)
- [x] `.gitignore` para `/backups/` e `/data/` (PII)
- [ ] Resolver decisões [§2](#2-decisões-que-precisam-da-sua-aprovação) (migrations, driver ID, modelo stuck, PDF, cron host, storage)
- [ ] Definir estratégia de migrations e criar `sql/10_*.sql` base

### Fase 1 — Esqueleto da página Shopee ✅
- [x] Estrutura de rotas `operacao/shopee/{geral,sla,ds,stuck,pnr,uploads}`
- [x] Layout com título + navbar de subtabs (ativo via pathname) — `src/app/dashboard/operacao/shopee/layout.tsx`
- [x] Barra de filtros: básico (base única) + avançado (Sheet: tempo + multi-base) via searchParams — `src/components/shopee/filter-bar.tsx`
- [x] Guard de ADM para subtab `Uploads` (redirect server-side)
- [x] Placeholder PNR (WIP) + espaço PNR no Geral

### Fase 2 — Motoristas ✅ (fleets)
- [x] ⚠ Migração da tabela `driver` (ID externo como PK, +`spx_driver_id`, global da operação) — `sql/10_shopee_stuck.sql`
- [x] Resolver de motorista (`src/lib/shopee/drivers.ts`): ID de `[colchetes]` ou coluna `Driver ID`, filtro de contas de sistema, dedupe; testado
- [x] Importar `fleets` → cadastro automático (`scripts/import-fleets.ts`, exceljs): **92 motoristas**, idempotente
- [ ] Importar motoristas do backlog/CSV vem junto com a ingestão de Stuck (Fase 3)

### Fase 3 — Stuck (a subtab mais completa)
- [x] ⚠ Criar tabelas `shopee_package`, `shopee_package_event`, `shopee_stuck_snapshot` — `sql/10_shopee_stuck.sql` (testado: upsert marca Delivered sem deletar)
- [x] Base `xpt-smt-01` (São Mateus) criada — apareceu no backlog, faltava no seed (`sql/11_base_sao_mateus.sql`)
- [x] Parser de backlog xlsx + regra `floor(LM Hub Days)≥1 e ≠Delivered` (`src/lib/shopee/stuck.ts`, `scripts/import-backlog.ts`): **4.284 stuck** + 88 motoristas novos
- [x] Tabela paginada + busca + esconder entregues (`src/components/shopee/stuck-table.tsx`)
- [x] Export de IDs p/ clipboard (toast via sonner; `Toaster` montado no dashboard layout)
- [x] KPIs da subtab (Stuck ativos / Entregues / Motoristas / Bases)
- [x] Ingestão do tracking (stuck_track CSV): atualiza status/motorista, marca Delivered sem deletar (`scripts/import-stuck-track.ts`, parser `src/lib/shopee/csv.ts`)
- [x] Checkpoints + 2 gráficos: **burn-down** (% ainda stuck por upload) + **monitor** (stuck vs resolvidos, donut com %) — `sql/14`, `src/components/shopee/stuck-charts.tsx`
- [ ] Upload incremental **in-app** com diff + confirmação (hoje é via script) — Fase 6
- [ ] Gráficos extras (por status / por base) — opcional

### Fase 4 — SLA e DS
- [x] Validar fluxos [§6](#6-fluxos-a-validar-sla-e-ds) com o Pedro — confirmado via main + print (SLA=entregues/total; DS=Σent/Σsaiu)
- [x] **DS real** (`sql/16`, `src/lib/shopee/ds.ts`, `scripts/import-ds.ts`): xlsx `fleets` tem 21 colunas (F=Assigned, I=Delivered, K=Delivering, M=Failed, C=Driver Station→base). Subtab DS com gauge + cards + tabela. **Bateu exato com o print: 92 motoristas, DS 84,3%, 9013 entregues**
- [ ] Parser CSV SLA + cálculo + upsert `sla_ds_record` — **próximo** (entregues/total + categorias STATUS_MAP + faltam p/ meta 98%)
- [ ] Gráficos de evolução (SLA/DS) — histórico via snapshots

### Fase 5 — Geral + Histórico
- [ ] Consolidado no Geral (SLA/DS/Stuck + PNR placeholder)
- [ ] Histórico com filtros e tendências

### Fase 6 — Upload central + robustez
- [ ] Bucket privado Storage + pipeline com progresso
- [ ] Subtab `Uploads` (ADM): histórico, re-upload
- [ ] Generalizar componente de upload p/ outras operações

### Fase 7 — PDF A4
- [ ] ⚠ Decidir lib ([§2.4](#24-biblioteca-de-pdf--aprovação-custoinfra)) e instalar
- [ ] Rota `/print` com CSS A4 + geração do arquivo
- [ ] Botão "Export PDF" respeitando filtros

### Fase 8 — Cron 23:30 + Config + ciclo diário da visão
- [ ] ⚠ Definir host do cron ([§2.5](#25-onde-roda-o-cron-das-2330--aprovação-infra))
- [ ] Job de snapshot diário (idempotente, 1/base/dia)
- [ ] Tabela `cron_config` + seção em Configurações (hora/forçar/on-off/histórico)
- [x] **"Limpeza diária da VISÃO" (não do DB!) — adiantada 2026-06-08:**
  - [x] `operacao.config` (jsonb) + `shopee_package.last_backlog_date` (`sql/15`)
  - [x] Subtab **Config** (ADM) com toggle "Limpeza diária da visão" — `config/` + `setStuckDailyReset` action + `config-form.tsx`
  - [x] `getStuckPackages` respeita o toggle (mostra só o `last_backlog_date` mais recente; off = acumulado)
  - [ ] `import-backlog` grava `last_backlog_date` ✅; falta o **cron/virada de dia** automatizar a troca de "dia atual"
  - [ ] **Filtro "a partir do dia X"** na barra de filtros (ainda não)
  - [ ] Escopar o **burn-down/checkpoints** ao dia quando o toggle estiver on (hoje mostra todos os dias; só há 1 dia)
- [ ] **Corrigir denominador do burn-down** p/ multi-dia: usar o **conjunto do dia** (backlog do dia), não `count(*)` acumulado de `shopee_package`.

### Fase 9 — PNR (quando vierem os dados)
- [ ] Modelo `shopee_pnr` + ingestão
- [ ] Dashboard de prejuízos: por motorista/status/reclamação + evolução

---

## 13. Log de progresso

| Data | Item | Resultado |
|---|---|---|
| 2026-06-08 | Backup read-only do DB | ✅ `backups/2026-06-08T01-58-21-808Z/` (13 tabelas, 15 linhas) |
| 2026-06-08 | `.gitignore` p/ backups e data (PII) | ✅ |
| 2026-06-08 | Análise dos dados reais + lógica antiga (main) | ✅ documentado neste plano |
| 2026-06-08 | Este plano | ✅ criado |
| 2026-06-08 | Decisões §2 (driver/stuck/PDF/cron/migrations/início) | ✅ definidas com o Pedro |
| 2026-06-08 | **Fase 1** — esqueleto da página Shopee | ✅ rotas + navbar + filtros + guard ADM (tsc/eslint limpos, rotas 307→login) |
| 2026-06-08 | Ajustes UI (scroll fantasma + filtros abaixo do subtítulo) | ✅ |
| 2026-06-08 | **DB**: driver reformulado + tabelas de Stuck (`sql/10`) | ✅ aplicado + smoke test (insert/upsert/rollback) + `sql/01` atualizado |
| 2026-06-08 | Backup pré-carga (pós-migração) | ✅ `backups/2026-06-08T02-42-24-650Z` (16 tabelas) |
| 2026-06-08 | Verificação IDs motorista (1 sistema só) | ✅ 195/195 batem; `spx_driver_id` mantido por decisão |
| 2026-06-08 | **Fase 2** — resolver + import do fleets | ✅ `src/lib/shopee/drivers.ts` + `scripts/import-fleets.ts` (exceljs); 92 motoristas carregados (idempotente) |
| 2026-06-08 | Backup pós-carga (motoristas) | ✅ `backups/2026-06-08T03-19-35-730Z` (driver: 92) |
| 2026-06-08 | Base XPT-SMT-01 criada | ✅ `sql/11_base_sao_mateus.sql` (faltava no seed) |
| 2026-06-08 | **Fase 3 (parcial)** — Stuck: backlog + dashboard | ✅ 4.284 stuck importados; subtab com KPIs, tabela (busca/paginação/esconder-entregues) e export de IDs |
| 2026-06-08 | Backup pós-carga (backlog) | ✅ `backups/2026-06-08T03-32-42-611Z` (shopee_package: 4284) |
| 2026-06-08 | Cidades nos labels das bases | ✅ `sql/13` (todas as 6 bases) |
| 2026-06-08 | Tracking + checkpoints + 2 gráficos | ✅ `sql/14`, `import-stuck-track.ts`, `stuck-charts.tsx` (burn-down 100%→99.98% — raso pois CSVs são da mesma manhã) |
| 2026-06-08 | Limpeza diária da visão (adiantada da Fase 8) | ✅ `sql/15` (operacao.config + last_backlog_date), subtab Config (ADM) c/ toggle, Stuck filtra pelo dia mais recente quando ligado |
| 2026-06-08 | **DS real** (subtab + import) | ✅ `sql/16`, `import-ds.ts`; fleets tem 21 col reais (read_only do openpyxl tinha enganado); base na col C. Bateu EXATO com o print: 92 mot., DS 84,3%, 9013 ent |
| 2026-06-08 | DS: 3 gráficos + fixes + sorts | ✅ burn-down DS (`sql/17` checkpoints) + meia-lua (sem clip, texto via SVG Label) + donut composição. Tooltip do donut corrigido (texto central via Label SVG). Sort nas tabelas Stuck e DS |

---

## 14. Riscos e pontos cegos

| Risco | Mitigação |
|---|---|
| Volume do Stuck cresce indefinidamente | Retenção/arquivamento + índices por (base, data); snapshot agregado |
| Dois IDs de motorista (`[99067]` vs `1251914`) | Confirmar relação ([§2.2](#22-identidade-do-motorista--aprovação)) antes de modelar |
| `parseCSVRow` antigo não trata `""` escapado | Usar parser robusto no server |
| CSV de 10k+ linhas × vários | Processar server-side em stream; progresso; transação por lote |
| Cron depende do host | Decidir host cedo ([§2.5](#25-onde-roda-o-cron-das-2330--aprovação-infra)) |
| PII nos arquivos crus | Bucket privado + RLS; nunca commitar `data/` |
| Alembic órfão no DB | Migrar estratégia ([§2.1](#21-ferramenta-de-migrations-do-db--aprovação)) |

---

## 15. Glossário de dados (colunas reais observadas)

**CSV `export_return_order_*.csv` (SLA e Stuck-tracking, 64 colunas):**
`Order ID`, `SLS Tracking Number`, `Shopee Order SN`, `Longitude`, `Latitude`, `Zipcode Name`, `Buyer Name/Phone/Address`, `Postal Code`, **`Driver ID`**, **`Driver Name`**, `Received Time`, `Delivering Time`, `Delivered Time`, `OnHold Time`, `OnHoldReason`, **`Status`** (col 23), `COD Amount`, `Manifest Number`, `Delivery Attempts`, `SLA Target Date`, `Time to SLA`, **`Current Station`**, `Return Destination`, `Zone`, `Driver Contract Type`, `SLA Tag`, ... (PII: nome/tel/endereço do comprador).

**Backlog `backlogs.xlsx` (18 colunas):**
`Agency Name`, `Station ID`, **`Shipment ID`**, `Station Name`, `Zone ID/Name`, `Order Account`, `Inbound Time`, `LM Leg Aging`, **`LM Leg Days`**, `LM Hub Aging`, **`LM Hub Days`**, `Delivery Attempts`, `No. Attempts`, **`Latest Status`**, `Latest Operation Time`, **`Latest User Name`** (`[ID]Nome`), `Destination Station`.

**DS `fleets (1).xlsx`:** 1 coluna `Driver Name` = `[ID] Nome` (na prática, **lista de motoristas**).

**Status Shopee observados:** `Delivered`, `Delivering`, `OnHold`, `Hub_Received`, `Hub_Assigned`, `Hub_Assigning`, `Hub_Packed`, `Hub_Packing`, `Hub_Sorting`, `Hub_LHArrived`, `LMHub_Packed`, `LMHub_Received`, `SOC_LHTransported`, `Return_Hub_Packed`, `Return_Hub_Received`, `Return_Hub_Packing`, `0`(inválido).

**`STATUS_MAP` (app antigo) → categorias PT:** Delivered→Entregue · Delivering→Em rota · OnHold→Ocorrência · Hub_Received→Recebido · Hub_Assigned→Sem atribuição · SOC_*/Hub_LHArrived→Faltante · Return_Hub_Received→Interceptado · Return_Hub_Packing→Devolução.

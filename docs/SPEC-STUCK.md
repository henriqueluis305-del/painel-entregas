# Especificação — Funcionalidade "Stuck" (Pacotes Presos)

> Documento de especificação **independente de implementação**. Descreve regras de
> negócio, modelo de dados, ingestão e funcionalidades de tela para reimplementar o
> "Stuck" em outro projeto (qualquer stack). O projeto original usa Next.js (App
> Router) + Postgres/Supabase, mas nada aqui depende disso.

---

## 1. O que é o Stuck

Um **pacote em stuck** é uma encomenda que está **presa numa base/hub há tempo demais**
sem avançar na entrega. A tela de Stuck responde: *quantos pacotes estão presos, há
quantos dias, em qual base/cidade/bairro, com qual motorista e status* — e mostra a
evolução ao longo do dia (burn-down).

### 1.1 Regra central (definição de "stuck")

```
isStuck(diasParado, status) =
    floor(diasParado) >= 1   E   status NÃO é "resolvido"
```

- **`diasParado`** = campo "LM Hub Days" do export (dias que o pacote está no hub).
  Aceitar número, `"1.37"` e `"1,37"` (vírgula decimal PT-BR). Valor vazio/ inválido → não é stuck.
- **`floor(...) >= 1`**: descarta o que chegou hoje (floor 0).
- **Status resolvidos** (o pacote *saiu* do stuck) — lista fixa:
  `Delivering`, `SP_Collection_Collected`, `SP_Ready_Collection`, `Delivered`.
  Comparar com `trim()`. Um pacote importado já em qualquer um desses **nunca** entra como stuck.

> Decisões históricas: regra `floor >= 1` (2026-06-08); ampliação da lista de status
> resolvidos além de `Delivered` (2026-06-29).

### 1.2 "Pacote entregue/resolvido" (para KPIs e filtros)

```
isResolvido(pacote) = pacote.delivered_at != null  OU  status ∈ statusResolvidos
```

### 1.3 Faixas de dias (buckets do pivô)

Sempre sobre `floor(dias)`:

| Faixa   | Condição (d = floor(dias)) |
|---------|----------------------------|
| `1`     | d == 1                     |
| `2-4`   | 2 ≤ d ≤ 4                  |
| `5-7`   | 5 ≤ d ≤ 7                  |
| `8-14`  | 8 ≤ d ≤ 14                 |
| `>=15`  | d ≥ 15                     |

`d < 1` (ou dias nulo) → sem faixa → não é stuck.

---

## 2. Modelo de dados

Entidades mínimas. Tipos indicados de forma neutra.

### 2.1 `operacao`
- `id` (PK)
- `slug` (único, ex.: `shopee`)
- `config` (JSON) — inclui `stuck_daily_reset: boolean`

### 2.2 `base` (hub/estação)
- `id` (PK)
- `operacao_id` (FK → operacao)
- `slug` (ex.: `xpt-adr-02`), `label` (nome exibido)
- `active`
- único `(operacao_id, slug)`

### 2.3 `driver` (motorista) — global da operação
- `id` (PK, ID externo das planilhas, ex.: `99067`)
- `operacao_id`, `name`, `normalized_key` (lower+trim, para casar por nome)
- único `(operacao_id, normalized_key)`

### 2.4 `package` (estado ATUAL de cada pacote) — tabela principal do Stuck
Nome no projeto original: `shopee_package`. **Nunca deletar**; ao entregar, apenas vira
`status=Delivered` + preenche `delivered_at`.

| Campo               | Tipo         | Observação |
|---------------------|--------------|------------|
| `id`                | PK           | |
| `base_id`           | FK → base    | |
| `codigo`            | texto        | Shipment ID / Order ID |
| `status`            | texto        | status cru do provedor |
| `driver_id`         | FK → driver, nullable | |
| `dias_preso`        | decimal(6,2) | LM Hub Days |
| `agency`            | texto null   | |
| `cep`               | texto null   | 8 dígitos sem máscara → resolve cidade/bairro |
| `last_backlog_date` | date         | dia do backlog mais recente (limpeza diária da visão) |
| `first_seen_at`     | timestamp    | |
| `last_status_at`    | timestamp    | atualizado a cada mudança |
| `delivered_at`      | timestamp null | preenchido quando vira `Delivered` |
| `updated_at`        | timestamp    | |
| **único**           | `(base_id, codigo)` | chave de upsert |

Índices: `(base_id, status)`, `(driver_id)`, `(base_id, last_backlog_date)`.

### 2.5 `package_event` (histórico append-only) — opcional mas recomendado
`(id, package_id, status, dias_preso, driver_id, source_upload_id, observed_at)`.
Uma linha por mudança observada. Serve para auditoria/evolução.

### 2.6 `stuck_checkpoint` (burn-down por upload)
Nome original: `shopee_stuck_checkpoint`. Uma linha **por base, por dia, por `seq`**.

| Campo         | Tipo    | Observação |
|---------------|---------|------------|
| `id`          | PK      | |
| `base_id`     | FK      | |
| `seq`         | int     | 0 = backlog; incrementa a cada upload do dia |
| `data_pt_br`  | texto   | `DD/MM/AAAA` |
| `ts`          | timestamp | |
| `label`       | texto   | ex.: `Backlog`, `Tracking 14:30` |
| `total`       | int     | total de pacotes na base |
| `ainda_stuck` | int     | ainda presos |
| `resolvidos`  | int     | já resolvidos |
| **único**     | `(base_id, data_pt_br, seq)` | |

### 2.7 `cep_cache` (cache do ViaCEP)
`(cep PK 8 díg., cidade, bairro, uf, fetched_at)`. `cidade`/`bairro` NOT NULL (ViaCEP
pode devolver bairro vazio — grave string vazia).

---

## 3. Ingestão (upload de planilhas)

Dois tipos de arquivo alimentam o Stuck. Fluxo em 2 passos: **Analyze** (prévia, não grava)
e **Apply** (grava em transação).

### 3.1 Backlog (XLSX) — carga inicial do dia
Colunas usadas: `Shipment ID`, `Latest Status`, `LM Hub Days`, `Latest User Name`
(motorista), `Station Name` (→ base), `Agency Name`, e uma coluna de CEP (header
casando `/cep|postal|zip/i`).

Lógica:
1. Para cada linha com `Shipment ID`: aplicar `isStuck(LM Hub Days, Latest Status)`.
   Só entram os que são stuck.
2. Resolver a base via `Station Name` (ver §3.4).
3. **Upsert** em `package` por `(base_id, codigo)`:
   - Em conflito: atualiza `status, driver_id, dias_preso, agency`,
     `cep = coalesce(novo, antigo)` (não apaga CEP já resolvido),
     `last_backlog_date = hoje`, `last_status_at = now()`, `updated_at = now()`.
4. Inserir 1 `package_event` por linha.
5. Gravar checkpoint com `label="Backlog"` (ver §5).
- Bases não cadastradas → ignoradas, reportar como aviso.
- Inserir em lotes (chunk de ~1000) por limite de parâmetros.

### 3.2 Tracking (CSV) — atualizações ao longo do dia
Colunas: `Order ID`, `Status`, `Driver Name`, `Driver ID`, CEP.

Lógica:
1. Consolidar por `Order ID` (fica o **último** do arquivo).
2. Casar só com pacotes **já existentes** em `package` (não cria novos).
3. `UPDATE`: `status`, `driver_id = coalesce(novo, antigo)`, `cep = coalesce(novo, antigo)`,
   `last_status_at = now()`,
   **`delivered_at = case when status='Delivered' and delivered_at is null then now() else delivered_at end`**.
4. Inserir `package_event` por atualização.
5. Checkpoint com `label="Tracking HH:MM"` (hora tirada do nome do arquivo, padrão
   `_HH-MM-SS`, senão hora atual).

### 3.3 Parser de CSV
CSV robusto: trata aspas, vírgula dentro de aspas, `""` como aspa escapada, CRLF e BOM.
Ler como lista de objetos `{header: valor}` (header = 1ª linha, com `trim`).

### 3.4 Resolução de base (`Station Name` → `base.slug`)
- Normalizar: `trim().toLowerCase()`, colapsar espaços.
- Tabela de **aliases** explícitos (mapa `estacao → slug`) para casos irregulares.
- **Fallback**: trocar `_` por `-`.
> Sem os aliases, cada import re-orfaniza pacotes de bases cujo nome de estação não
> casa com o slug. Manter o mapa de aliases configurável.

### 3.5 Resolução de motorista
- Extrair ID externo do nome (ex.: `Latest User Name` contém `[99067]`) ou usar `Driver ID`.
- `normalized_key = name.toLowerCase().trim()`.
- Registrar motoristas novos antes de referenciá-los; ao gravar pacote, só setar
  `driver_id` se o motorista existir (senão null).

### 3.6 Resolução de cidade/bairro via CEP (cache-aside)
`lookupCeps(ceps[])`:
1. Normalizar para 8 dígitos (`replace(/\D+/g,"")`, exigir length 8).
2. Ler `cep_cache` para os que já existem.
3. Buscar no ViaCEP (`https://viacep.com.br/ws/{cep}/json/`) só os faltantes,
   com **concorrência limitada** (ex.: 5 simultâneos).
4. Gravar novos no cache (upsert), devolver mapa `cep → {cidade, bairro, uf}`.
- CEP inválido/não encontrado fica fora do mapa (cidade/bairro = null na tela).

---

## 4. Leitura para a tela

Função `getStuckPackages(operacaoId, baseSlugs[], { dailyReset })`:

1. Se `dailyReset` (config `stuck_daily_reset`): descobrir o **maior `last_backlog_date`**
   da operação e filtrar só esse dia (limpa a visão sem apagar do banco).
2. Buscar pacotes da operação, filtrando por `base.operacao_id` e, se houver, por
   `base.slug IN (...)` e por `last_backlog_date = dia`.
3. **Paginar em paralelo**: o PostgREST/Supabase limita ~1000 linhas/req → fazer 1
   `count` + N páginas (`Promise.all`), ordenando por `dias_preso desc, codigo`.
4. Resolver cidade/bairro de todos os CEPs em lote (§3.6).
5. Devolver linhas no formato:

```
StuckRow = {
  codigo, status, dias_preso, agency,
  delivered_at, last_status_at,
  base_slug, base_label,
  driver_id, driver_name,
  cep, cidade, bairro
}
```

### 4.1 KPIs
Sobre as linhas visíveis:
- `total` = nº de linhas
- `entregues` = nº com `isResolvido`
- `ativos` = total − entregues
- `motoristas` = nº de `driver_id` distintos
- `bases` = nº de `base_slug` distintos

### 4.2 Série de burn-down
`getStuckCheckpoints(operacaoId, baseSlugs[])`:
1. Achar o **dia mais recente** com checkpoint (senão a semana toda se mistura).
2. Ler checkpoints desse dia, filtrando por bases; agregar por `seq` (somando
   `total`, `ainda_stuck`, `resolvidos` das bases).
3. Ponto: `{ seq, label, total, ainda, resolv, pct }`, onde `pct = ainda/total*100`.

---

## 5. Gravação de checkpoint (burn-down)

A cada Apply (backlog ou tracking), para cada base afetada:
1. `seq = max(seq)+1` daquele `(base_id, dia)` (começa em 0).
2. Inserir/atualizar (upsert por `(base_id, dia, seq)`) contando **direto na tabela
   `package` da base**:
   - `total = count(*)`
   - `ainda_stuck = count(*) filter (delivered_at is null AND status NOT IN (resolvidos))`
   - `resolvidos = count(*) filter (delivered_at is not null OR status IN (resolvidos))`
3. `label` descreve o evento (`Backlog`, `Tracking HH:MM`).

> **Importante:** a lista de status resolvidos aparece em 3 lugares (regra JS, filtro
> `package`, SQL do checkpoint). Manter **uma única fonte da verdade** (constante
> compartilhada) para não divergirem.

---

## 6. Funcionalidades de tela (UX)

### 6.1 Painel (topo)
- 4 KPIs: **Stuck ativos**, **Entregues**, **Motoristas**, **Bases**.
- Gráfico de **burn-down** (% ainda stuck por checkpoint do dia).
- **"Ocultar status"**: filtro por **exclusão** — o usuário marca os status que NÃO quer
  ver; esses pacotes somem dos KPIs *e* de todas as tabelas.

### 6.2 Aba "Por …" (pivô dimensão × faixa)
- Dimensão selecionável: **Base**, **Status**, **Cidade**, **Bairro**.
  - Se só **1 base** está no recorte, "Por Base" some e o padrão vira "Por Status".
- Linhas = valores da dimensão; colunas = as 5 faixas de dias + **Total geral**.
- Ordenável por qualquer coluna (nome A→Z padrão; clicar numa faixa ordena por contagem
  desc, desempate alfabético). Célula com 0 fica vazia.
- **Drill-down**: clicar numa célula (dimensão × faixa), no total da linha ou no total
  da coluna → abre a aba **Detalhe** já filtrada por `{dimensão, valor, faixa}`.
- Em Cidade/Bairro: clicar no **nome da linha** re-tabula por Status recortado naquele
  valor (chip "Voltar" para limpar o recorte).

### 6.3 Aba "Detalhe" (tabela de pacotes)
Colunas: Order ID, Status, Dias parados (`floor`), Range, Motorista, Cidade, Base.
- Paginação (50/página), busca por Order ID.
- Ordenação por qualquer coluna.
- **Filtro por coluna** (multi-seleção de valores distintos) em Status, Dias, Range,
  Motorista, Cidade, Base.
- Switch **"Esconder entregues"** (default ligado).
- Botão **"Copiar IDs"**: copia para o clipboard todos os Order IDs stuck ativos.
- Respeita o filtro de drill herdado do pivô (chip "Limpar").

### 6.4 Aba "Comparar bases/cidades"
- Escolhe uma dimensão (base/cidade/bairro) e **várias** chaves dela.
- Renderiza um pivô Status × Faixa **por chave**, empilhados, para comparação lado a lado.
- Menu de seleção com busca e contagem por opção (ordenado por volume desc).
- Default: base única → comparar cidades; várias bases → comparar bases.

---

## 7. Configuração

- `operacao.config.stuck_daily_reset` (bool): quando ligado, a tela mostra só o backlog
  do `last_backlog_date` mais recente. Toggle no painel de config (admin).

---

## 8. Casos de borda / decisões importantes

1. **Dias com vírgula** (`"1,37"`): normalizar para ponto antes de `parseFloat`.
2. **`floor` sempre**: nunca arredondar — `1.9` dias é faixa `1`, não `2`.
3. **CEP não apaga**: no upsert, `cep = coalesce(novo, antigo)` — tracking sem CEP não
   apaga o CEP resolvido no backlog.
4. **`delivered_at` só seta uma vez**: `case when status='Delivered' and delivered_at is null`.
5. **Base não cadastrada**: ignorar linha, reportar aviso (não falhar o upload inteiro).
6. **Nunca deletar pacote**: entregue continua na tabela (vira Delivered) — necessário
   para o burn-down contar `resolvidos`.
7. **Fonte única de status resolvidos**: evitar divergência entre JS e SQL.
8. **Aliases de estação**: manter mapa configurável; sem ele, imports re-orfanizam pacotes.
9. **Paginação > 1000**: obrigatória em backends tipo PostgREST.
10. **Concorrência do ViaCEP**: limitar (~5) para não abusar da API pública.

---

## 9. Glossário de campos do export

| Coluna do arquivo   | Campo interno   | Uso |
|---------------------|-----------------|-----|
| Shipment ID / Order ID | `codigo`     | chave do pacote |
| Latest Status / Status | `status`     | regra de stuck/resolvido |
| LM Hub Days         | `dias_preso`    | dias parado / faixa |
| Station Name        | `base_slug`     | base (via alias) |
| Latest User Name / Driver Name+ID | `driver_id`/`driver_name` | motorista |
| Agency Name         | `agency`        | informativo |
| CEP / Postal / Zip  | `cep`           | cidade/bairro via ViaCEP |

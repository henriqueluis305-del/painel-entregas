# Especificação — Funcionalidade "PNR" (Prejuízos por Ticket)

> Documento de especificação **independente de implementação**. Descreve regras de
> negócio, modelo de dados, ingestão e funcionalidades de tela para reimplementar o
> "PNR" em outro projeto (qualquer stack). O projeto original usa Next.js (App Router)
> + Postgres/Supabase, mas nada aqui depende disso.

---

## 1. O que é o PNR

**PNR** (Package Not Received) é um **ticket de prejuízo**: quando um pacote não é
recebido/entregue conforme esperado, o provedor (Shopee) abre um ticket cobrando um
valor do parceiro logístico. A tela de PNR responde: *quantos tickets existem, qual o
valor total em jogo, quantos foram revertidos (não paga), quantos vão para faturamento
(paga), quantos estão em aberto* — quebrado por **status, base, motorista e semana**.

Diferença de mentalidade em relação ao Stuck:
- **Stuck** = estado operacional do dia (pacotes presos agora).
- **PNR** = registro financeiro **cumulativo** (tickets persistem entre dias; o padrão
  de período é "tudo", não "hoje" — senão prejuízos abertos de dias anteriores somem).

### 1.1 Unidade de PNR = SPXTN

A unidade é o **SPXTN** (coluna "Order ID"/coluna C do CSV), **não** o ticket. O mesmo
SPXTN aparece em vários tickets no arquivo → **colapsa-se por SPXTN mantendo a linha de
maior `Created Time`** (1 PNR por SPXTN). Decisão de 2026-06-22.

### 1.2 Status e os 3 "buckets" derivados

Status vêm crus do provedor; há um mapa para rótulo PT:

| Status cru               | Rótulo PT                       |
|--------------------------|---------------------------------|
| `Created`                | Criada                          |
| `Reversed`               | Revertida                       |
| `Pending Driver Reply`   | Resposta de driver pendente     |
| `Review Driver Reply`    | Resposta de driver em revisão   |
| `ForBilling`             | Para Faturamento                |
| `Reviewing`              | Em revisão                      |

Status não mapeado → exibe o próprio texto cru.

Dois status são especiais e definem os **buckets** usados em toda a tela:
- **`Reversed`** → **Revertidas** (prejuízo revertido; parceiro não paga).
- **`ForBilling`** → **Para faturamento** (vai ser cobrado; **é o que soma "Valor"**).
- **Em aberto** = tudo que **não** é `Reversed` nem `ForBilling`.

Fórmulas:
```
faturadas   = count(status == ForBilling)
revertidas  = count(status == Reversed)
emAberto    = total - revertidas - faturadas
valorTotal  = sum(valor) WHERE status == ForBilling   // só ForBilling entra no valor
```

> **Regra de valor (importante):** o "Valor total" e o "Valor" por base/motorista somam
> **apenas** os de status `ForBilling`. A tabela "Por status" é a exceção: mostra o
> `sum(valor)` de cada status individualmente (inclusive não-ForBilling), para análise.

---

## 2. Modelo de dados

Reaproveita `operacao`, `base` e `driver` (ver SPEC-STUCK §2). A tabela própria:

### 2.1 `pnr` (1 linha por SPXTN)
Nome no projeto original: `shopee_pnr`. **Nunca deletar.**

| Campo            | Tipo          | Observação |
|------------------|---------------|------------|
| `spxtn`          | **PK** texto  | coluna C (Order ID) = chave da PNR |
| `driver_id`      | FK → driver, null | casado por nome/ID (§ ingestão) |
| `driver_name`    | texto, default '' | congelado do arquivo |
| `base_id`        | FK → base, null (`on delete set null`) | nem toda estação resolve p/ base |
| `station_raw`    | texto null    | estação crua original |
| `valor`          | decimal(12,2) null | PNR Order Value |
| `status`         | texto         | status cru do provedor |
| `motivo`         | texto null    | Rejection Reason |
| `prazo`          | timestamptz null | SLA Deadline |
| `created_time`   | timestamptz null | Created Time (base do filtro de período e semana) |
| `first_seen_at`  | timestamp     | |
| `last_status_at` | timestamp     | atualizado só quando o status muda |
| `updated_at`     | timestamp     | |

Índices: `(driver_id)`, `(status)`.

> **Chave = SPXTN global** (não `(base, codigo)` como no Stuck). Um SPXTN é único no
> sistema inteiro.

---

## 3. Ingestão (upload de CSV)

Arquivo: `pnr_station_ticket` (CSV). Colunas usadas:
`SPXTN`, `Driver`, `Station`, `SLA Deadline`, `PNR Order Value`, `Rejection Reason`,
`Created Time`, `Status` (e `IHS Ticket ID`, ignorado após o colapso).

Fluxo em 2 passos: **Analyze** (prévia, não grava) e **Apply** (grava em transação).

### 3.1 Parsing (colapso por SPXTN)
1. Ler CSV como objetos `{header: valor}` (parser robusto: aspas, vírgula em aspas,
   `""` escapado, CRLF, BOM).
2. Para cada linha com `SPXTN`: montar a `PnrRow` (resolver motorista e base).
3. Colapsar por SPXTN mantendo a de **maior `Created Time`**. Como o formato é
   `"YYYY-MM-DD HH:MM:SS"`, a **comparação lexicográfica** (`>`) já ordena por data.
4. `total` = linhas lidas; `rows` = PNRs únicas.

### 3.2 Valor / timestamps
- **Valor** (`parsePnrValor`): aceita `"5.34"` e `"5,34"` (vírgula PT-BR). Vazio/ inválido → null.
- **Timestamps** (`prazo`, `created_time`): só gravar se casar `^\d{4}-\d{2}-\d{2}`; senão null.

### 3.3 Resolução de base e motorista
Idêntica ao Stuck (ver SPEC-STUCK §3.4 e §3.5):
- Base via `Station` → alias → fallback `_`→`-`. Estação que não resolve fica com
  `base_id = null` (aparece como "Sem base" na tela, **não** é descartada).
- Motorista via campo `Driver` (extrai ID externo/nome, `normalized_key`). Registrar
  motoristas novos antes; só setar `driver_id` se existir, senão null (guarda o
  `driver_name` cru mesmo assim).

### 3.4 Upsert (regra de reimportação — crítica)
Upsert por `spxtn`. Em conflito, **só o `status` é atualizado**:
```
on conflict (spxtn) do update set
  status = excluded.status,
  last_status_at = case when status is distinct from excluded.status then now()
                        else last_status_at end,
  updated_at = now()
```
- **`valor`, `motivo`, `prazo`, `created_time`, base e motorista NUNCA são
  substituídos** numa reimportação — o primeiro registro manda; só o status evolui.
- `last_status_at` só muda quando o status realmente mudou.
- Inserir em lotes (chunk ~500) por limite de parâmetros.

### 3.5 Analyze (prévia)
Reporta: linhas lidas, PNRs únicas, quantas vão entrar/atualizar, **novas** vs
**status a atualizar** vs **sem mudança**, valor total no arquivo, motoristas, e
distribuição por base. Avisa estações sem base cadastrada (entram como "Sem base").

---

## 4. Filtro de período

Estado canônico na URL (searchParams). Sempre sobre **`created_time`**, no fuso de
**Brasília (America/Sao_Paulo, offset fixo −03:00** — Brasil sem horário de verão desde 2019).

| `period`          | Intervalo resolvido |
|-------------------|---------------------|
| `tudo` (default do PNR) | sem filtro |
| `hoje`            | dia atual [00:00, 23:59:59.999] UTC-3 |
| `ontem`           | dia anterior |
| `dia` + `from`    | dia específico |
| `intervalo` + `from`/`to` | de `from` até `to` (to opcional) |
| `Nd` (regex `^\d+d$`) | últimos N dias |
| `semanal`         | modo especial (ver §6.2); a query ignora período e mostra as 4 semanas mais recentes |

`from`/`to` são datas `YYYY-MM-DD` da UI, **sempre** passadas como parâmetro (`$1`/`$2`),
nunca interpoladas no SQL. Cláusula uniforme:
```
and ($1::timestamptz is null or created_time >= $1)
and ($2::timestamptz is null or created_time <= $2)
```

**Bases efetivas**: multi-seleção (avançado) > base única (básico) > todas. Quando há
bases, filtra por `base_id in (select id from base where slug = any($n))`.

---

## 5. Agregações (backend)

Uma função (`getPnrData`) roda 4 queries com o mesmo filtro de base/período:

1. **Totais globais**: `total`, `valorTotal` (só ForBilling), `revertidas`, `faturadas`,
   `motoristas` (distinct driver_id). `emAberto` = total − revertidas − faturadas.
2. **Por status**: `status, count, sum(valor)` agrupado, ordenado por count desc.
3. **Por motorista**: agrupado por `driver_id` (nome via `max`), com count, valor
   (ForBilling), revertidas, faturadas. **Top 200 por valor.**
4. **Por base**: agrupado por base, com count, valor (ForBilling), revertidas,
   faturadas; `emAberto = count − revertidas − faturadas`. `left join base` para
   incluir "Sem base".

Funções auxiliares:
- `getPnrPackages(...)`: PNRs individuais do recorte (1 por SPXTN), ordenadas por
  `created_time desc nulls last`. Alimenta a aba "Pacotes" e o drill-down.
- `getPnrBases()`: bases distintas que têm ao menos uma PNR (para o seletor).
- `getPnrWeeklyData(...)`: agregação semanal (§6.2).

---

## 6. Funcionalidades de tela (UX)

### 6.1 KPIs (topo, 5 cards)
**PNRs (únicas)**, **Valor total** (R$, só ForBilling), **Para faturamento** (qtd),
**Revertidas** (qtd), **Em aberto** (qtd). Se total = 0 → estado vazio ("Suba o CSV em Uploads").

### 6.2 Aba "Operações"
Duas seções (a 2ª troca conforme o modo):

**Por status** (sempre): tabela status × [Qtd, Valor, %]. `%` = count/total. Linha de
Total geral. Números clicáveis → drill por aquele status.

**Por base** (modo normal) **OU** Semanal (quando `period=semanal`):
- **Por base**: base × [PNRs, Valor, Para faturamento, Revertidas, Em aberto]. Cada
  número é clicável e dispara um drill específico (base + bucket). Total geral no rodapé.
- **Semanal** (`PnrWeeklyTables`): 3 tabelas empilhadas — **Geradas** (total),
  **Revertidas**, **Para faturamento** — cada uma base × semana (4 semanas mais
  recentes). Semana = `date_trunc('week', created_time)` na segunda-feira de Brasília,
  rotulada `W<nº ISO>` com tooltip do intervalo (`15/06 – 21/06`). Totais por linha e
  coluna; células clicáveis → drill (base × semana × bucket).

### 6.3 Aba "Motoristas"
Tabela ordenável (`PnrDriverTable`): Motorista, Base, PNR, Valor, Para faturamento,
Revertidas. Busca por nome, ordenação por qualquer coluna (padrão valor desc). Rodapé
informa "top 200 por valor" quando aplicável.
- **Números clicáveis** → drill por motorista (+ bucket).
- **Clique na linha** (quando há `driver_id`) → abre diálogo de **desempenho do
  motorista** no recorte atual (reaproveita componente compartilhado).
- **Identidade do motorista no drill**: usa `driverId` quando existe; senão casa por
  `driverName` (motoristas sem id).

### 6.4 Aba "Pacotes" (lista + destino do drill)
Tabela paginada (50/pág) das PNRs individuais: SPXTN, Motorista, Base, Status (badge
PT), Valor, Criada em. Busca por SPXTN ou motorista. Botão **Copiar IDs** (todos os
SPXTN do recorte filtrado).
- **Data** (`Criada em`): ecoa o horário **exato** da planilha (`DD/MM/AAAA HH:MM`), sem
  conversão de fuso — a Shopee já exporta no fuso correto.

### 6.5 Drill-down (cola tudo)
Qualquer número agregado (status/base/motorista/semana) é clicável → muda para a aba
**Pacotes** com um filtro (`PnrDrill`) aplicado sobre a lista já carregada (client-side).
Um chip "Filtrando pelo pivô: <label>" com botão Limpar. Campos do drill:

```
PnrDrill = {
  label: string           // texto do chip
  baseSlug?: string|null   // null = "sem base"
  driverId?: string|null   // null = motorista sem id (casa por nome)
  driverName?: string
  status?: string          // status cru exato (visão Por status)
  bucket?: "reversed" | "forbilling" | "open"  // colunas de Por base/motorista
  weekStart?: string       // "YYYY-MM-DD" segunda-feira (visão Semanal)
}
```
Lógica de match (`matchesDrill`), aplicada em AND:
- `baseSlug` presente → base do pacote tem que bater (inclui null = sem base).
- `driverId` presente: se ≠ null casa por id; se = null casa por (sem id **e** mesmo nome).
- `weekStart` presente → semana de Brasília do `created_time` do pacote tem que bater
  (mesmo cálculo do backend: recua até a segunda-feira).
- `status` presente → status cru exato.
- `bucket`: `reversed` → status Reversed; `forbilling` → ForBilling; `open` → nem um nem outro.

> O drill filtra o array de pacotes **no cliente** (já veio do backend com o mesmo
> recorte de base/período). Por isso o cálculo de semana no front tem que ser idêntico
> ao `date_trunc('week', … at time zone 'America/Sao_Paulo')` do SQL.

---

## 7. Casos de borda / decisões importantes

1. **1 PNR por SPXTN**: colapsar por SPXTN mantendo maior `Created Time` (lexicográfico).
2. **Reimport só atualiza status**: valor/motivo/prazo/base/motorista são imutáveis após
   o 1º registro. Evita que um reimport zere o valor.
3. **Valor = só ForBilling**: em todos os agregados de "valor" (exceto a coluna Valor da
   tabela Por status, que mostra o valor de cada status).
4. **"Sem base"**: estação que não resolve → `base_id null`, aparece como "Sem base", não
   é descartada (diferente de algumas ingestões que ignoram base desconhecida).
5. **Período default = "tudo"**: PNR é cumulativo; "hoje" esconderia prejuízos abertos.
6. **Fuso Brasília fixo −03:00**: usado no filtro de período e no `date_trunc('week')`.
   Front e back precisam calcular semana igual.
7. **Top 200 motoristas**: a tabela por motorista limita a 200 por valor (avisa no rodapé).
8. **`from`/`to` sempre parametrizados**: nunca interpolar data em SQL (injeção).
9. **Nunca deletar PNR**: histórico financeiro permanente.
10. **`last_status_at` só em mudança real**: `status is distinct from excluded.status`.

---

## 8. Glossário de colunas do CSV

| Coluna do CSV       | Campo interno   | Uso |
|---------------------|-----------------|-----|
| SPXTN               | `spxtn` (PK)    | chave da PNR |
| Driver              | `driver_id`/`driver_name` | motorista |
| Station             | `base_id`/`station_raw` | base (via alias) ou "Sem base" |
| PNR Order Value     | `valor`         | soma só em ForBilling |
| Status              | `status`        | buckets Reversed/ForBilling/Em aberto |
| Rejection Reason    | `motivo`        | informativo |
| SLA Deadline        | `prazo`         | informativo |
| Created Time        | `created_time`  | filtro de período + semana |
| IHS Ticket ID       | —               | ignorado após o colapso por SPXTN |

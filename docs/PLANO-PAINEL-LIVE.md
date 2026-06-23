# Plano — Painel LIVE (Visão 360 da Operação do Dia)

> Branch: `feat/painel-live` · Criado: 2026-06-22 · Stack: Next.js 16 + Supabase + recharts.
> Tela de **visão 360 do dia** consolidando SLA + DS + saúde da operação + ranking de motoristas.

---

## 1. Objetivo

Uma tela **live** (foco no **dia atual**, atualizável) que dá uma visão **360°** da operação:

- **Healthcheck** geral (SLA, DS, ocorrências, stuck) com semáforo.
- **Consolidado** de SLA e DS do dia, por operação/base.
- **Ranking de motoristas** por **ofensão** (ocorrências) e **prejuízo** (PNR), com **progressão** (tendência).
- **Seletor de operação** (gated por permissão) + **seletor de dataset/dia** + **filtros avançados**.

---

## 2. Decisões que precisam da sua aprovação ⚠️

### 2.1 Coluna nova `app_user.principal_operacao_id` ⚠️ APROVAÇÃO
Pra cada usuário ter uma **operação principal** (default do painel), proponho:
```sql
alter table app_user add column principal_operacao_id uuid references operacao(id);
```
- O **usuário** seta a própria principal nas configurações dele (restrito às operações que ele pode ver).
- O **super-adm** seta/edita no painel de usuários (`dashboard/admin`).
- Se vazia, cai no `operacao_id` atual (fallback).
> **Preciso do seu OK antes de criar.** (Alternativa sem coluna: reusar `operacao_id`, mas aí o user não teria um "default" separado do que o adm definiu.)

### 2.2 Fonte do "prejuízo" ⚠️ decisão
"Motoristas com maior prejuízo" = **PNR** (valores de prejuízo), que **ainda é WIP** (sem dados). Opções:
- (A) Card de prejuízo entra **quando o PNR existir** (placeholder até lá).
- (B) Por agora, usar **ocorrências/falhas do DS** como proxy de "ofensão" e deixar "prejuízo R$" pendente.
- ❓ Confirmar: ranking inicial por **ocorrências (DS)** + prejuízo só quando PNR chegar?

### 2.3 O que é "dataset" no seletor ⚠️ confirmar
Interpretei **dataset = o recorte de dados** = **Operação + Dia**. O dropdown principal seria o **Dia** (Hoje / Ontem / data específica) e os **filtros avançados** = bases, motorista, turno, categoria de status.
- ❓ É isso, ou "dataset" pra você é outra coisa (ex.: um upload/lote específico)?

---

## 3. Modelo de acesso — seletor de operação

Resolvido no servidor a partir do `app_user`:

| Usuário | Operações no seletor | Default |
|---|---|---|
| **Super-adm / `is_admin`** | **todas** as operações ativas | a principal dele, senão a 1ª |
| **`base_scope = ALL`** | todas ativas | principal |
| **`base_scope = OP_WIDE/SINGLE`** | **só a operação dele** (`operacao_id`) | essa (travada) |

- Não-admin enxerga **só a principal/permitida** — sem vazar outras operações.
- O conjunto "permitido pra setar como principal" = mesmo critério acima.

**Query (operações permitidas):**
```sql
-- ADM/ALL:
select id, slug, label from operacao where active order by label;
-- demais: resolve em código -> [operacao_id do app_user]
```

---

## 4. Config "Operação Principal"

### 4.1 Pelo próprio usuário (configurações do user)
- Página de **Configurações do usuário** (nova rota `dashboard/configuracoes` ou aba): dropdown "Operação principal" com as **operações permitidas** dele.
- Server action `setPrincipalOperacao(opId)`: valida que `opId` está no conjunto permitido do usuário, grava em `app_user.principal_operacao_id`.

### 4.2 Pelo super-adm (painel de usuários)
- Em `dashboard/admin` → aba Usuários → `UserActions`: adicionar campo **"Operação principal"** no editar-usuário.
- Server action (admin) que grava `principal_operacao_id` de qualquer usuário (sem restrição de escopo, mas validando que a op pertence ao escopo do user editado).

---

## 5. UI / Rota / Layout

**Rota:** `dashboard/live` (top-level, fora de `operacao/[slug]`, porque é cross-operação).

```
┌───────────────────────────────────────────────────────────────────┐
│  Visão 360 — Operação do dia        [ Operação ▼ ] [ Dia ▼ ] [Filtros]│
├───────────────────────────────────────────────────────────────────┤
│  HEALTHCHECK  ● SLA 81% (meta 98%)  ● DS 84%  ● Ocorr 6%  ● Stuck 51 │  ← semáforo
├──────────────────────────┬────────────────────────────────────────┤
│  SLA (gauge + evolução)  │  DS (gauge + evolução do dia)           │
├──────────────────────────┴────────────────────────────────────────┤
│  PIORES MOTORISTAS                                                  │
│  [card] Igor  ocorr 7 · DS 63% · ▼ caindo    [card] Gustavo ...     │
├───────────────────────────────────────────────────────────────────┤
│  Tabela motoristas: nome · saiu · entregues · DS% · ocorr · prejuízo│
└───────────────────────────────────────────────────────────────────┘
```

- **Filtros na URL** (searchParams): `op`, `dia`, `bases`, `turno`, `motorista`.
- Reaproveita componentes: `HalfGauge`, `BurnDownChart` (evolução), `MiniDonut`, `KpiCard`, tabelas com sort.
- **"Live"**: `revalidate` curto / botão "atualizar" / opcional auto-refresh (Fase 2).

---

## 6. Queries (por seção)

> `:op` = operacao_id selecionado · `:dia` = data_pt_br · bases da op via `join base b on b.id=x.base_id and b.operacao_id=:op`.

### 6.1 SLA do dia (consolidado da operação)
```sql
select sum(r.total) total, sum(r.entregues) entregues,
       round(sum(r.entregues)::numeric / nullif(sum(r.total),0) * 100, 1) sla_pct,
       sum(r.ocorrencias) ocorrencias, sum(r.faltantes) faltantes, sum(r.outros) outros
from shopee_sla_record r join base b on b.id = r.base_id
where b.operacao_id = :op and r.data_pt_br = :dia;
```

### 6.2 DS do dia (consolidado)
```sql
select sum(ds.saiu) saiu, sum(ds.entregues) entregues, sum(ds.em_rota) em_rota,
       sum(ds.ocorrencias) ocorrencias,
       round(sum(ds.entregues)::numeric / nullif(sum(ds.saiu),0) * 100, 1) ds_pct,
       count(distinct ds.driver_id) motoristas
from shopee_ds_driver ds join base b on b.id = ds.base_id
where b.operacao_id = :op and ds.data_pt_br = :dia;
```

### 6.3 Ranking de motoristas (ofensão / prejuízo / DS)
```sql
select d.id, d.name,
       sum(ds.saiu) saiu, sum(ds.entregues) entregues,
       sum(ds.ocorrencias) ocorrencias,
       round(sum(ds.entregues)::numeric / nullif(sum(ds.saiu),0) * 100, 1) ds_pct
       -- , coalesce(pnr.prejuizo,0) prejuizo   (quando PNR existir)
from shopee_ds_driver ds
  join driver d on d.id = ds.driver_id
  join base b on b.id = ds.base_id
where b.operacao_id = :op and ds.data_pt_br = :dia
group by d.id, d.name
order by ocorrencias desc, ds_pct asc
limit 10;   -- piores
```

### 6.4 Progressão (tendência do motorista — últimos N dias)
```sql
select ds.data_pt_br,
       round(sum(ds.entregues)::numeric / nullif(sum(ds.saiu),0) * 100, 1) ds_pct,
       sum(ds.ocorrencias) ocorrencias
from shopee_ds_driver ds join base b on b.id = ds.base_id
where b.operacao_id = :op and ds.driver_id = :driver
group by ds.data_pt_br
order by ds.data_pt_br;   -- ordenar por data real no código (DD/MM/YYYY)
```
→ seta ▲/▼ comparando o último dia com a média anterior.

### 6.5 Evolução SLA/DS do dia/semana
- **DS do dia (horário):** `shopee_ds_checkpoint` (já filtrado pro dia mais recente).
- **SLA por dia (semana):** `shopee_sla_record` agregado por `data_pt_br`.

### 6.6 Healthcheck (derivado, no código)
| Indicador | Fonte | Verde / Amarelo / Vermelho |
|---|---|---|
| SLA% | 6.1 | ≥98 / 90–98 / <90 |
| DS% | 6.2 | ≥90 / 80–90 / <80 |
| Ocorrência % | 6.2 (ocorr/saiu) | ≤3 / 3–7 / >7 |
| Stuck ativos | `shopee_package` (não entregues do dia) | thresholds por operação |
| Saúde geral | pior dos acima | — |

---

## 7. Fases de implementação

### Fase A — Acesso + seletores
- [ ] ⚠️ Coluna `principal_operacao_id` (após OK) + helper `operacoesPermitidas(profile)`
- [ ] Rota `dashboard/live` + seletor de operação (gated) + dia + filtros avançados (URL)
- [ ] Config do usuário (setar principal) + edição pelo super-adm em `admin`

### Fase B — Consolidado + Healthcheck
- [ ] Queries 6.1/6.2 + cards de SLA/DS + barra de healthcheck (semáforo)
- [ ] Gauges + evolução (reuso de componentes)

### Fase C — Motoristas (ofensão / progressão)
- [ ] Ranking piores (6.3) em cards + tabela ordenável (6.3)
- [ ] Progressão por motorista (6.4) com seta de tendência
- [ ] Coluna "prejuízo" entra com o PNR (WIP)

### Fase D — Live
- [ ] Atualização (revalidate curto / botão / auto-refresh opcional)

---

## 8. Riscos / pendências
| Item | Nota |
|---|---|
| Prejuízo (R$) | depende do **PNR** (WIP) — ranking inicial por ocorrências |
| `data_pt_br` é texto DD/MM/YYYY | ordenar/parsear por data real no código |
| Multi-operação | hoje só Shopee tem dados; estrutura já é cross-op |
| "Live" de verdade | sem realtime do Supabase por ora; usar revalidate/refresh |

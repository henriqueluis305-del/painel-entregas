# Fluxo e Lógica de Dados — Painel de Entregas (Next.js + Supabase)

> Atualizado em 2026-06-07. Stack: Next.js (App Router) + Supabase (Postgres + Auth).
> Marca o que **já está implementado** vs **planejado**.

---

## 0. Resposta direta: o snapshot diário de motoristas

**Sim — o sistema está projetado para gerar uma "fotografia" diária do desempenho de todos os motoristas.** Isso é o par de tabelas `snapshot` + `snapshot_driver`:

- `snapshot` = 1 registro por **base por dia** (constraint `UNIQUE (base_id, data_pt_br)`), com os totais agregados (SLA%, DS%, entregues, em rota, ocorrências, etc.).
- `snapshot_driver` = 1 registro **por motorista** dentro daquele snapshot, com `saiu`, `entregues`, `em_rota`, `ocorrencias` **congelados** no momento da foto.

Ou seja: a estrutura guarda, por dia e por base, o desempenho individual de **cada motorista** — exatamente o que você descreveu.

**Ressalvas importantes (estado atual):**
1. **Ainda não está implementado** no app Next — é a **Fase 4**. Hoje as tabelas existem (vazias), mas não há tela que gere o snapshot.
2. **Não é automático por enquanto.** No desenho herdado, o snapshot é **disparado por um usuário** ("Registrar snapshot") depois de importar as planilhas do dia. O `UNIQUE (base_id, data_pt_br)` + UPSERT garante **1 por dia** (o último do dia sobrescreve). Se você quiser geração **automática diária**, dá pra adicionar um **cron** (ex.: Vercel Cron) que dispara o cálculo/registro — mas isso é um acréscimo, não está no escopo atual.
3. **Retenção:** snapshots (e seus motoristas) ficam **180 dias**; `SlaDsRecord` (histórico agregado) é indeterminado.

---

## 1. Modelo de dados (tabelas no Supabase)

```
operacao (cliente: shopee, meli, jt, loggi, imile)
   └── base (ponto/rota: xpt-adr-02, ...)         UNIQUE(operacao_id, slug)
         ├── driver (motorista)                    UNIQUE(base_id, normalized_key)
         ├── upload (cada arquivo recebido)
         │     └── package (PNR finalizado)        UNIQUE(base_id, codigo)
         ├── snapshot (1 por base por DIA)          UNIQUE(base_id, data_pt_br)
         │     └── snapshot_driver (1 por motorista) ← desempenho congelado
         ├── sla_ds_record (histórico agregado)     UNIQUE(base_id, data_pt_br)
         └── liberacao (pagamento OK/NOK)

app_user (espelha auth.users do Supabase) ── operacao_id, base_scope, role, perms
user_base (N:N usuário↔base, p/ escopo SINGLE)
cep_cache (cache ViaCEP)
```

### Identidade e acesso
- `app_user.id` == `auth.users.id` (Supabase Auth). Senhas só no Supabase.
- `role` (MONITORAMENTO, SUPERVISOR, SUPERVISOR_FINANCEIRO, COORDENADOR, ADMIN) define um **preset de permissões**; `extra_perms`/`denied_perms` ajustam por usuário.
- `base_scope`: `SINGLE` (bases em `user_base`), `OP_WIDE` (toda a operação), `ALL` (tudo, admin).

---

## 2. Quem gera, quem armazena, quem lê

| Dado | Origem | Onde grava | Quem lê |
|---|---|---|---|
| Sessão/login | Supabase Auth | cookie (browser) + `auth.users` | middleware, server components |
| Perfil (role/escopo/perms) | `app_user` | Postgres | layout/sidebar, gates de página |
| Operações/Bases | Admin (UI) | `operacao`, `base` | sidebar, Home, páginas de operação |
| CSV SLA (planilha) | upload do usuário | `upload` + `package` (planejado) | cálculo SLA |
| XLSX DS (planilha) | upload do usuário | `upload` (planejado) | cálculo DS + snapshot |
| Snapshot do dia | botão "Registrar" (planejado) | `snapshot` + `snapshot_driver` | Histórico, gráficos |
| Histórico SLA/DS | manual ou XLSX (planejado) | `sla_ds_record` | página SLA & DS |
| Liberação | UI (planejado) | `liberacao` | admin/financeiro |
| CEP | ViaCEP (planejado) | `cep_cache` | exibição cidade/bairro |

---

## 3. Pipeline planejado do "SLA & DS Hoje" (Fase 3-4)

```
Usuário seleciona CSV (SLA) + XLSX (DS) na base
        │
        ▼  (server action, parsing com lib JS — papaparse / xlsx)
   CSV → linhas → { codigo, cep, tel, driver, status }
   XLSX → linhas → { driver, saiu, entregues, em_rota, ocorrencias }
        │
        ▼  cálculo
   calcSLA(): % entregues sobre total (via STATUS_MAP)
   calcDS():  % entregues sobre "saiu" por motorista
        │
        ▼  exibição ao vivo (cards + tabela de motoristas)
        │
        ▼  [Registrar snapshot]  (UPSERT por base+dia)
   snapshot (agregados) + snapshot_driver (cada motorista)
   + opcional: package (só status finalizadores; 180d)
```

> O **parser** depende do layout exato das planilhas da Shopee (posição das colunas). Por isso aguardamos **1 .csv + 1 .xlsx de exemplo** antes de implementar — para não calcular errado.

---

## 4. Estado de implementação (2026-06-07)

| Área | Status |
|---|---|
| Auth (login/logout/proteção/permissões) | ✅ |
| Sidebar (Plataforma / Operações / Gestão) por permissão e escopo | ✅ |
| Home com KPIs reais (operações/bases/usuários) | ✅ |
| Admin: operações/bases (criar) + lista de usuários | ✅ |
| Página por operação (bases) | ✅ |
| Banco com defaults corretos (id/timestamps) | ✅ |
| **SLA & DS Hoje** (upload + parse + cálculo) | ⏳ Fase 3 (precisa dos arquivos) |
| **Snapshot diário** (snapshot + snapshot_driver) | ⏳ Fase 4 |
| Histórico, Motoristas, SLA & DS, Liberação | ⏳ Fases 6-7 |
| Criar/editar usuário no Admin (perms/escopo/bases) | ⏳ Fase 8 |
| Cron diário automático (opcional) | 💡 ideia futura |

---

## 5. Segurança (resumo)
- Toda leitura/escrita sensível passa pelo **servidor** (server components / server actions).
- O perfil e queries admin usam a **service role** (só no servidor; nunca no browser).
- O browser só recebe a **anon key** (pública) + o JWT do usuário (em cookie).
- Escopo por base é aplicado no código (e pode ser reforçado por RLS no Postgres — planejado).

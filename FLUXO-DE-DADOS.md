# Mapeamento Completo do Fluxo de Dados — Painel de Entregas

> Documento técnico — quem gera, quem armazena, quem envia, e para onde.
> Gerado em: 2026-05-23

---

## Índice

1. [Visão geral em uma página](#1-visão-geral-em-uma-página)
2. [Camadas de armazenamento](#2-camadas-de-armazenamento)
3. [Configuração e segredos](#3-configuração-e-segredos)
4. [Estado em memória (RAM do browser)](#4-estado-em-memória-ram-do-browser)
5. [Storage abstrato: como Local x Produção decide o caminho](#5-storage-abstrato-como-local-x-produção-decide-o-caminho)
6. [Fluxo 1 — Autenticação (Supabase Auth)](#fluxo-1--autenticação-supabase-auth)
7. [Fluxo 2 — Perfis de usuário (Supabase REST)](#fluxo-2--perfis-de-usuário-supabase-rest)
8. [Fluxo 3 — Import CSV (Base SLA)](#fluxo-3--import-csv-base-sla)
9. [Fluxo 4 — Import XLSX (Base DS)](#fluxo-4--import-xlsx-base-ds)
10. [Fluxo 5 — Snapshot de Monitoramento](#fluxo-5--snapshot-de-monitoramento)
11. [Fluxo 6 — Histórico SLA/DS (import manual ou em massa)](#fluxo-6--histórico-slads-import-manual-ou-em-massa)
12. [Fluxo 7 — Cache de CEPs (ViaCEP)](#fluxo-7--cache-de-ceps-viacep)
13. [Fluxo 8 — Liberação de pagamento](#fluxo-8--liberação-de-pagamento)
14. [Fluxo 9 — Criação de base / manifest local](#fluxo-9--criação-de-base--manifest-local)
15. [Fluxo 10 — Logos (empresa e operação)](#fluxo-10--logos-empresa-e-operação)
16. [Catálogo de chaves persistentes](#catálogo-de-chaves-persistentes)
17. [Catálogo de endpoints externos](#catálogo-de-endpoints-externos)
18. [Riscos e pontos cegos](#riscos-e-pontos-cegos)

---

## 1. Visão geral em uma página

```
┌───────────────────── BROWSER ─────────────────────────────────────────────┐
│                                                                           │
│  Arquivos do usuário (.csv, .xlsx) ──► RAM (csvData, xlsxData)            │
│                                          │                                │
│                                          ├──► calcSLA() / calcDS()        │
│                                          │                                │
│                                          └──► Snapshot ─► Storage.put     │
│                                                                           │
│  localStorage:                                                            │
│    • cep_cache                            (cache permanente)              │
│    • __data__<path>                       (override DEV — substitui rede) │
│    • __manifest__                         (override DEV — listDir)        │
│                                                                           │
│  RAM (state.js): currentUser, csvData, xlsxData, logsData, slaDsHistory…  │
│                                                                           │
└───┬───────────────────┬──────────────────────────┬────────────────────────┘
    │                   │                          │
    │ POST /auth        │ PUT /contents/<path>     │ GET /<cep>/json
    │ GET /rest/v1/...  │ GET /<path>              │
    ▼                   ▼                          ▼
┌──────────┐  ┌───────────────────────┐  ┌──────────────────┐
│ Supabase │  │   GitHub (repo)       │  │ ViaCEP (público) │
│  Auth +  │  │  arquivos JSON +      │  │                  │
│ Postgres │  │  PNGs commitados      │  └──────────────────┘
│ REST     │  │  via API + raw CDN    │
└──────────┘  └───────────────────────┘
```

### Camadas de persistência (resumo)

| Onde | O quê | Tipo |
|---|---|---|
| **Supabase Auth** | Sessão de login, JWT | Servidor (gerenciado) |
| **Supabase Postgres** | Tabela `profiles`, tabela `liberacoes` | Servidor (PostgREST) |
| **GitHub repo** | `operacoes/*/<base>/logs.json`, `operacoes/shopee/sla-ds-history.json`, `operacoes/<op>/logo.png` | Arquivos commitados |
| **localStorage (DEV)** | `__data__<path>`, `__manifest__` | Override local; substitui o GitHub em `localhost` |
| **localStorage (sempre)** | `cep_cache` | Cache permanente do navegador |
| **RAM do browser** | Tudo em `state.js` | Volátil — perdido ao recarregar |
| **Arquivo CSV/XLSX do usuário** | Lido em memória, **não é persistido** | Apenas em RAM até virar snapshot |

---

## 2. Camadas de armazenamento

### A. Supabase (autenticação + relacionais)

- URL base: `CONFIG.SUPABASE_URL` (definida em [config.js](config.js), modelo em [config.example.js](config.example.js))
- Acesso a partir do browser via `apikey` pública + `Authorization: Bearer <jwt-do-usuário>`
- Tabelas usadas:
  - `profiles` (id, email, empresa, role, operacao, base)
  - `liberacoes` (user_id, operacao, base, status, observacao)

### B. GitHub (arquivos JSON + assets de imagem)

- Repo: `CONFIG.GH_OWNER/CONFIG.GH_REPO`, branch `CONFIG.GH_BRANCH`
- Leitura via `raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>?t=<timestamp>` (cache-buster)
- Escrita via `api.github.com/repos/<owner>/<repo>/contents/<path>` (PUT autenticado com `GH_TOKEN`)
- Estrutura no repo:

```
operacoes/
  shopee/
    sla-ds-history.json          ← histórico agregado de SLA/DS
    logo.png
    <base>/
      .gitkeep                   ← marca pasta criada
      logs.json                  ← snapshots da base
  meli/   ...
  jt/     ...
  loggi/  ...
  imile/  ...
```

### C. localStorage do navegador

- Modo DEV (`location.hostname` ∈ `localhost`, `127.0.0.1`, vazio):
  - `Storage.get(path)` lê primeiro `__data__<path>` do localStorage; se nada, faz `fetch('data/<path>')` (arquivos servidos pelo Live Server)
  - `Storage.put(path, content)` grava `__data__<path>` no localStorage (não toca no arquivo em disco nem no GitHub)
  - `__manifest__` substitui `data/manifest.json` quando bases são criadas em dev
- Modo PROD: localStorage é usado **apenas** para `cep_cache`

### D. RAM (não persiste)

Todo o objeto `state` em [js/state.js](js/state.js) — perdido a cada refresh.

### E. Externo (somente leitura)

- ViaCEP (`viacep.com.br/ws/<cep>/json/`) — consulta de bairro/cidade, sem auth.

---

## 3. Configuração e segredos

Carregado por [index.html:283-297](index.html#L283-L297) a partir de `window.CONFIG` (`config.js`). Exposto globalmente:

| Constante | Origem | Uso |
|---|---|---|
| `SUPABASE_URL` | CONFIG | Endpoint Supabase |
| `SUPABASE_KEY` | CONFIG | apikey pública (anon ou service para criar users — atenção segurança) |
| `ADMIN_EMAIL` | CONFIG | Login considerado admin no client-side |
| `GH_OWNER`, `GH_REPO`, `GH_BRANCH` | CONFIG | Identifica o repo de dados |
| `GH_TOKEN` | CONFIG | PAT do GitHub usado em escrita — **vaza para o browser** |
| `GH_RAW` | derivado | `raw.githubusercontent.com/<owner>/<repo>/<branch>` |
| `GH_API` | derivado | `api.github.com/repos/<owner>/<repo>` |

> **Alerta de segurança:** `GH_TOKEN` é embarcado no JavaScript do browser. Qualquer usuário autenticado vê o token nas DevTools. Em produção isso o exporia escopo `repo`. Tratar como dívida arquitetural.

---

## 4. Estado em memória (RAM do browser)

Arquivo: [js/state.js](js/state.js)

| Variável | Tipo | Quem escreve | Quem lê | Persiste? |
|---|---|---|---|---|
| `currentUser` | obj | `auth.js:doLogin`, `app.js:autoLoginAdmin` | toda a UI | Não |
| `currentToken` | string | `auth.js:doLogin` | `auth.js:supaReq` | Não |
| `isAdmin`, `canEdit` | bool | `auth.js:doLogin` | `app.js:canSee`, sidebar | Não |
| `userRole`, `userOp`, `userBase` | string | `auth.js:doLogin` (via Supabase `profiles`) | toda a UI | Não |
| `currentOp`, `currentBase` | string | `app.js:afterRender`, `admin.js:selectBase` | snapshots, render | Não |
| `csvData` | array | `data.js:loadCSV` | `calcSLA`, `renderSLATable`, snapshot | Não |
| `xlsxData` | array | `data.js:loadXLSX` | `calcDS`, `renderDSTables`, snapshot | Não |
| `logsData` | array | `github.js:loadLogs`, `github.js:saveSnapshot` | `renderHistoricoFromLogs`, `updateCharts` | Não |
| `slaDsHistory` | array | `admin.js:loadSlaDsPage`, `admin.js:saveSlaDs` | `renderSlaDsContent`, `renderComparePanel` | Não |
| `slaDsBases` | array | `admin.js:loadSlaDsPage` (via `Storage.listDir`) | filtros do painel | Não |
| `slaDsActiveBases`, `slaDsPeriod`, `slaDsCompare` | filtros UI | `admin.js:toggle*` | renderização | Não |
| `cepCache` | obj | `data.js:resolveAllCEPs` | mostra cidade/bairro | **Sim** (localStorage) |
| `sortStates` | obj | `ui.js:sortTbl` | reordenação de tabelas | Não |
| `libSel` | 'ok'/'nok' | `pages.js:selLib` | `submitLib` | Não |

---

## 5. Storage abstrato: como Local x Produção decide o caminho

Arquivo: [js/storage.js](js/storage.js)

```
IS_LOCAL = ['localhost','127.0.0.1',''].includes(location.hostname)
```

| Método | Modo DEV | Modo PROD |
|---|---|---|
| `Storage.get(path)` | localStorage `__data__<path>` → fallback `fetch('data/<path>')` | `ghGet(path)` → `raw.githubusercontent.com/.../<path>` |
| `Storage.getJSON(path)` | mesma `.get` + `JSON.parse` | mesma `.get` + `JSON.parse` |
| `Storage.put(path, content, msg)` | grava `__data__<path>` em localStorage | `ghPut(path)` → PUT `/contents/<path>` (commit no repo) |
| `Storage.listDir(path)` | `__manifest__` (localStorage) → fallback `fetch('data/manifest.json')` | `ghListDir(path)` → API `/contents/<path>` |

**Importante:** em DEV, escrever NÃO atualiza os arquivos em `data/` — só o localStorage. Para "limpar" o estado dev, basta limpar o site data do navegador.

---

## Fluxo 1 — Autenticação (Supabase Auth)

**Arquivo principal:** [js/auth.js](js/auth.js)

### Trigger
- Em desenvolvimento: `autoLoginAdmin()` em [js/app.js:142](js/app.js#L142) bypassa o login.
- Em produção/produção-simulada: `doLogin()` invocado pelo botão na tela de login.

### Caminho dos dados

```
Form HTML (email, senha)
    │
    ▼
auth.js:doLogin
    │
    ├── POST  SUPABASE_URL/auth/v1/token?grant_type=password
    │   request body: { email, password }
    │   response:     { access_token, user }
    │
    ├── grava em RAM: currentToken, currentUser
    │
    ├── se NÃO é ADMIN_EMAIL:
    │   GET SUPABASE_URL/rest/v1/profiles?id=eq.<user.id>
    │   response: [{ role, operacao, base, ... }]
    │   → grava em RAM: userRole, userOp, userBase
    │
    └── grava em RAM: isAdmin, canEdit
        → buildSidebar() e navigateTo(página inicial do cargo)
```

### Logout — `auth.js:doLogout`

```
POST SUPABASE_URL/auth/v1/logout  (com Bearer currentToken)
    └── zera todo o state em RAM (currentUser, csvData, xlsxData, logsData, etc.)
```

### O que **não é** persistido pelo client
- `currentToken` fica apenas em RAM → refresh derruba a sessão.
- Não há `localStorage.setItem('token', ...)`.

---

## Fluxo 2 — Perfis de usuário (Supabase REST)

**Tabela:** `profiles` no Postgres do Supabase (acessada via PostgREST em `/rest/v1/profiles`).

### Schema observado em código

```
profiles {
  id        uuid   (PK, igual ao auth.users.id)
  email     text
  empresa   text   (na UI: "Nome")
  role      text   ('monitoramento'|'supervisor'|'supervisor_financeiro'|'coordenador')
  operacao  text   (∈ ALL_OPS: shopee, meli, jt, loggi, imile)
  base      text   (slug ex: 'xpt-adr-02')
}
```

### Operações

| Operação | Arquivo | Endpoint |
|---|---|---|
| Listar usuários | [admin.js:96-110](js/admin.js#L96-L110) `loadAdminClients` | `GET /rest/v1/profiles?select=*&order=empresa.asc` |
| Ler próprio perfil no login | [auth.js:42](js/auth.js#L42) | `GET /rest/v1/profiles?id=eq.<user.id>` |
| Criar perfil (com user novo) | [admin.js:70-83](js/admin.js#L70-L83) `createUser` | 1) `POST /auth/v1/admin/users` → 2) `POST /rest/v1/profiles` |

Após criar um perfil com `base`, o admin também grava `operacoes/<op>/<base>/.gitkeep` via `Storage.put` para garantir que a pasta exista no repo.

---

## Fluxo 3 — Import CSV (Base SLA)

**Arquivo:** [js/data.js:1-24](js/data.js#L1-L24) `loadCSV`

### Origem
- Usuário clica em "Selecionar .CSV" no painel da base (admin: `basePanelHTML`; supervisor: `renderHoje`).
- Aceita **múltiplos arquivos** (Shopee gera SLA em chunks).

### Processamento

```
File[]  (input do usuário, em memória)
   │
   ▼
para cada file:
   text = await file.text()
   linhas (pula header), parseCSVRow(row)
   se cols.length >= 23:
     merged[codigo] = {
       codigo : cols[0],
       cep    : cols[6],
       tel    : cols[12],
       driver : cols[13],
       status : cols[22]
     }
   │
   ▼
csvData = Object.values(merged)   ← deduplicado por código de PNR
   │
   ├─► resolveAllCEPs()  (Fluxo 7)
   └─► updateAll()       → render imediato dos blocos SLA/DS
```

### Destino

| Onde | Persiste? |
|---|---|
| `csvData` (RAM) | Não. Só fica em memória até o snapshot ou refresh. |
| Arquivo CSV original | Não é enviado a nenhum servidor. Fica no disco do usuário. |
| Dados normalizados | Vão para snapshot **indiretamente** (snapshot só salva os números agregados de `calcSLA()`, não os PNRs). |

> **Observação:** o conteúdo bruto do CSV (PNRs individuais, telefones, CEPs) **nunca sai do browser** nem é gravado em disco/GitHub.

---

## Fluxo 4 — Import XLSX (Base DS)

**Arquivo:** [js/data.js:26-48](js/data.js#L26-L48) `loadXLSX`

### Origem
- Usuário seleciona uma planilha (`.xlsx`/`.xls`) no mesmo painel da base.
- Lib `XLSX.js` (CDN cdnjs) parseia em arrayBuffer.

### Processamento

```
File → ArrayBuffer → XLSX.read → sheet_to_json(header:1)
   │
   ▼
para cada linha (i ≥ 1):
   xlsxData.push({
     driver      : r[0],
     saiu        : r[5],
     entregues   : r[8],
     emRota      : r[10],
     ocorrencias : r[12]
   })
   │
   ▼
updateAll()  → render DS por motorista, totalizadores
```

### Destino

| Onde | Persiste? |
|---|---|
| `xlsxData` (RAM) | Não. |
| Arquivo XLSX original | Não sai do browser. |
| Dados de motorista | **Vão para snapshot:** [github.js:89](js/github.js#L89) `motoristas: xlsxData`. |

---

## Fluxo 5 — Snapshot de Monitoramento

**Arquivo:** [js/github.js:74-114](js/github.js#L74-L114) `saveSnapshot(op, base)`

### Trigger
Botão "📸 Registrar Snapshot" em `basePanelHTML` ([pages.js:302](js/pages.js#L302)) ou `renderHoje` ([pages.js:353](js/pages.js#L353)).

### Pipeline completo

```
                csvData                xlsxData
                   │                       │
                   ▼                       ▼
                calcSLA()              calcDS()
                   │                       │
                   └────────┬──────────────┘
                            ▼
              snap = {
                data:    now.toLocaleDateString('pt-BR'),
                hora:    now.toLocaleTimeString('pt-BR'),
                ts:      now.toISOString(),
                sla_pct, ds_pct,
                total, entregues, em_rota, ocorrencias, faltantes, devolvidos,
                motoristas: xlsxData        ← TODOS os motoristas com saiu/ent/rota/oc
              }
                            │
                            ▼
   logPath(op,base) = `operacoes/${op}/${safeBase}/logs.json`
                            │
                            ▼
   existing = await Storage.getJSON(logPath) || []
   existing.push(snap)
                            │
                            ▼
   await Storage.put(logPath, JSON.stringify(existing,null,2), msgCommit)
                            │
              ┌─────────────┴──────────────┐
              ▼                            ▼
        DEV (localhost)              PROD
        localStorage                 GitHub PUT
        __data__operacoes/...        commit `snapshot op/base — dd/mm/aaaa hh:mm`
                            │
                            ▼
   logsData = existing      ← RAM atualizada
   renderHistoricoFromLogs()
   updateCharts()
```

### Onde os dados ficam (por modo)

| Modo | Caminho final |
|---|---|
| Local (`localhost`) | `localStorage['__data__operacoes/<op>/<base>/logs.json']` |
| Produção | Commit no GitHub: `operacoes/<op>/<base>/logs.json` (branch configurado) |

**O snapshot é cumulativo:** cada `saveSnapshot` lê o arquivo inteiro, faz `.push`, e regrava. Não há controle de concorrência — dois usuários salvando ao mesmo tempo podem causar conflito de SHA na API do GitHub.

---

## Fluxo 6 — Histórico SLA/DS (import manual ou em massa)

**Arquivos:** [js/admin.js:1](js/admin.js#L1), [js/admin.js:330-353](js/admin.js#L330-L353), [js/admin.js:592-729](js/admin.js#L592-L729)

### Caminho único de armazenamento

```
SLA_DS_PATH = `operacoes/shopee/sla-ds-history.json`
```

Independente do modo de import (texto colado ou XLSX), o destino final é sempre esse arquivo.

### Modo A — Import por texto colado

```
Usuário cola linhas no modal
   campo SLA:  "XPT-LRS-01<TAB>95.2<TAB>1000<TAB>952"
   campo DS:   "XPT-LRS-01<TAB>88.1<TAB>500<TAB>441"
        │
        ▼
parseSlaLine / parseDsLine (constants.js)
        │
        ▼
slaMap[base] = { sla_pct, sla_rec, sla_ent }
dsMap[base]  = { ds_pct,  ds_rec,  ds_ent  }
        │
        ▼
para cada base ∈ slaMap ∪ dsMap:
   newRecords.push({
     ts, data, base,
     sla_pct, sla_rec, sla_ent,
     ds_pct,  ds_rec,  ds_ent
   })
```

### Modo B — Import em massa (XLSX)

```
loadSlaDsXlsx(file)
   ├── XLSX.read → sheet_to_json
   ├── detecta colunas por header (case-insensitive) OU fallback posicional
   ├── _parseXlsxDate(raw)   ← aceita serial Excel ou dd/mm/aaaa
   └── _slaDsXlsxParsed.push({ ts, data, base, sla_pct, sla_rec, sla_ent,
                               ds_pct, ds_rec, ds_ent })
   → variável temporária EM RAM (não persistido ainda)
   → preview na tabela do modal
```

### Persistência (comum aos 2 modos) — `saveSlaDs`

```
existing = await Storage.getJSON(SLA_DS_PATH) || []     ← arquivo atual no repo/localStorage
   │
   ▼
kept = existing.filter(r => ¬ algum newRecord tem mesmo data+base)
       ↑
       └─ dedupe por (data, base): novo SOBRESCREVE o antigo
   │
   ▼
updated = [...kept, ...newRecords]
   │
   ▼
Storage.put(SLA_DS_PATH, JSON.stringify(updated, null, 2), "sla-ds import <data>")
   │
   ▼
slaDsHistory = updated    ← RAM atualizada
renderSlaDsContent()      ← redesenha gráficos + heatmaps
```

### Estrutura do registro

```json
{
  "ts":      "2026-05-22T15:00:00.000Z",
  "data":    "22/05/2026",
  "base":    "xpt-adr-02",
  "sla_pct": 95.3,
  "sla_rec": 120,
  "sla_ent": 114,
  "ds_pct":  88.1,
  "ds_rec":  90,
  "ds_ent":  79
}
```

### Bases existentes (detecção)

```
loadSlaDsPage()
   slaDsBases = (Storage.listDir(`operacoes/shopee`))
                 .filter(type==='dir').map(name)
```

Em DEV usa `__manifest__` (ou `data/manifest.json` como fallback). Em PROD lista via API do GitHub.

---

## Fluxo 7 — Cache de CEPs (ViaCEP)

**Arquivo:** [js/data.js:60-71](js/data.js#L60-L71) `resolveAllCEPs`

```
csvData → extrai CEPs únicos (>= 8 chars)
   │
   ▼
para cada cep ∉ cepCache (limite: 150 por import):
   GET https://viacep.com.br/ws/<cep>/json/
   resposta → cepCache[cep] = { cidade, bairro }
   │
   ▼
localStorage.setItem('cep_cache', JSON.stringify(cepCache))
```

### Características
- Persiste indefinidamente no navegador.
- **Nunca é enviado** ao GitHub nem ao Supabase.
- Hidratado no boot: `state.js:20` lê `localStorage['cep_cache']`.
- Limite de 150 por import evita estourar rate limit do ViaCEP em CSVs grandes.

---

## Fluxo 8 — Liberação de pagamento

**Arquivo:** [js/pages.js:431-447](js/pages.js#L431-L447) `submitLib`

### Trigger
Página `sup-liberacao` (apenas cargos `supervisor` e `supervisor_financeiro`).

### Pipeline

```
UI: botões OK / NOK + textarea de observações
   │
   ▼
state em RAM: libSel = 'ok' | 'nok'
   │
   ▼
POST SUPABASE_URL/rest/v1/liberacoes
  body: {
    user_id    : currentUser.id,
    operacao   : userOp,
    base       : userBase,
    status     : 'ok' | 'nok',
    observacao : <texto>
  }
  headers: apikey + Bearer currentToken
```

### Tabela `liberacoes` (inferida)

```
liberacoes {
  id          uuid/serial
  user_id     uuid     → FK profiles.id
  operacao    text
  base        text
  status      'ok' | 'nok'
  observacao  text
  created_at  timestamptz   (default no Postgres)
}
```

Não há tela para visualizar liberações — só insere. A leitura, se existir, ainda não está implementada no frontend.

---

## Fluxo 9 — Criação de base / manifest local

**Arquivo:** [js/admin.js:29-51](js/admin.js#L29-L51) `promptNewBase`

```
Usuário clica "+ Nova base" no painel da operação
   prompt('Nome da nova base:') → "XPT-ADR-03"
   slug = "xpt-adr-03"
        │
        ▼
Storage.put(`operacoes/${op}/${slug}/.gitkeep`, '', commitMsg)
   ├─ DEV:   localStorage['__data__operacoes/<op>/<slug>/.gitkeep'] = ''
   │         + atualiza __manifest__ (adiciona slug em manifest[op])
   └─ PROD:  cria arquivo .gitkeep no repo (cria pasta)
        │
        ▼
loadBasesForOp(op)   → re-render dos botões
```

---

## Fluxo 10 — Logos (empresa e operação)

| Logo | Caminho | Lido por |
|---|---|---|
| Empresa (sidebar/login) | `assets/logo.png` (relativo, sempre local) | [ui.js:18-28](js/ui.js#L18-L28) `loadCompanyLogo` |
| Operação (topbar) | DEV: `data/operacoes/<op>/logo.png` / PROD: `${GH_RAW}/operacoes/<op>/logo.png?t=<ts>` | [ui.js:30-36](js/ui.js#L30-L36) `loadOpLogo` |
| Operação (sidebar nav) | mesma lógica, em [app.js:20](js/app.js#L20) | `buildSidebar` |

São arquivos PNG. Não trafegam dados, apenas exibição.

---

## Catálogo de chaves persistentes

### GitHub repo (paths)

| Path | Conteúdo | Quem escreve |
|---|---|---|
| `operacoes/<op>/<base>/logs.json` | Array de snapshots (calculados a partir de CSV+XLSX) | `github.js:saveSnapshot` |
| `operacoes/shopee/sla-ds-history.json` | Array de registros SLA/DS (manual ou XLSX) | `admin.js:saveSlaDs` |
| `operacoes/<op>/<base>/.gitkeep` | Vazio — marca diretório | `admin.js:promptNewBase`, `admin.js:createUser` |
| `operacoes/<op>/logo.png` | Logo da operação (commit manual) | — |
| `assets/logo.png` | Logo da empresa (commit manual) | — |

### localStorage (chaves)

| Chave | Conteúdo | Modo |
|---|---|---|
| `cep_cache` | `{ "<cep>": { cidade, bairro } }` | sempre |
| `__data__operacoes/<op>/<base>/logs.json` | Snapshots da base (override do GitHub) | dev |
| `__data__operacoes/shopee/sla-ds-history.json` | Histórico SLA/DS (override) | dev |
| `__data__operacoes/<op>/<base>/.gitkeep` | Marcador (override) | dev |
| `__manifest__` | `{ "operacoes/<op>": [<bases>] }` | dev |

### Supabase Postgres (tabelas)

| Tabela | Linhas | Origem |
|---|---|---|
| `auth.users` (gerenciado) | 1 por login | `auth.v1.token` / `auth.v1.admin.users` |
| `profiles` | 1 por usuário | `admin.js:createUser` |
| `liberacoes` | 1 por submissão | `pages.js:submitLib` |

---

## Catálogo de endpoints externos

### Supabase

| Método | URL | Quem chama | Propósito |
|---|---|---|---|
| POST | `<SUPABASE_URL>/auth/v1/token?grant_type=password` | `auth.js:doLogin` | Login |
| POST | `<SUPABASE_URL>/auth/v1/logout` | `auth.js:doLogout` | Logout |
| POST | `<SUPABASE_URL>/auth/v1/admin/users` | `admin.js:createUser` | Cria usuário (requer key admin) |
| GET | `<SUPABASE_URL>/rest/v1/profiles?id=eq.<id>` | `auth.js:doLogin` | Carrega perfil do usuário logado |
| GET | `<SUPABASE_URL>/rest/v1/profiles?select=*&order=empresa.asc` | `admin.js:loadAdminClients` | Lista todos os usuários (tela admin) |
| POST | `<SUPABASE_URL>/rest/v1/profiles` | `admin.js:createUser` | Cria perfil |
| POST | `<SUPABASE_URL>/rest/v1/liberacoes` | `pages.js:submitLib` | Registra liberação OK/NOK |

### GitHub

| Método | URL | Quem chama | Propósito |
|---|---|---|---|
| GET | `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>?t=<ts>` | `github.js:ghGet` | Lê arquivo (sem auth, cache-buster) |
| GET | `https://api.github.com/repos/<owner>/<repo>/contents/<path>` | `github.js:ghPut` (pega SHA) e `ghListDir` | Metadata / listar dir |
| PUT | `https://api.github.com/repos/<owner>/<repo>/contents/<path>` | `github.js:ghPut` | Cria/atualiza arquivo (commit) |

### ViaCEP

| Método | URL | Quem chama | Propósito |
|---|---|---|---|
| GET | `https://viacep.com.br/ws/<cep>/json/` | `data.js:resolveAllCEPs` | Bairro/cidade do CEP |

### CDNs (estático, somente leitura)

| URL | Uso |
|---|---|
| `cdnjs.cloudflare.com/.../xlsx.full.min.js` | Parser XLSX |
| `cdnjs.cloudflare.com/.../chart.umd.js` | Gráficos |
| `fonts.googleapis.com/...` | Fonte DM Sans/Mono |

---

## Riscos e pontos cegos

| Risco | Onde | Impacto |
|---|---|---|
| `GH_TOKEN` no client | `config.js` exposto em `<script>` | Qualquer usuário logado vê o token nas DevTools. Escopo `repo` permite gravar/excluir tudo. |
| Snapshots cumulativos sem lock | `saveSnapshot`, `saveSlaDs` | Dois saves quase simultâneos podem colidir (GitHub PUT com SHA antigo retorna 409). |
| Sessão só em RAM | `currentToken` | Refresh sai. |
| `csvData` com PNR/telefone/CEP | RAM do browser | Não sai do browser; ok no nominal, mas qualquer extensão maliciosa do navegador vê. |
| Limite ViaCEP 150/import | `data.js:62` | CSVs com >150 CEPs novos: o excedente fica como "Desconhecido" até o próximo import. |
| `cep_cache` cresce indefinidamente | localStorage | Em algum momento pode estourar 5–10 MB do quota. Não há TTL. |
| Modo DEV grava SÓ em localStorage | `Storage.put` em `IS_LOCAL` | Trabalhar em dev e esquecer de commitar significa perder o trabalho ao limpar o navegador. |
| `__manifest__` derivado de `data/manifest.json` | `storage.js:listDir` | Em DEV, bases recém-criadas só aparecem após atualizar o manifest local. |
| `parseCSVRow` simplista | `data.js:50` | Não trata vírgula dentro de aspas escapadas com `""`. CSVs muito complexos podem quebrar. |
| Sem paginação no GET de `profiles` | `loadAdminClients` | A partir de centenas de usuários, performance cai. |

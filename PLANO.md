# Plano de Refatoração — Painel de Entregas
> Documento de referência e checkpoint de projeto  
> Versão: 1.0 — Mai/2026

---

## Índice
1. [Estado Atual](#1-estado-atual)
2. [Objetivo](#2-objetivo)
3. [Mapeamento Completo da Aplicação](#3-mapeamento-completo-da-aplicação)
4. [Arquitetura Alvo](#4-arquitetura-alvo)
5. [Plano de Migração por Fase](#5-plano-de-migração-por-fase)
6. [Plano de Testes](#6-plano-de-testes)
7. [Checkpoints de Projeto](#7-checkpoints-de-projeto)
8. [Referência de Arquivos](#8-referência-de-arquivos)

---

## 1. Estado Atual

### Tecnologias em uso
| Camada | Tecnologia | Versão |
|---|---|---|
| UI | HTML5 + CSS3 + Vanilla JS | — |
| Autenticação | Supabase Auth | v1 |
| Armazenamento de dados | GitHub API (arquivos JSON no repo) | v3 REST |
| Visualização | Chart.js | 4.4.1 CDN |
| Import de planilhas | XLSX.js | 0.18.5 CDN |
| CEP | ViaCEP | REST público |
| Dev server | Live Server (VS Code) | — |

### Problema central
**Todo acesso a dados passa pelo GitHub** — leitura via `raw.githubusercontent.com`, escrita via GitHub API autenticada. Isso significa:

- Qualquer mudança de dado exige commit + push
- Hot reload do Live Server não reflete dados novos
- Testar localmente é impossível sem internet e token válido
- Não há separação entre ambiente de dev e produção

---

## 2. Objetivo

Criar uma **camada de abstração de storage** que permita:

```
Modo dev   (localhost)  → lê arquivos locais em data/
                        → grava em localStorage (ou servidor local opcional)
                        → hot reload funciona sem git

Modo prod  (GitHub Pages / outro host) → comportamento atual via GitHub API
```

A mudança deve ser **não-destrutiva**: o modo produção continua funcionando exatamente como hoje.

---

## 3. Mapeamento Completo da Aplicação

### 3.1 Estrutura de arquivos atual

```
painel-entregas/
├── config.js               ← credenciais (gitignored)
├── config.example.js       ← template de credenciais
├── index.html              ← shell HTML + CSS + carregamento de scripts
├── .gitignore
├── assets/
│   └── logo.png            ← logo da empresa
├── shopee/                 ← dados da operação Shopee
│   ├── logo.png
│   ├── xpt-adr-02/logs.json
│   ├── xpt-ctn-01/logs.json
│   ├── xpt-lrs-01/logs.json
│   ├── xpt-nvc-01/logs.json
│   └── xpt-sqr-01/logs.json
└── js/
    ├── constants.js        ← constantes de domínio
    ├── state.js            ← estado global centralizado
    ├── calcs.js            ← cálculos SLA/DS
    ├── auth.js             ← autenticação Supabase
    ← data.js              ← importação CSV/XLSX + CEP
    ├── github.js           ← acesso à GitHub API (READ + WRITE)
    ├── render.js           ← atualização do DOM
    ├── ui.js               ← helpers de UI
    ├── pages.js            ← templates HTML das páginas
    ├── admin.js            ← lógica do painel admin
    └── app.js              ← navegação e roteamento
```

### 3.2 Mapa de dependências por arquivo

#### `constants.js`
- **Define:** `ALL_OPS`, `OP_LABELS`, `OP_ICONS`, `STATUS_MAP`, `DEV_SET`
- **Depende de:** nada
- **Usado por:** todos os outros arquivos

#### `state.js`
- **Define:** objeto `state` + getters/setters via `window`
- **Depende de:** `localStorage` (inicializa `cepCache`)
- **Estado exposto:** `currentUser`, `currentToken`, `isAdmin`, `userOp`, `userBase`, `currentOp`, `currentBase`, `csvData`, `xlsxData`, `logsData`, `cepCache`, `sortStates`, `libSel`

#### `calcs.js`
- **Define:** `calcSLA()`, `calcDS()`, `pctBadge()`
- **Depende de:** `csvData`, `xlsxData` (state), `STATUS_MAP`, `DEV_SET` (constants)
- **Sem efeitos colaterais** — funções puras

#### `github.js` ← **ALVO PRINCIPAL DA REFATORAÇÃO**
| Função | HTTP | URL |
|---|---|---|
| `ghGet(path)` | GET | `raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/${path}` |
| `ghGetJSON(path)` | — | via `ghGet` |
| `ghPut(path, content, msg)` | GET + PUT | `api.github.com/repos/…/contents/${path}` |
| `ghListDir(path)` | GET | `api.github.com/repos/…/contents/${path}` |
| `loadLogs(op, base)` | — | via `ghGetJSON` |
| `saveSnapshot(op, base)` | — | via `ghGetJSON` + `ghPut` |

#### `auth.js`
| Função | HTTP | URL |
|---|---|---|
| `supaReq(path)` | variável | `supabase.co/${path}` |
| `supaAuth(action, body)` | POST | `supabase.co/auth/v1/${action}` |
| `doLogin()` | POST + GET | Supabase auth + profiles |
| `doLogout()` | POST | Supabase logout |

#### `data.js`
| Função | HTTP | URL |
|---|---|---|
| `loadCSV(event)` | — | File API (local) |
| `loadXLSX(event)` | — | File API (local) |
| `resolveAllCEPs()` | GET | `viacep.com.br/ws/${cep}/json/` |

#### `admin.js`
| Função | Depende de |
|---|---|
| `loadBasesForOp(op)` | `ghListDir()` |
| `selectBase(op, base, el)` | `loadLogs()`, `basePanelHTML()`, `updateAll()` |
| `promptNewBase(op)` | `ghPut()`, `loadBasesForOp()` |
| `loadLogsForCurrentUser()` | `loadLogs()` |
| `createUser()` | `supaReq()`, `ghPut()` |
| `loadAdminClients()` | `supaReq()` |

#### `render.js`
- Funções: `set()`, `updateAll()`, `renderDSTables()`, `renderSLATable()`, `renderHistoricoFromLogs()`, `updateCharts()`
- **Depende de:** `calcSLA()`, `calcDS()`, `pctBadge()`, estado global, `Chart` (CDN)
- **Sem fetch** — apenas DOM

#### `ui.js`
- Funções: `setSaving()`, `showSnack()`, `loadCompanyLogo()`, `loadOpLogo()`, `clearOpLogo()`, `filterTbl()`, `sortTbl()`
- **Depende de:** `GH_RAW` (para logos de operação)
- `loadCompanyLogo()` usa `assets/logo.png` relativo ✓

#### `pages.js`
- Funções de template HTML (retornam strings)
- **Lê estado:** `userOp`, `userBase`, `OP_LABELS`, `ALL_OPS`
- **Sem fetch direto**
- `submitLib()` → POST `supaReq('/rest/v1/liberacoes')`

#### `app.js`
- Funções: `buildSidebar()`, `nav()`, `navigateTo()`, `pageTitle()`, `afterRender()`
- **Orquestra** chamadas para `loadBasesForOp()`, `loadLogsForCurrentUser()`, `updateAll()`, etc.

### 3.3 Estrutura de dados — logs.json

```json
[
  {
    "data": "21/05/2026",
    "hora": "14:30",
    "ts": "2026-05-21T14:30:00.000Z",
    "sla_pct": 87.5,
    "ds_pct": 92.1,
    "total": 320,
    "entregues": 280,
    "em_rota": 24,
    "ocorrencias": 8,
    "faltantes": 4,
    "devolvidos": 4,
    "motoristas": [
      { "driver": "Nome", "saiu": 40, "entregues": 37, "emRota": 2, "ocorrencias": 1 }
    ]
  }
]
```

### 3.4 Fluxo de dados atual

```
[CSV/XLSX local] → data.js → state (csvData/xlsxData)
                                  ↓
                             calcs.js → calcSLA() / calcDS()
                                  ↓
                             render.js → DOM
                                  ↓
                  github.js ← saveSnapshot() → GitHub API → logs.json
                       ↓
                  loadLogs() → state (logsData) → render.js → DOM
```

---

## 4. Arquitetura Alvo

### 4.1 Camada de abstração de storage

Criar `js/storage.js` que expõe uma interface única:

```javascript
const Storage = {
  async get(path)                     // lê arquivo como texto
  async getJSON(path)                 // lê arquivo como JSON
  async put(path, content, message)   // escreve arquivo
  async listDir(path)                 // lista subpastas
  isLocal()                           // true se localhost
}
```

**Em modo dev (localhost):**
```
Storage.get('shopee/xpt-adr-02/logs.json')
  → fetch('data/shopee/xpt-adr-02/logs.json')   ← arquivo local

Storage.put('shopee/xpt-adr-02/logs.json', content)
  → localStorage.setItem('data/shopee/xpt-adr-02/logs.json', content)

Storage.listDir('shopee')
  → fetch('data/manifest.json').then(find 'shopee' dirs)
```

**Em modo prod (GitHub Pages / outro):**
```
Storage.get(path)   → ghGet(path)     ← comportamento atual
Storage.put(...)    → ghPut(...)
Storage.listDir()   → ghListDir()
```

### 4.2 Pasta `data/` (espelho local do GitHub)

```
painel-entregas/
└── data/
    ├── manifest.json           ← índice de dirs para listDir()
    └── shopee/
        ├── xpt-adr-02/
        │   └── logs.json
        ├── xpt-ctn-01/
        │   └── logs.json
        ├── ...
```

**manifest.json:**
```json
{
  "shopee": ["xpt-adr-02", "xpt-ctn-01", "xpt-lrs-01", "xpt-nvc-01", "xpt-sqr-01"],
  "meli":   [],
  "jt":     [],
  "loggi":  [],
  "imile":  []
}
```

### 4.3 Detecção de ambiente

```javascript
// js/storage.js
const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);
```

### 4.4 Persistência de writes em dev

Em dev, `Storage.put()` grava em localStorage com chave prefixada:
```javascript
localStorage.setItem(`__data__${path}`, content)
```

E `Storage.get()` lê primeiro do localStorage (writes recentes), depois do arquivo local:
```javascript
async get(path) {
  const override = localStorage.getItem(`__data__${path}`);
  if (override) return override;
  return fetch(`data/${path}`).then(r => r.text());
}
```

Isso garante que snapshots salvos em dev aparecem imediatamente no histórico, sem precisar de servidor.

---

## 5. Plano de Migração por Fase

---

### FASE 0 — Preparação ✅ (concluída)
**Status:** Feito

- [x] Separar `index.html` monolítico em módulos JS
- [x] Centralizar estado em `state.js`
- [x] Mover credenciais para `config.js` (gitignored)
- [x] Renomear `Shopee/` → `shopee/` (slug uniforme)
- [x] Mover logo para `assets/logo.png`

---

### FASE 1 — Criação da camada de Storage
**Estimativa:** 2–3h  
**Arquivos criados/modificados:** 3

#### 1.1 Criar `data/` com espelho local

```bash
# Estrutura a criar
data/
├── manifest.json
└── shopee/
    ├── xpt-adr-02/logs.json   ← copiar de shopee/xpt-adr-02/logs.json
    ├── xpt-ctn-01/logs.json
    ├── xpt-lrs-01/logs.json
    ├── xpt-nvc-01/logs.json
    └── xpt-sqr-01/logs.json
```

#### 1.2 Criar `js/storage.js`

```javascript
const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const DATA_PREFIX = '__data__';

const Storage = {
  isLocal: () => IS_LOCAL,

  async get(path) {
    if (IS_LOCAL) {
      const override = localStorage.getItem(DATA_PREFIX + path);
      if (override) return override;
      const r = await fetch(`data/${path}`);
      return r.ok ? r.text() : null;
    }
    return ghGet(path);
  },

  async getJSON(path) {
    const txt = await Storage.get(path);
    if (!txt) return null;
    try { return JSON.parse(txt); } catch { return null; }
  },

  async put(path, content, message) {
    if (IS_LOCAL) {
      localStorage.setItem(DATA_PREFIX + path, content);
      return true;
    }
    return ghPut(path, content, message);
  },

  async listDir(path) {
    if (IS_LOCAL) {
      const manifest = await fetch('data/manifest.json').then(r => r.json()).catch(() => ({}));
      const dirs = manifest[path] || [];
      return dirs.map(name => ({ name, type: 'dir' }));
    }
    return ghListDir(path);
  },
};
```

#### 1.3 Modificar `js/github.js`

Substituir chamadas diretas de `ghGetJSON`, `ghPut`, `ghListDir` por `Storage.*` nas funções:
- `loadLogs()` → `Storage.getJSON()`
- `saveSnapshot()` → `Storage.getJSON()` + `Storage.put()`

#### 1.4 Modificar `js/admin.js`

- `loadBasesForOp()` → `Storage.listDir()`
- `promptNewBase()` → `Storage.put()`

#### Checkpoint Fase 1
- [ ] `data/manifest.json` criado com todas as operações
- [ ] `data/shopee/*/logs.json` existem localmente
- [ ] `Storage.get()` retorna dados locais em localhost
- [ ] `Storage.put()` salva em localStorage em localhost
- [ ] `Storage.listDir('shopee')` retorna as bases corretas
- [ ] Painel carrega sem internet em localhost
- [ ] Snapshots salvos aparecem no histórico sem git

---

### FASE 2 — Remoção das dependências de GH_RAW em UI
**Estimativa:** 1h  
**Arquivos modificados:** `js/ui.js`, `js/pages.js`

Atualmente `loadOpLogo()` constrói URL a partir de `GH_RAW`. Em dev, deve usar caminho relativo.

#### 2.1 Modificar `loadOpLogo()` em `ui.js`

```javascript
async function loadOpLogo(op) {
  const url = Storage.isLocal()
    ? `data/${op}/logo.png`
    : `${GH_RAW}/${op}/logo.png?t=${Date.now()}`;
  const img = document.getElementById('topbar-op-logo');
  if (img) { img.src = url; img.style.display = ''; img.onerror = () => img.style.display = 'none'; }
}
```

#### 2.2 Copiar logos de operação para `data/`

```
data/
└── shopee/
    └── logo.png   ← copiar de shopee/logo.png
```

#### Checkpoint Fase 2
- [ ] Logo da empresa aparece em localhost sem internet
- [ ] Logo da operação Shopee aparece em localhost sem internet
- [ ] Em produção (GitHub Pages), logos ainda carregam do GH_RAW

---

### FASE 3 — Testes Unitários
**Estimativa:** 3–4h  
**Framework:** Nativo (sem dependência externa) ou Vitest/Jest

#### 3.1 Estrutura de testes

```
tests/
├── unit/
│   ├── calcs.test.js       ← calcSLA, calcDS, pctBadge
│   ├── storage.test.js     ← Storage.get, put, listDir, isLocal
│   ├── state.test.js       ← getters/setters do estado
│   └── utils.test.js       ← parseCSVRow, logPath
└── functional/
    ├── login.test.js       ← fluxo de login/logout
    ├── import.test.js      ← loadCSV, loadXLSX
    ├── snapshot.test.js    ← saveSnapshot, loadLogs
    └── navigation.test.js  ← nav, renderPage, afterRender
```

#### 3.2 Testes unitários — calcs.js

```javascript
// tests/unit/calcs.test.js
describe('calcSLA', () => {
  test('retorna 0% com csvData vazio', () => {
    csvData = [];
    const r = calcSLA();
    assert(r.total === 0);
    assert(r.pct === 0);
  });

  test('conta entregues corretamente', () => {
    csvData = [
      { status: 'Delivered' },
      { status: 'Delivered' },
      { status: 'OnHold' },
    ];
    const r = calcSLA();
    assert(r.total === 3);
    assert(r.entregues === 2);
    assert(r.pct === (2/3*100));
  });

  test('classifica devoluções corretamente', () => {
    csvData = [{ status: 'Return_LMHub_LHTransporting' }];
    const r = calcSLA();
    assert(r.dev === 1);
  });
});

describe('calcDS', () => {
  test('retorna 0% com xlsxData vazio', () => {
    xlsxData = [];
    const r = calcDS();
    assert(r.motoristas === 0);
    assert(r.pct === 0);
  });

  test('calcula percentual corretamente', () => {
    xlsxData = [{ driver: 'A', saiu: 10, entregues: 9, emRota: 1, ocorrencias: 0 }];
    const r = calcDS();
    assert(r.pct === 90);
  });
});

describe('pctBadge', () => {
  test('verde para >= 85%', () => assert(pctBadge(85).includes('bg')));
  test('azul para 70-84%', () => assert(pctBadge(75).includes('bb')));
  test('vermelho para < 70%', () => assert(pctBadge(65).includes('br')));
});
```

#### 3.3 Testes unitários — storage.js

```javascript
// tests/unit/storage.test.js
describe('Storage em modo local', () => {
  beforeEach(() => localStorage.clear());

  test('get retorna override do localStorage antes do arquivo', async () => {
    localStorage.setItem('__data__shopee/xpt-adr-02/logs.json', '[{"ts":"2026"}]');
    const result = await Storage.getJSON('shopee/xpt-adr-02/logs.json');
    assert(result[0].ts === '2026');
  });

  test('put salva no localStorage', async () => {
    await Storage.put('shopee/xpt-adr-02/logs.json', '[]', 'test');
    assert(localStorage.getItem('__data__shopee/xpt-adr-02/logs.json') === '[]');
  });

  test('listDir retorna bases do manifest', async () => {
    const dirs = await Storage.listDir('shopee');
    assert(dirs.length > 0);
    assert(dirs.every(d => d.type === 'dir'));
  });
});
```

#### 3.4 Testes unitários — parseCSVRow

```javascript
// tests/unit/utils.test.js
describe('parseCSVRow', () => {
  test('separa campos simples', () => {
    assert.deepEqual(parseCSVRow('a,b,c'), ['a', 'b', 'c']);
  });

  test('respeita aspas com vírgulas dentro', () => {
    assert.deepEqual(parseCSVRow('"a,b",c'), ['a,b', 'c']);
  });

  test('campo vazio', () => {
    assert.deepEqual(parseCSVRow('a,,c'), ['a', '', 'c']);
  });
});
```

---

### FASE 4 — Testes Funcionais
**Estimativa:** 4–6h  
**Ferramentas sugeridas:** Playwright (browser automation) ou testes manuais guiados

#### 4.1 Checklist de testes funcionais por fluxo

**Fluxo: Login**
```
[ ] Login com credenciais válidas → entra no app
[ ] Login com credenciais inválidas → exibe mensagem de erro
[ ] Admin vê sidebar admin
[ ] Supervisor vê sidebar supervisor com sua operação
[ ] Logout → volta para tela de login com campos limpos
```

**Fluxo: Importação de dados (Supervisor/Admin)**
```
[ ] Upload de CSV válido → exibe "X pacotes"
[ ] Upload de XLSX válido → exibe "X motoristas"
[ ] Blocos SLA e DS atualizam após import
[ ] Tabela de motoristas preenche após import
[ ] CSV com menos de 23 colunas é ignorado sem erro
[ ] Upload de arquivo inválido (ex: PDF) → sem crash
```

**Fluxo: Snapshot (modo local)**
```
[ ] Clicar "Registrar Snapshot" salva no localStorage
[ ] Recarregar página → snapshot aparece no histórico
[ ] Histórico exibe delta (▲/▼) corretamente entre snapshots
[ ] Gráfico atualiza após snapshot
[ ] Mensagem de sucesso exibe SLA% e DS% corretos
```

**Fluxo: Navegação Admin**
```
[ ] Dashboard mostra cards de todas as operações
[ ] Clicar operação → lista de bases carrega
[ ] Clicar base → painel de importação + histórico aparecem
[ ] Botão "+ Nova base" cria entrada no manifest (modo local)
```

**Fluxo: Navegação Supervisor**
```
[ ] Dashboard mostra cards de acesso rápido
[ ] "SLA & DS Hoje" abre com áreas de import
[ ] "Histórico" carrega timeline do localStorage
[ ] "Motoristas" reflete os dados importados em Hoje
[ ] "Liberação Pagamento" permite enviar OK/NOK
```

**Fluxo: UI**
```
[ ] Busca em tabela filtra por motorista
[ ] Clique em cabeçalho ordena tabela (asc/desc)
[ ] Snackbar aparece e desaparece após 4s
[ ] Logo carrega de assets/logo.png
[ ] Indicador GitHub/Saving atualiza durante operações
```

---

### FASE 5 — Servidor de desenvolvimento local (opcional)
**Estimativa:** 2h  
**Permite:** writes em dev persistam em arquivos reais (sem localStorage)

#### 5.1 Criar `dev-server.js`

```javascript
// dev-server.js  (Node.js, sem framework)
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT    = 5501;
const DATA_DIR = path.join(__dirname, 'data');

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const filePath = path.join(DATA_DIR, req.url);

  if (req.method === 'GET') {
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(fs.readFileSync(filePath, 'utf8'));

  } else if (req.method === 'PUT') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, body, 'utf8');
      res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    });
  }
}).listen(PORT, () => console.log(`Dev server: http://localhost:${PORT}`));
```

#### 5.2 Modificar `Storage.put()` para usar o dev server

```javascript
async put(path, content, message) {
  if (IS_LOCAL) {
    try {
      await fetch(`http://localhost:5501/${path}`, {
        method: 'PUT', body: content,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // fallback para localStorage se servidor não estiver rodando
      localStorage.setItem(DATA_PREFIX + path, content);
    }
    return true;
  }
  return ghPut(path, content, message);
}
```

#### Checkpoint Fase 5
- [ ] `node dev-server.js` sobe na porta 5501
- [ ] Snapshot salvo grava em `data/shopee/xpt-adr-02/logs.json` no disco
- [ ] Live Server recarrega automaticamente após escrita
- [ ] Sem servidor → cai para localStorage (graceful degradation)

---

## 6. Plano de Testes

### 6.1 Matriz de cobertura

| Módulo | Unitário | Funcional | Prioridade |
|---|---|---|---|
| `calcs.js` | ✓ Planejado | — | Alta |
| `storage.js` | ✓ Planejado | ✓ Planejado | Alta |
| `data.js` — parseCSVRow | ✓ Planejado | — | Alta |
| `data.js` — loadCSV/XLSX | — | ✓ Planejado | Média |
| `auth.js` — doLogin | — | ✓ Planejado | Alta |
| `render.js` — updateAll | — | ✓ Planejado | Média |
| `admin.js` — createUser | — | ✓ Planejado | Baixa |
| `pages.js` — renderPage | ✓ Planejado | — | Baixa |
| `app.js` — nav | — | ✓ Planejado | Média |

### 6.2 Setup de testes sem build tool

Criar `tests/runner.html` que carrega os módulos e executa asserções:

```html
<!DOCTYPE html>
<html>
<body>
<pre id="output"></pre>
<script src="../config.js"></script>
<script src="../js/constants.js"></script>
<script src="../js/state.js"></script>
<script src="../js/calcs.js"></script>
<script src="../js/storage.js"></script>
<script>
// Mini framework de teste
let passed = 0, failed = 0;
function describe(name, fn) { console.group(name); fn(); console.groupEnd(); }
function test(name, fn) {
  try { fn(); log('✓ ' + name); passed++; }
  catch(e) { log('✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function log(msg) { document.getElementById('output').textContent += msg + '\n'; }
</script>
<script src="unit/calcs.test.js"></script>
<script src="unit/storage.test.js"></script>
<script src="unit/utils.test.js"></script>
<script>
log(`\nResultado: ${passed} passou, ${failed} falhou`);
</script>
</body>
</html>
```

---

## 7. Checkpoints de Projeto

### Checkpoint 0 — Baseline ✅
- [x] Módulos JS separados (`js/`)
- [x] Estado centralizado (`state.js`)
- [x] Credenciais em `config.js` (gitignored)
- [x] Pasta `shopee/` em lowercase
- [x] Logo em `assets/logo.png`
- [x] Commit + push no GitHub

### Checkpoint 1 — Storage Abstraction
- [ ] `js/storage.js` criado com detecção de ambiente
- [ ] `data/manifest.json` criado
- [ ] `data/shopee/*/logs.json` existem localmente
- [ ] `github.js` usa `Storage.*` internamente
- [ ] `admin.js` usa `Storage.*` internamente
- [ ] App funciona **sem internet** em localhost
- [ ] Snapshot salvo aparece no histórico sem git

### Checkpoint 2 — UI Local
- [ ] `loadOpLogo()` usa caminho relativo em localhost
- [ ] `data/shopee/logo.png` existe
- [ ] Sem chamadas a `GH_RAW` em modo local

### Checkpoint 3 — Testes Unitários
- [ ] `tests/runner.html` executa sem erros
- [ ] `calcs.test.js` — 100% passando
- [ ] `storage.test.js` — 100% passando
- [ ] `utils.test.js` — 100% passando

### Checkpoint 4 — Testes Funcionais
- [ ] Todos os fluxos da seção 4.1 verificados manualmente
- [ ] Sem regressões em produção (GitHub Pages)

### Checkpoint 5 — Dev Server (opcional)
- [ ] `dev-server.js` funciona com `node dev-server.js`
- [ ] Writes persistem em disco em modo dev
- [ ] Fallback para localStorage se servidor offline

---

## 8. Referência de Arquivos

### Arquivos a criar

| Arquivo | Fase | Propósito |
|---|---|---|
| `js/storage.js` | 1 | Abstração de storage local/GitHub |
| `data/manifest.json` | 1 | Índice de diretórios para modo local |
| `data/shopee/*/logs.json` | 1 | Espelho local dos dados do GitHub |
| `data/shopee/logo.png` | 2 | Logo local da operação |
| `tests/runner.html` | 3 | Runner de testes no browser |
| `tests/unit/calcs.test.js` | 3 | Testes de cálculo |
| `tests/unit/storage.test.js` | 3 | Testes do storage |
| `tests/unit/utils.test.js` | 3 | Testes de utilitários |
| `tests/functional/` | 4 | Checklists de testes funcionais |
| `dev-server.js` | 5 | Servidor local de escrita em arquivos |

### Arquivos a modificar

| Arquivo | Fase | O que muda |
|---|---|---|
| `js/github.js` | 1 | `loadLogs`, `saveSnapshot` → `Storage.*` |
| `js/admin.js` | 1 | `loadBasesForOp`, `promptNewBase` → `Storage.*` |
| `js/ui.js` | 2 | `loadOpLogo` → caminho relativo em dev |
| `index.html` | 1 | Adicionar `<script src="js/storage.js">` |

### Arquivos que não mudam

| Arquivo | Motivo |
|---|---|
| `js/constants.js` | Sem dependências externas |
| `js/state.js` | Apenas localStorage, já local |
| `js/calcs.js` | Funções puras, sem efeitos colaterais |
| `js/render.js` | Apenas DOM, sem fetch |
| `js/pages.js` | Templates HTML, sem fetch direto |
| `js/auth.js` | Supabase continua em ambos os ambientes |

---

*Documento gerado em 21/05/2026 — revisar ao iniciar cada fase.*

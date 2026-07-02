# Documentação de Arquitetura e Plano de Desenvolvimento
## Dashboards de Monitoramento e Financeiro — Sistema Interno de Logística

**Versão 2.0 — Julho de 2026 — Documento para handoff de desenvolvimento**

---

## Sumário

1. Resumo executivo e veredito
2. Contexto, escopo e premissas
3. Decisões arquiteturais consolidadas (ADRs)
4. Requisitos funcionais
5. Requisitos não funcionais
6. Arquitetura proposta (Fase 1)
7. Fluxos principais
8. Modelo de dados e banco
9. Segurança e controle de acesso
10. Configuração de infraestrutura (concreto para dev)
11. Deploy, operação e observabilidade
12. Estimativa de custo
13. Riscos, mitigação e evolução
14. Checklist de handoff (Fase 1)
15. Referências

---

## 1. Resumo executivo e veredito

Sistema **interno** para uma empresa de **logística**, cujo objetivo é substituir e organizar processos que hoje dependem de múltiplas planilhas. São dois dashboards em **Next.js** (TypeScript) que compartilham base de usuários e um banco **PostgreSQL**:

- **Monitoramento** — envio de planilhas por usuários autorizados, processamento (operações tipo PROCV/PROCX) e consulta dos dados por gestores.
- **Financeiro** — cadastro/consulta de dados financeiros e cálculo de salário de motorista, lidando com **CPF/CNPJ, nome de motorista e valores salariais**.

**Veredito:** a arquitetura proposta é **adequada e não está superdimensionada** para o caso real. Para o volume atual (uso interno, ~12 planilhas/dia, 1,5 MB em média e 10 MB no pico, processamento leve, downtime tolerável), **não** se justifica ALB, ECS, blue-green nem SQS na primeira versão. A Fase 1 é: **EC2 única com Docker Compose rodando os apps Next.js como processos Node, RDS PostgreSQL privado, S3 privado e Cognito.**

O risco imediato deste projeto **não é tráfego nem alta disponibilidade**. É **proteção de dados, backup, pooling de conexões e controle do processamento de planilhas**. Por isso, alguns itens que muitas vezes ficam "para depois" entram como **obrigatórios de Fase 1** (ver seção 14).

> **Ponto de atenção que muda decisão de infraestrutura:** os apps Next.js **precisam** rodar como processo Node (`next start`). Um build estático (`output: 'export'`) **quebraria Server Actions e middleware**, que exigem o runtime do servidor ativo a cada request. Isso remove de vez a opção "frontend estático no S3" e redefine os papéis de CloudFront e S3 (ver ADR-01/02/03).

---

## 2. Contexto, escopo e premissas

### 2.1 Contexto do produto

| Item | Descrição |
|---|---|
| Natureza | Sistema **interno** de uma empresa de logística. |
| Objetivo | Substituir/facilitar processos hoje baseados em planilhas. |
| Volume de usuários | Baixo; referência de ~500 acessos/dia, sem simultaneidade relevante. |
| Volume de arquivos | ~12 planilhas/dia; média 1,5 MB; máximo estimado 10 MB. |
| Processamento | Leve, equivalente a PROCV/PROCX; sem cálculo pesado ou grande volume. |
| Frontends/Backends | Dois apps **Next.js full-stack** (UI + Server Actions/Route Handlers). |
| Banco | Amazon RDS for PostgreSQL, privado, central. |
| Arquivos | Bucket S3 privado (planilhas, exports, relatórios, comprovantes). |
| Autenticação | Amazon Cognito User Pool, JWT e grupos/perfis. |
| Escala inicial | Uma EC2 com Docker Compose e reverse proxy. |
| Downtime | Tolerável no momento (não há SLA rígido). |
| Residência de dados | Sem exigência inicial de dados no Brasil; segurança e backup mínimos adequados são requisito. |

### 2.2 Premissas de arquitetura

- A EC2 é a única "VPS" da arquitetura. RDS e S3 são serviços gerenciados **separados**, não instalados dentro da EC2.
- O S3 **não** é banco de dados nem cache principal; armazena objetos/arquivos.
- O RDS PostgreSQL fica em **subnet privada** e não é exposto publicamente.
- A autenticação é centralizada no Cognito; permissões de negócio podem ser refinadas no PostgreSQL.
- Os dois módulos podem **compartilhar infraestrutura**, mas não devem **compartilhar código de forma acoplada**.
- Dados de folha/financeiro exigem **auditoria, controle de acesso e criptografia em trânsito e em repouso** — desde a Fase 1.

### 2.3 Fora de escopo nesta versão

- Alta disponibilidade com múltiplas instâncias EC2 em múltiplas zonas.
- Auto Scaling horizontal, data lake, BI avançado, replicação analítica.
- Processamento massivo de arquivos em paralelo.
- **Auditoria/parecer jurídico formal de LGPD** (as práticas técnicas mínimas de proteção **não** estão fora de escopo — ver ADR-10 e seção 9).

---

## 3. Decisões arquiteturais consolidadas (ADRs)

Registro enxuto das decisões e do **porquê**, para o time entender o racional e não reintroduzir opções já descartadas.

| # | Decisão | Racional |
|---|---|---|
| **AD-01** | Next.js roda como **processo Node** (`next start`), não estático. | Server Actions e middleware exigem o servidor Next ativo a cada request. `output: 'export'` quebraria ambos. |
| **AD-02** | CloudFront é **cache/TLS na frente da EC2**, não serve o frontend a partir do S3. | Como o app é dinâmico, o HTML, as Server Actions e o middleware vão à origem. CloudFront cacheia só assets estáticos e termina TLS. **Risco:** cachear conteúdo dinâmico vaza dado de um usuário para outro. |
| **AD-03** | S3 guarda **apenas arquivos** (planilhas/exports/relatórios). Não há "bucket de frontend". | O frontend saiu do S3 ao virar Next em Node. Um bucket privado, só para arquivos. |
| **AD-04** | **EC2 única + Docker Compose** na Fase 1; sem ALB/ECS. | Uso interno, baixo volume, downtime tolerável. ALB/ECS seria complexidade sem retorno agora. |
| **AD-05** | RDS **privado** com **criptografia em repouso ligada na criação** (KMS). | Criptografia não pode ser ativada em banco já existente sem migração (snapshot → cópia criptografada → restore). Na criação é um clique. |
| **AD-06** | Worker de planilhas no **mesmo host** (container próprio), sem SQS na Fase 1. | 12 arquivos/dia de ≤10 MB com parse leve: um arquivo infla ~100–200 MB em memória, irrelevante numa instância de 2–4 GB. |
| **AD-07** | **Pool de conexões consciente e singleton** já na Fase 1. | Com SSR, cada render pode tocar o banco. Pool mal configurado esgota conexões antes de qualquer outro recurso. |
| **AD-08** | **EC2 stateless**: todo estado em RDS, S3 e CloudWatch. | Torna a recuperação "sobe instância nova + `docker compose up`". Nada importante mora no disco local. |
| **AD-09** | Segredos no **SSM Parameter Store (SecureString)**. | Gratuito no volume do projeto; Secrets Manager cobraria ~US$ 0,40/segredo/mês. Não commitar `.env`. |
| **AD-10** | Financeiro com **régua de segurança maior**: audit log **e** versionamento de cálculo. | Auditoria responde "quem fez o quê"; versionamento responde "quais eram os números no fechamento". Folha precisa dos dois; nunca `UPDATE` destrutivo de cálculo. |

---

## 4. Requisitos funcionais

| ID | Requisito | Atendido por |
|---|---|---|
| RF-01 | Autenticar antes de acessar qualquer dashboard. | Cognito User Pool + validação de JWT no servidor. |
| RF-02 | Base de usuários unificada entre os dois dashboards. | Cognito + tabela interna de perfis/permissões no PostgreSQL. |
| RF-03 | Usuários autorizados enviam planilhas no Monitoramento. | Server Action pede presigned URL; upload direto ao S3 privado. |
| RF-04 | Planilhas convertidas em dados persistidos. | Worker processa o arquivo e grava no RDS. |
| RF-05 | Gestores visualizam dados sem necessariamente enviar. | Controle por grupos/permissões; leitura separada da escrita. |
| RF-06 | Financeiro guarda dados financeiros e de motorista. | App Financeiro + schema/tabelas financeiras no PostgreSQL. |
| RF-07 | Calcular salário de motorista. | Rotinas de cálculo com auditoria e **versionamento** do resultado. |
| RF-08 | Diferenciar perfis de acesso. | Grupos do Cognito + RBAC interno no PostgreSQL. |
| RF-09 | Preservar arquivos enviados para auditoria/reprocessamento. | S3 versionado/privado, com metadados no banco. |
| RF-10 | Serviços evoluem separadamente. | Containers e pipelines de deploy independentes. |

---

## 5. Requisitos não funcionais

| Categoria | Requisito | Diretriz |
|---|---|---|
| Segurança | Tráfego externo via HTTPS. | ACM no CloudFront (viewer); Caddy/Let's Encrypt no origin (EC2). |
| Segurança | Banco não pode ser público. | RDS em subnet privada; Security Group aceitando apenas a EC2. |
| Segurança | Bucket não pode ser público. | S3 Block Public Access, presigned URLs, IAM Role na EC2. |
| Segurança | Criptografia em repouso. | RDS com KMS (ligado na criação); S3 SSE-KMS no bucket sensível. |
| Segurança | Separação de permissões entre módulos. | RBAC por grupos + validação **no servidor**, nunca só no frontend. |
| Privacidade | Rastreabilidade de dados financeiros/folha. | Audit logs de leitura/escrita sensíveis. |
| Privacidade | Não expor CPF/salário em logs. | Mascaramento e política de logging (ver 9.4). |
| Disponibilidade | Aceitar simplicidade inicial. | Sem ALB no MVP; downtime em deploy tolerável. |
| Performance | Uploads não sobrecarregam a EC2. | Upload direto ao S3 via presigned URL. |
| Performance | SSR não esgota conexões do banco. | Pool singleton e dimensionado (ver 10.4). |
| Manutenibilidade | Serviços separados. | Docker Compose com containers e logs independentes. |
| Backup | Recuperação de dados. | Backup automático do RDS + snapshot manual mensal; versionamento no S3. |
| Observabilidade | Diagnóstico de falhas. | Logs por container no CloudWatch; métricas de EC2/RDS; alarmes básicos. |

---

## 6. Arquitetura proposta (Fase 1)

### 6.1 Visão geral

O usuário acessa via CloudFront, que **termina o TLS** e cacheia apenas assets estáticos; todo o restante (HTML dinâmico, Server Actions, middleware, chamadas) vai à **origem na EC2**, onde um reverse proxy roteia para os apps Next.js. O banco é um RDS PostgreSQL privado; os arquivos ficam em um S3 privado.

```
                         Usuários internos (~500/dia)
                                     |
                                 Route 53 (DNS)
                                     |
                         CloudFront (TLS + cache estático)
                          |  cacheia /_next/static/*  |
                          |  repassa cookies/Authorization
                                     |
                          EC2 pública (80/443)  ── VPC / Security Groups
                                     |
                        Reverse proxy (Caddy / Nginx / Traefik)
                        /                                   \
             monitoramento-web (Next/Node:3000)     financeiro-web (Next/Node:3000)
                        \                                   /
                         monitoramento-worker (Node, processa planilhas)
                                     |
                 ┌───────────────────┴───────────────────┐
                 |                                        |
        RDS PostgreSQL (privado)               S3 privado (arquivos)
        subnet privada, KMS, backup            planilhas / exports / relatórios
                 ▲                                        ▲
                 └──── acesso só da EC2 (SG:5432)         └──── IAM Role + presigned URL

           Cognito User Pool  ── login, MFA opcional, grupos (admin/gestor/operador/financeiro)
           SSM Parameter Store ── segredos (SecureString)
           CloudWatch ── logs e métricas
```

> **Nota (alternativa válida):** para um app puramente interno, `Route 53 → Caddy (TLS direto na EC2)` sem CloudFront também é aceitável e elimina o footgun de cache dinâmico. Mantemos CloudFront como caminho documentado (TLS na borda, cache de estáticos, ponto de entrada estável), **desde que** a disciplina de cache da seção 10.3 seja seguida.

### 6.2 Componentes

| Componente | Papel | Observações |
|---|---|---|
| Route 53 | DNS do domínio/subdomínios. | Aponta para o CloudFront (e um host de origem para a EC2). |
| CloudFront | TLS na borda + cache de estáticos. | **Não** serve frontend de S3; repassa dinâmico à EC2. |
| S3 (arquivos) | Planilhas, exports, relatórios, comprovantes. | Privado, Block Public Access, presigned URLs, versionado. |
| Cognito User Pool | Login, recuperação de senha, MFA opcional, JWT. | Grupos = perfis (admin, gestor, operador, financeiro). |
| EC2 | Executa os apps Next e o worker em Docker. | Uma `t3/t4g.small` inicia com folga neste volume. |
| Reverse proxy | Roteia subdomínios para os containers. | Caddy (auto-HTTPS), Nginx ou Traefik. |
| monitoramento-web | Next full-stack (UI + Server Actions/Route Handlers). | Dispara o worker após upload. |
| financeiro-web | Next full-stack (UI + lógica financeira). | Régua de segurança maior (auditoria/versionamento). |
| monitoramento-worker | Processa planilhas fora do request. | Container próprio; sem SQS na Fase 1. |
| RDS PostgreSQL | Banco relacional central. | Privado, KMS, backup automático. |
| SSM Parameter Store | Segredos e variáveis sensíveis. | SecureString; injetados no deploy. |
| CloudWatch | Logs e métricas. | Um log stream por container. |

---

## 7. Fluxos principais

### 7.1 Login e autorização

1. Usuário acessa o dashboard via CloudFront → EC2 (Next).
2. Frontend redireciona ao Cognito (Hosted UI/SDK) para login.
3. Cognito autentica e retorna tokens JWT.
4. A sessão é mantida em **cookie/JWT** (não em memória do processo Node).
5. O servidor (middleware/Server Action/Route Handler) **valida** assinatura, issuer, audience/client_id, expiração e grupos.
6. Consulta permissões adicionais no PostgreSQL, quando necessário.
7. Retorna **apenas** dados permitidos ao perfil.

> **Regra de ouro:** não confie no frontend para controle de acesso. O servidor valida JWT e permissões em **todos** os endpoints/ações sensíveis.

### 7.2 Upload e processamento de planilhas

```
Usuário logado → app pede presigned URL → servidor valida permissão e cria registro
   → upload direto ao S3 → servidor dispara processamento → worker baixa/valida/normaliza
   → grava no PostgreSQL (status: pending → processing → done|failed) → gestor consulta
```

1. Usuário autenticado escolhe a planilha no Monitoramento.
2. Server Action solicita **presigned URL** de upload.
3. Servidor valida permissão, cria registro inicial (`status = pending`) e retorna a URL temporária.
4. Frontend envia o arquivo **direto** ao S3 privado (não passa pela EC2).
5. Servidor agenda/dispara o processamento (chamada ao worker).
6. Worker baixa o arquivo, valida formato, aplica limites/timeout, normaliza e grava os registros. Atualiza `status`.
7. Gestores visualizam os dados processados.

**Controles obrigatórios (Fase 1):** limite de tamanho (ex.: rejeitar > 10 MB), timeout de processamento, `status` persistido, tratamento de falha com mensagem/registro de erro, e o processamento **fora** do processo web.

### 7.3 Rotina financeira e cálculo de salário

- Usuário financeiro acessa o dashboard com permissão específica; o servidor valida JWT e perfil antes de qualquer consulta/alteração.
- Toda operação de folha registra **autor, data/hora, origem e versão do cálculo**.
- Operações críticas (criação, alteração, fechamento, exportação, exclusão lógica) geram **audit log**.
- O **resultado do cálculo é versionado** (novo registro por execução; nunca sobrescrever). Ver 8.3.
- Exports/comprovantes vão ao S3 com metadados e **hash** no banco.

---

## 8. Modelo de dados e banco

### 8.1 Estratégia de banco compartilhado

Um único RDS PostgreSQL atende o cenário. Recomenda-se **schemas separados** no mesmo database para isolamento lógico sem múltiplas instâncias.

| Opção | Descrição | Quando usar |
|---|---|---|
| **Schemas separados** (recomendado) | `auth`, `monitoramento`, `financeiro` no mesmo database. | Bom isolamento lógico e organização, custo único. |
| Database único, tabelas nomeadas | Tudo em `public` com nomes claros. | Mais simples, porém tende a bagunçar. |
| Bancos separados | Databases distintos por módulo. | Só com exigência forte de isolamento/escala independente. |

### 8.2 Tabelas sugeridas

| Domínio | Tabelas | Observação |
|---|---|---|
| Auth/Autorização | `users`, `roles`, `permissions`, `user_roles`, `audit_logs` | `users.cognito_sub` guarda o ID único do Cognito. |
| Monitoramento | `monitoring_uploads`, `monitoring_files`, `monitoring_records`, `processing_jobs`, `processing_errors` | Separar arquivo bruto, status do job e dados processados. |
| Financeiro | `financial_records`, `payroll_batches`, `payroll_items`, `payroll_calculations`, `payment_exports` | Preferir versionamento/auditoria a alteração destrutiva. |
| Arquivos | `file_objects`, `file_access_logs` | Guardar `s3_bucket`, `s3_key`, `hash`, tamanho e MIME. |

### 8.3 Esboços de DDL (referência)

```sql
-- auth.users
id           UUID PRIMARY KEY,
cognito_sub  TEXT UNIQUE NOT NULL,
email        TEXT UNIQUE NOT NULL,
name         TEXT,
status       TEXT,
created_at   TIMESTAMPTZ DEFAULT now()

-- monitoramento.monitoring_uploads
id                 UUID PRIMARY KEY,
uploaded_by        UUID REFERENCES auth.users(id),
s3_key             TEXT NOT NULL,
original_filename  TEXT,
size_bytes         BIGINT,
status             TEXT,        -- pending | processing | done | failed
error_message      TEXT,
created_at         TIMESTAMPTZ DEFAULT now()

-- financeiro.payroll_batches
id            UUID PRIMARY KEY,
created_by    UUID REFERENCES auth.users(id),
period_month  INT,
period_year   INT,
status        TEXT,             -- draft | calculated | approved | closed
created_at    TIMESTAMPTZ DEFAULT now()

-- financeiro.payroll_calculations  (VERSIONAMENTO: nunca UPDATE destrutivo)
id             UUID PRIMARY KEY,
batch_id       UUID REFERENCES financeiro.payroll_batches(id),
driver_id      UUID,             -- referência ao motorista
calc_version   INT NOT NULL,     -- incrementa a cada recálculo
inputs_hash    TEXT,             -- hash das entradas do cálculo
gross_amount   NUMERIC(12,2),
deductions     NUMERIC(12,2),
net_amount     NUMERIC(12,2),
is_current     BOOLEAN DEFAULT true,
created_by     UUID REFERENCES auth.users(id),
created_at     TIMESTAMPTZ DEFAULT now()
-- ao recalcular: marca versões anteriores is_current=false e INSERE nova (em transação)

-- auth.audit_logs  (quem/o quê/quando)
id           UUID PRIMARY KEY,
actor_id     UUID REFERENCES auth.users(id),
action       TEXT,               -- create | update | close | export | delete
entity       TEXT,               -- ex.: payroll_batch
entity_id    UUID,
ip           INET,
before       JSONB,              -- estado anterior (quando aplicável)
after        JSONB,              -- estado posterior
created_at   TIMESTAMPTZ DEFAULT now()
```

> **Distinção que importa para folha:** `audit_logs` responde *quem mexeu*; `payroll_calculations` (versionado) responde *quais eram os números naquele fechamento*. São coisas diferentes e ambas são obrigatórias no financeiro.

---

## 9. Segurança e controle de acesso

### 9.1 Perfis sugeridos (grupos do Cognito)

| Perfil | Monitoramento | Financeiro | Administração |
|---|---|---|---|
| `admin` | Total | Total | Gerencia usuários, grupos e configurações. |
| `gestor_monitoramento` | Visualiza dados/relatórios | Sem acesso | Sem gestão global. |
| `operador_monitoramento` | Envia planilhas e acompanha | Sem acesso | Sem gestão global. |
| `financeiro` | Sem acesso por padrão | Cadastro, consulta, cálculo | Sem gestão global. |
| `leitura_auditoria` | Consulta logs autorizados | Consulta logs autorizados | Somente leitura. |

### 9.2 Camadas de segurança

| Camada | Controle |
|---|---|
| Identidade | Cognito User Pool, senha forte, MFA opcional para perfis críticos. |
| Autorização | Grupos do Cognito + tabela interna de permissões no PostgreSQL, validada no servidor. |
| Rede | RDS privado; EC2 acessível só em 80/443; SSH restrito ou apenas via SSM. |
| Banco | Security Group do RDS aceitando conexão apenas da EC2 (5432). |
| S3 | Bucket privado, Block Public Access, presigned URLs, IAM Role de menor privilégio. |
| Criptografia | RDS com KMS (na criação); S3 SSE-KMS no bucket sensível; TLS em trânsito. |
| Segredos | SSM Parameter Store (SecureString); nunca `.env` no Git. |
| Auditoria | Operações críticas com usuário, IP, timestamp, ação e antes/depois. |

### 9.3 Security Groups sugeridos

| Recurso | Entrada permitida | Saída permitida |
|---|---|---|
| EC2 | 80/443 da internet; SSH só de IP confiável ou nenhum (usar SSM). | RDS:5432; S3 (via internet/VPC endpoint); APIs necessárias. |
| RDS PostgreSQL | 5432 **apenas** do SG da EC2. | Padrão gerenciado. |
| S3 | Acesso via IAM (não por SG). | Bucket policy se necessário. |

### 9.4 Criptografia e política de logs (obrigatório na Fase 1)

- **RDS:** habilitar criptografia (KMS) **na criação**. Ativar depois exige snapshot → cópia criptografada → restore em novo banco (janela de migração). Não deixe para depois.
- **S3:** objetos já são criptografados por padrão (SSE-S3). No bucket com dados sensíveis, usar **SSE-KMS** para ter auditoria de uso da chave via CloudTrail.
- **Logs:** **nunca** registrar CPF/CNPJ, salário, tokens ou senhas em texto puro. Mascarar campos sensíveis, e revisar mensagens de erro/stack traces que possam vazar dado. Definir retenção no CloudWatch.

---

## 10. Configuração de infraestrutura (concreto para dev)

### 10.1 Organização na EC2

```
EC2
├── reverse-proxy (Caddy)
│   ├── app-monitoramento.seudominio.com  -> monitoramento-web:3000
│   └── app-financeiro.seudominio.com     -> financeiro-web:3000
├── monitoramento-web   (Next full-stack, Node)
├── financeiro-web      (Next full-stack, Node)
└── monitoramento-worker (Node, processamento de planilhas)
```

### 10.2 Docker Compose (exemplo conceitual)

```yaml
services:
  reverse-proxy:
    image: caddy:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data          # persiste certificados (evita re-emissão)

  monitoramento-web:
    image: app-monitoramento:latest   # imagem com `next start`
    env_file: .env.monitoramento
    expose: ["3000"]

  financeiro-web:
    image: app-financeiro:latest
    env_file: .env.financeiro
    expose: ["3000"]

  monitoramento-worker:
    image: app-monitoramento-worker:latest
    env_file: .env.monitoramento
    # sem porta pública; consome trabalho disparado pelo app

volumes:
  caddy_data:
```

Caddyfile:

```
app-monitoramento.seudominio.com {
    reverse_proxy monitoramento-web:3000
}
app-financeiro.seudominio.com {
    reverse_proxy financeiro-web:3000
}
```

> Caddy emite e renova o certificado do **origin** automaticamente (Let's Encrypt). O CloudFront usa um certificado ACM para o domínio voltado ao usuário e conecta ao origin por HTTPS.

### 10.3 CloudFront — comportamentos de cache (a parte com mais pegadinha)

Como o app é dinâmico, um erro de cache aqui vira **bug de segurança** (servir a página de um usuário para outro), não erro visível. Configurar por caminho:

| Caminho | Cache | Origin request (o que repassar) |
|---|---|---|
| `/_next/static/*` | **Cachear forte** (imutável; nomes com hash). | Não precisa repassar cookies. |
| `/_next/image*` | Cachear por query string **com cuidado**, ou desabilitar. | Conteúdo derivado; validar antes de cachear. |
| `/` e demais rotas (páginas, Server Actions, Route Handlers) | **Cache desabilitado** (respeitar `Cache-Control` da origem). | **Repassar** `Cookie`, `Authorization`, `Host` e headers necessários. |

Regras práticas:

- Use uma **cache policy** "CachingDisabled" no comportamento padrão e "CachingOptimized" apenas em `/_next/static/*`.
- Garanta que a **origin request policy** do comportamento padrão **repasse cookies e `Authorization`** — a sessão do Cognito/Next depende disso; sem isso, login e Server Actions quebram de forma confusa.
- Nunca cachear respostas com `Set-Cookie` nem HTML personalizado por usuário.

### 10.4 Pool de conexões (obrigatório, singleton)

Com SSR, cada render pode abrir conexão. O pool precisa ser **único por processo** e reutilizado entre requests (o erro clássico em Next é instanciar o client por request e vazar conexões em hot reload). Dimensionamento com folga:

- `db.t4g.micro` → `max_connections` padrão **~112**.
- Sugestão: `monitoramento-web` max **8**, `financeiro-web` max **8**, `worker` max **4** → **~20** no total, bem abaixo do teto.

`pg` (node-postgres) — singleton com proteção em dev:

```ts
import { Pool } from "pg";

const globalForPool = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 8),
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") globalForPool.pgPool = pool;
```

Prisma — instância única (mesma ideia de global em dev) e `connection_limit` na URL. Em folha, usar **transações** para o recálculo (marcar versão anterior `is_current=false` e inserir a nova atomicamente).

> Evolução: se o número de conexões virar gargalo, introduzir **PgBouncer** (sidecar barato) ou **RDS Proxy**. Não é necessário na Fase 1.

### 10.5 Variáveis de ambiente (injetadas via SSM no deploy)

Comuns aos apps:

```
DATABASE_URL=postgres://...           # RDS privado
AWS_REGION=us-east-1
S3_BUCKET=empresa-logistica-arquivos
COGNITO_USER_POOL_ID=...
COGNITO_CLIENT_ID=...
COGNITO_ISSUER=https://cognito-idp.<region>.amazonaws.com/<poolId>
PG_POOL_MAX=8
NODE_ENV=production
```

Financeiro adiciona controles de auditoria/KMS conforme necessidade. **Nenhum `.env` vai para o Git**; os valores vêm do SSM Parameter Store (SecureString) no momento do deploy.

### 10.6 IAM Role da EC2 (menor privilégio, esboço)

```
- s3:PutObject / s3:GetObject / s3:ListBucket
    Resource: arn do bucket e prefixos usados (planilhas/, exports/, ...)
- kms:Decrypt / kms:GenerateDataKey
    Resource: arn da chave KMS do bucket/RDS (se SSE-KMS)
- ssm:GetParameter / ssm:GetParameters / ssm:GetParametersByPath
    Resource: /app/logistica/*  (caminho dos segredos)
```

---

## 11. Deploy, operação e observabilidade

### 11.1 Deploy (Fase 1)

- Build das imagens Docker (um app por imagem: `next build` → runtime `next start`).
- Deploy na EC2 via **pull** da imagem + `docker compose up -d`.
- **Migrações** controladas por ferramenta (Prisma Migrate, Drizzle, TypeORM ou Flyway); rodar migração antes de subir a nova versão.
- Backup automático do RDS habilitado **desde o dia 1**.
- Manter a(s) imagem(ns) anterior(es) taggeadas para **rollback** rápido.
- Não fazer deploy durante janela sensível do financeiro (ex.: fechamento de folha), já que `docker compose up -d` reinicia containers.

### 11.2 Observabilidade mínima

| Área | Métrica/log | Alerta |
|---|---|---|
| EC2 | CPU, memória, disco, status check | CPU alta persistente, disco > 80%, instância indisponível. |
| RDS | CPU, conexões, storage, IOPS, locks | Conexões perto do limite, storage baixo, CPU alta. |
| S3 | Erros de upload/download, tamanho acumulado | Falhas de upload, crescimento inesperado. |
| Aplicação | 4xx/5xx, latência, jobs falhos | Aumento de 5xx ou jobs falhando. |
| Segurança | Acessos negados, login suspeito, ação crítica | Picos de acesso negado, ações administrativas. |

### 11.3 Backup, retenção e recuperação

- **RDS:** backup automático diário, retenção mínima 7 dias; **snapshot manual mensal** como camada adicional.
- **S3:** versionamento nos buckets de planilhas/exports; lifecycle para expirar temporários e baratear arquivos antigos.
- **Testar restauração** antes de considerar o backup "válido".
- **Runbook de recuperação da EC2 (stateless):** subir instância nova a partir de AMI ou script de bootstrap → `docker compose up -d` → apontar DNS/origem. Objetivo: recriação em **minutos**, não horas. Como nada de estado mora no disco local, não há perda de dados.

---

## 12. Estimativa de custo

Valores **aproximados**, a validar na calculadora oficial da AWS (variam por região, instância, storage, tráfego, snapshots e câmbio). Para este cenário interno e de baixo volume, a faixa realista é pequena.

| Cenário | Componentes | Estimativa mensal |
|---|---|---|
| MVP econômico | EC2 pequena (t3/t4g.small), RDS `db.t4g.micro`, S3 poucos GB, Cognito, Route 53, CloudFront baixo tráfego | **US$ 40–60/mês** |
| MVP confortável | EC2 t3/t4g medium, RDS `t4g.small`, S3, CloudFront, logs básicos | **US$ 70–100/mês** |
| Com Load Balancer (evolução) | Confortável + ALB | US$ 95–140/mês |
| Produção robusta (futuro) | ALB, ECS/Auto Scaling, RDS Multi-AZ, observabilidade forte | US$ 150+/mês |

> **Orçamento sugerido:** reservar **US$ 70–100/mês** é margem mais realista que o mínimo absoluto, sobretudo por envolver dashboard financeiro e PostgreSQL gerenciado. Cognito e S3 são praticamente irrelevantes no volume atual (checar a tabela de preços vigente do Cognito).

---

## 13. Riscos, mitigação e evolução

### 13.1 Riscos principais

| Risco | Impacto | Mitigação |
|---|---|---|
| CloudFront cacheia conteúdo dinâmico | **Vazamento de dado entre usuários** | Cache split (10.3): estático cacheável, dinâmico desabilitado, cookies/Authorization repassados. |
| Criptografia do RDS esquecida na criação | Retrofit exige migração | Ligar KMS **na criação** (ADR-05). |
| Pool mal configurado / conexão por request | Esgota `max_connections`, app cai | Pool singleton dimensionado (10.4). |
| Estado no disco da EC2 | Recuperação lenta/perda de dado | EC2 stateless (ADR-08); AMI/bootstrap. |
| Planilha grande sem limite | Worker consome memória, trava | Limite de tamanho, timeout, status e tratamento de falha (7.2). |
| Permissão mal configurada | Vazamento entre perfis | Validação no servidor, testes de autorização, audit logs. |
| RDS público / SG aberto | Exposição do banco | RDS privado e SG restritivo. |
| Bucket S3 público | Exposição de planilhas/exports | Block Public Access + presigned URLs. |
| Logs com dado sensível | Risco LGPD/financeiro | Mascaramento, retenção e revisão (9.4). |
| `UPDATE` destrutivo em folha | Perde histórico do cálculo | Versionamento em `payroll_calculations` (8.3). |
| Deploy manual sem padrão | Erro humano, rollback difícil | Imagens versionadas, migração antes do up, checklist de deploy. |

### 13.2 Caminho de evolução (por gatilho, não por calendário)

| Gatilho | Evolução | Motivo |
|---|---|---|
| Planilhas crescem em tamanho/frequência | **SQS + worker separado** | Resiliência; não travar o processo web. |
| Downtime passa a importar | **ALB + 2ª EC2 ou ECS** | Alta disponibilidade e deploy sem downtime. |
| Conexões viram gargalo | **PgBouncer ou RDS Proxy** | Multiplexar conexões ao RDS. |
| Banco cresce | RDS maior, índices, possível separação de schemas/databases | Capacidade e organização. |
| Financeiro se torna crítico | Deploy mais controlado + redundância específica do módulo | SLA do financeiro acima do monitoramento. |

---

## 14. Checklist de handoff (Fase 1)

### 14.1 Obrigatórios desde a primeira versão

| # | Item | Status |
|---|---|---|
| 1 | Pool de conexões consciente e **singleton** por processo. | Pendente |
| 2 | RDS **privado** com backup automático e **criptografia KMS na criação**. | Pendente |
| 3 | S3 **privado** (Block Public Access) com controle de acesso via IAM/presigned URL. | Pendente |
| 4 | **Audit log** no financeiro (quem/o quê/quando) + **versionamento** de cálculo. | Pendente |
| 5 | Controle de acesso por **grupos/perfis** no Cognito, validado no servidor. | Pendente |
| 6 | **Limites e status** de processamento para uploads (tamanho, timeout, falha). | Pendente |
| 7 | **Política de logs**: não registrar CPF/CNPJ, salário ou dados sensíveis. | Pendente |
| 8 | **Snapshot mensal** + runbook de recuperação documentado (EC2 stateless). | Pendente |
| 9 | **CloudFront cache split**: estático cacheável, dinâmico desabilitado, cookies/Authorization repassados. | Pendente |

### 14.2 Checklist de revisão adicional

| Categoria | Pergunta | Status |
|---|---|---|
| Arquitetura | Os dois apps estão separados em código e deploy? | Pendente |
| Next.js | Confirmado `next start` (Node), sem `output: 'export'`? | Pendente |
| Auth | Sessão em cookie/JWT (não em memória do processo)? | Pendente |
| Backend | Todas as ações sensíveis validam JWT e permissão? | Pendente |
| Banco | RDS privado, acessível só pela EC2? | Pendente |
| Uploads | Upload direto ao S3 via presigned URL? | Pendente |
| Worker | Processamento fora do processo web? | Pendente |
| Segredos | `.env` fora do Git, valores no SSM? | Pendente |
| Backups | Backup automático + retenção configurados e **restauração testada**? | Pendente |
| Deploy | Imagem anterior disponível para rollback? | Pendente |
| Custos | Estimativa validada na calculadora AWS? | Pendente |
| LGPD | CPF/salário mapeados e minimizados; práticas técnicas aplicadas? | Pendente |

---

## 15. Referências

- Amazon Cognito User Pools — https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html
- Cognito — grupos em User Pools — https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-user-groups.html
- Cognito — tokens JWT — https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html
- Amazon S3 — presigned URLs — https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- Amazon S3 — upload com presigned URL — https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
- Amazon S3 — Block Public Access — https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
- Amazon RDS — Security Groups — https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html
- Amazon RDS — criptografia — https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html
- Amazon RDS for PostgreSQL — https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html
- AWS Systems Manager Parameter Store — https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html
- CloudFront — cache policies — https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html
- CloudFront — origin request policies — https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-origin-requests.html
- Next.js — self-hosting (`next start`) — https://nextjs.org/docs/app/building-your-application/deploying

---

> **Observação final:** este documento é a base técnica para o início do desenvolvimento (Fase 1). Antes de produção, validar requisitos legais/LGPD, volume real de arquivos, retenção de dados, estratégia de backup/restauração (com teste) e o modelo final de permissões.

# Guia rápido — Luiz

Você já tem o repositório e o `.env.local` configurados. Só falta trocar de
branch e ver o que mudou hoje.

---

## 1. Trocar pra branch atual

No PowerShell, dentro da pasta do projeto:

```
git fetch origin
git checkout feat/painel-live
git pull
```

(Se já estiver nela, só o `git pull` busca o que mudou.)

---

## 2. Rodar

```
npm install
npm run dev
```

Abra `http://localhost:3000`. Se já tinha rodado antes e não mudou nada nas
dependências, pode pular o `npm install` e ir direto pro `npm run dev`.

---

## 3. O que foi feito hoje

### Cadastro de usuário com aprovação
Tela de login agora tem **"Cadastre-se"**. A pessoa preenche nome, cargo
(texto livre, ex.: "Desenvolvedor"), e-mail e senha — e fica **pendente**,
sem conseguir entrar. Em **Configurações → Usuários** aparece uma lista de
"Cadastros pendentes" no topo; o admin clica em "Revisar", escolhe o
**perfil de acesso** (nível de permissão) e a **operação** que a pessoa vai
ver, e aprova (ou rejeita). Antes disso não existia cadastro — só dava pra
criar usuário direto no banco.

### Gestão completa de usuário
No mesmo lugar, editar um usuário já existente agora deixa trocar: nome,
cargo, e-mail, **senha** (campo novo — antes não tinha como redefinir senha
pela tela), perfil de acesso, escopo (uma operação só ou todas), quais
operações aparecem pra ele no menu, e o interruptor **"Administrador"**
separado do cargo/perfil (antes "ADMIN" era uma opção dentro do cargo,
misturado; agora é só uma flag independente — alguém pode ser
"Desenvolvedor" e admin, ou "Coordenador" e não-admin).

### PNR (prejuízos) — período flexível
A aba PNR tava com bug: o filtro padrão era "Hoje", mas PNR é cumulativo
(tickets de dias anteriores continuam valendo) — então sempre aparecia
zerado. Corrigido (default passou a ser "Todo o período"). Além disso, os
filtros de data ganharam 3 modos novos: **Últimos N dias** (você digita o
número), **Dia específico** (escolhe uma data) e **De um dia até outro**
(intervalo).

### Prejuízo real do motorista + janela de desempenho
O ranking de motoristas do painel "SLA & DS" mostrava um prejuízo
**inventado** (fórmula fixa por ocorrência). Agora usa o **PNR de verdade**
importado. E em qualquer tabela de motorista (ranking, aba DS, aba PNR),
clicar no nome abre uma janela com gráfico do desempenho dele nos últimos
7/14/30/60/90 dias + total de perdas no período — antes só existia na tela
de motoristas e era mockado.

### Início reescrito
A tela inicial trocou o resumo antigo por um novo: série/gráfico,
ranking de motoristas e bases por operação, tudo consolidado.

---

Qualquer dúvida, chama o Pedro.

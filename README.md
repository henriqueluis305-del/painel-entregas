# Painel de Entregas — Guia rápido

Este guia é pra quem vai **apresentar o sistema** e não é programador. Ele
explica, em passos simples: como colocar o projeto pra rodar no seu
computador, o que cada parte da tela faz, o que é novo, o que ainda está
sendo construído, e sugere uma ordem pra mostrar tudo numa apresentação.

Não se preocupe em entender "como o código funciona" — você só precisa
seguir os passos abaixo na ordem.

---

## 1. O que é este sistema

O Painel de Entregas é o painel interno onde a equipe acompanha as entregas
das operações (hoje, a operação **Shopee** é a que está completa). Nele dá
pra ver, em tempo real:

- Quantos pacotes foram entregues no dia (**SLA**)
- O desempenho dos motoristas (**DS** — Delivery Success)
- Pacotes "presos" há vários dias (**Stuck**)
- Prejuízos por ticket de reclamação (**PNR**)
- Quem tem acesso ao sistema e o que cada pessoa pode ver (**Usuários**)

Tudo isso é alimentado por planilhas/CSVs que alguém sobe no sistema (aba
**Uploads**) ou, no futuro, vai ser puxado automaticamente todo dia.

---

## 2. Antes de começar (instalar o necessário)

Você só precisa instalar duas coisas, uma única vez:

1. **Node.js** (a "engine" que roda o projeto)
   - Baixe em: https://nodejs.org (escolha a versão **LTS**, é a recomendada)
   - Instale como qualquer programa (clicar em "Avançar" até o fim)

2. **Git** (pra baixar o código do projeto)
   - Baixe em: https://git-scm.com/downloads
   - Instale também com as opções padrão

Pra confirmar que instalou certo, abra o **PowerShell** (procure "PowerShell"
no menu Iniciar) e digite, um por vez:

```
node -v
git -v
```

Se aparecer um número de versão em cada um (e não um erro), está tudo certo.

---

## 3. Baixar e rodar o projeto

Ainda no PowerShell:

1. Escolha uma pasta onde quer guardar o projeto (ex.: `Documentos`) e entre
   nela:
   ```
   cd Documents
   ```

2. Baixe o código do projeto:
   ```
   git clone https://github.com/henriqueluis305-del/painel-entregas.git
   cd painel-entregas
   ```

3. Entre na branch onde estão as funcionalidades novas (a apresentação é
   sobre ela — ainda não foi unificada com a versão principal):
   ```
   git checkout feat/painel-live
   ```

4. Instale as dependências do projeto (isso baixa tudo que o projeto precisa
   pra funcionar — pode demorar alguns minutos):
   ```
   npm install
   ```

5. **Peça ao Pedro o arquivo `.env.local`.** Esse arquivo tem as senhas de
   acesso ao banco de dados e por segurança ele nunca fica no repositório —
   precisa ser enviado por fora (WhatsApp, e-mail, pendrive, etc.). Quando
   receber, coloque esse arquivo **direto na pasta `painel-entregas`** (a
   mesma pasta onde tem o arquivo `package.json`).

6. Rode o projeto:
   ```
   npm run dev
   ```

7. Abra o navegador (Chrome, Edge, etc.) e acesse:
   ```
   http://localhost:3000
   ```

Pronto — o painel deve abrir na tela de login. Peça ao Pedro um e-mail e
senha de teste pra entrar.

> **Pra parar o projeto:** volte no PowerShell e aperte `Ctrl + C`.
> **Pra rodar de novo depois:** só repita o passo 6 (`npm run dev`) — não
> precisa instalar nada de novo, a menos que o código tenha mudado bastante
> (nesse caso, rode `npm install` de novo antes).

---

## 4. Tour rápido pela tela

Depois de logar, no menu lateral esquerdo você vê:

| Item do menu | O que é |
|---|---|
| **Início** | Resumo geral: escolhe a operação (hoje só Shopee tem dados reais) e mostra um resumo de saúde, SLA, DS e quem está causando mais ocorrência. |
| **SLA & DS** | O "painel vivo do dia" — escolhe operação → base → dia, e mostra os números daquele recorte, mais o ranking de motoristas. |
| **Shopee** (na seção Operações) | A operação mais completa, com sub-abas: **Geral, SLA, DS, Stuck, PNR, Uploads, Config.** |
| **Configurações** | Só pra administradores — gestão de usuários (quem tem acesso) e operações/bases. |

Dentro de **Shopee**, as sub-abas:

- **Geral** — visão consolidada de tudo (cards clicáveis pra cada sub-aba)
- **SLA** — % de entregas dentro do prazo
- **DS** — % de sucesso de entrega por motorista
- **Stuck** — pacotes presos há dias sem mover
- **PNR** — prejuízo financeiro por ticket de reclamação
- **Uploads** — onde se sobe as planilhas/CSVs do dia (só admin)
- **Config** — ajustes da operação (só admin)

---

## 5. O que é novo (implementado recentemente)

### Cadastro de usuário com aprovação
Antes, só dava pra criar usuário direto no banco de dados. Agora:

1. Na tela de login tem um link **"Cadastre-se"**.
2. A pessoa preenche nome, cargo, e-mail e senha — e fica com o cadastro
   **pendente**, sem conseguir entrar ainda.
3. Um administrador vê esse cadastro pendente em **Configurações → Usuários**
   (aparece destacado no topo), revisa e escolhe o **nível de acesso**
   (perfil) e quais operações a pessoa pode ver, e então **aprova** (ou
   **rejeita**).
4. Só depois disso a pessoa consegue logar normalmente.

### Gestão completa de usuários
No mesmo lugar (**Configurações → Usuários**), o administrador pode editar
qualquer usuário já existente: nome, cargo, e-mail, **trocar a senha**,
nível de acesso, escopo (se vê uma operação só ou todas), quais operações
aparecem pra ele no menu, e se é administrador ou não (isso agora é um
interruptor próprio — "ser admin" não depende mais do cargo da pessoa).

### PNR (prejuízos) funcionando de ponta a ponta
A aba PNR agora importa o CSV de tickets de reclamação e calcula o prejuízo
total, por status e por motorista — com filtros de período flexíveis
(hoje, ontem, últimos N dias, um dia específico, ou um intervalo "de X até
Y").

### Painel de desempenho do motorista
Em qualquer tabela de motorista (no ranking do SLA & DS, na aba DS, ou no
PNR), clicar no nome abre uma janela com o histórico de desempenho dele nos
últimos 7/14/30/60/90 dias, com gráfico e o total de perdas no período.

### Início reformulado
A tela inicial agora mostra um resumo por operação com gráfico, ranking de
motoristas e indicador de saúde, ao invés da tela antiga.

---

## 6. O que ainda está em progresso (não mostrar como "pronto")

- **Exportar PDF** — o botão já existe na tela do Shopee, mas está
  desativado ("Em breve"). Ainda não gera o arquivo.
- **Importação automática diária (23h30)** — hoje, alguém precisa subir as
  planilhas manualmente na aba Uploads. A automação pra puxar isso sozinho
  todo dia ainda não foi feita.
- **Outras operações (iMile, J&T, Loggi, Mercado Livre)** — só aparecem como
  uma tela bem simples (lista de bases). Toda a parte completa (SLA, DS,
  Stuck, PNR, Uploads) hoje só existe pra **Shopee**.
- **Páginas "Motoristas" e "Liberação"** (no menu) — ainda são só uma
  tela de espaço reservado, sem conteúdo real.
- **Gráfico de tendência do motorista no ranking principal** — hoje o
  histórico aparece só na janela que abre ao clicar no nome; uma visão de
  tendência direto na lista ainda não existe.
- **Escolher a "operação principal" de cada usuário** — o campo já existe
  no banco de dados, mas ainda não tem uma tela pra configurar isso.

---

## 7. Roteiro sugerido pra apresentação

Uma ordem que conta uma "história" de ponta a ponta (≈10-15 min):

1. **Login** — mostre a tela de login e o link "Cadastre-se". Cadastre uma
   conta de exemplo na hora (nome/cargo/e-mail/senha) e mostre a mensagem
   "cadastro enviado, aguarde aprovação".
2. **Aprovação** — logue como administrador, vá em
   **Configurações → Usuários**, mostre o cadastro pendente no topo, clique
   em "Revisar", escolha um perfil de acesso e uma operação, e aprove.
   Mostre que a senha também pode ser trocada por ali.
3. **Início** — volte pro painel principal, mostre o resumo da operação
   Shopee (saúde, SLA, DS, ranking).
4. **SLA & DS (painel vivo)** — troque o seletor de base/dia pra mostrar que
   é dinâmico. Clique no nome de um motorista no ranking pra abrir o painel
   de desempenho — troque entre 7/14/30/60/90 dias.
5. **Shopee → Geral** — mostre o consolidado e clique num dos cards pra
   cair direto na sub-aba.
6. **Shopee → PNR** — mostre o filtro de período (últimos N dias / dia
   específico / intervalo) e o prejuízo total calculado.
7. **Shopee → Uploads** — mostre como sobe uma planilha (sem confirmar o
   upload de verdade, só até a tela de "resumo antes de confirmar").
8. **Fechamento** — mencione rapidamente os itens da seção 6 (o que ainda
   está por vir), pra deixar claro que o projeto está em evolução contínua.

---

## 8. Em caso de dúvida

Qualquer problema pra rodar (erro no `npm install`, tela em branco, etc.) ou
dúvida sobre alguma funcionalidade, fale com o **Pedro Antunes**.

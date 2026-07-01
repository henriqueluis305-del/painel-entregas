# 🧊 Geladeira — ferramentas prontas, ainda não plugadas

Registro de código já implementado, testado (compila com `tsc --noEmit`) e desacoplado:
existe no projeto mas **nenhuma tela importa ainda**. Serve para consulta rápida e
implementação futura. Cada item tem um **identificador** (`GEL-XXX`) para referência.

> Como usar este arquivo: ache o `GEL-XXX` da feature, leia "Como plugar" e
> "Quando descongelar". Ao colocar algo em produção (uma tela passa a importar),
> mova o item para a seção **Descongelados** no rodapé com a data.

---

_(vazio — nada congelado no momento)_

---

<!--
TEMPLATE para próximos itens — copie o bloco abaixo:

## GEL-00X — <nome curto>

**Status:** 🧊 congelado · criado em AAAA-MM-DD
**O que faz:** <uma frase>

### Arquivos
| Camada | Arquivo | Exporta |
|---|---|---|
| ... | ... | ... |

### Como plugar
<exemplo mínimo de uso>

### Quando descongelar
<a condição que justifica ligar isso>

### Cuidados
<armadilhas, dependências, migrações pendentes>

---
-->

## ✅ Descongelados (já em produção)

### GEL-001 — Resolução de CEP (cache-aside ViaCEP) · descongelado 2026-06-25
Motor de CEP→cidade (`src/lib/cep.ts` `lookupCeps`, cache `cep_cache` + ViaCEP).
Ligado na aba **Detalhe** do Stuck: a coluna "Cidade" resolve a partir do CEP do pacote.
- Migração `sql/16_shopee_package_cep.sql` adicionou `shopee_package.cep` (8 dígitos s/ máscara).
- CEP capturado nos uploads de **backlog** e **tracking** (`src/app/dashboard/operacao/shopee/uploads/actions.ts`), via header que casa com `/cep|postal|zip/i` (`src/lib/shopee/csv.ts`).
- Cidade resolvida na leitura em `getStuckPackages` (`src/lib/shopee/stuck-queries.ts`).
- Pacotes anteriores à migração ficam sem cidade até o próximo upload que traga o CEP.

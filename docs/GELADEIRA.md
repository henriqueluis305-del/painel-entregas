# 🧊 Geladeira — ferramentas prontas, ainda não plugadas

Registro de código já implementado, testado (compila com `tsc --noEmit`) e desacoplado:
existe no projeto mas **nenhuma tela importa ainda**. Serve para consulta rápida e
implementação futura. Cada item tem um **identificador** (`GEL-XXX`) para referência.

> Como usar este arquivo: ache o `GEL-XXX` da feature, leia "Como plugar" e
> "Quando descongelar". Ao colocar algo em produção (uma tela passa a importar),
> mova o item para a seção **Descongelados** no rodapé com a data.

---

## GEL-001 — Resolução de CEP (cache-aside ViaCEP)

**Status:** 🧊 congelado · criado em 2026-06-25
**O que faz:** dado um CEP, devolve `{ cidade, bairro, uf }`. Cada CEP só bate na
API do ViaCEP **uma vez na vida** — depois fica no banco e na memória do navegador.

### Arquivos
| Camada | Arquivo | Exporta |
|---|---|---|
| Servidor (motor) | `src/lib/cep.ts` | `lookupCep`, `lookupCeps`, `normalizeCep`, type `CepInfo` |
| Servidor (action) | `src/lib/cep-actions.ts` | `resolveCepsAction` (exige login) |
| Cliente (memo) | `src/hooks/use-cep.ts` | `useCep`, `resolveCepsCached` |

### Camadas de cache (rápida → lenta)
```
useCep / resolveCepsCached  → memo na memória do navegador (sessão)
        ↓ se faltar
resolveCepsAction (servidor) → tabela cep_cache no Postgres (permanente, global)
        ↓ se faltar
fetch ViaCEP                 → API externa (só a 1ª vez de cada CEP)
```

### Armazenamento
- Tabela `cep_cache` — `sql/01_schema.sql:206`. PK `cep` = **8 dígitos sem máscara**.
- `cidade` e `bairro` são `NOT NULL` (o motor usa `""` quando o ViaCEP devolve vazio).

### Como plugar
**Server Component** (ex.: tabela renderizada no servidor):
```ts
import { lookupCeps } from "@/lib/cep"
const mapa = await lookupCeps(pacotes.map((p) => p.cep))
// mapa.get("29930000")?.cidade
```

**Client Component** (campo único):
```tsx
"use client"
import { useCep } from "@/hooks/use-cep"
const { info, loading } = useCep(cep) // info: { cidade, bairro, uf } | null
```

**Client Component** (lista, um round-trip só):
```tsx
import { resolveCepsCached } from "@/hooks/use-cep"
const mapa = await resolveCepsCached(ceps)
```

### Quando descongelar
Quando houver uma tela que precise exibir cidade/bairro a partir do CEP. O CEP já
chega no upload de tracking (`{ codigo, cep, tel, driver, status }`) mas hoje é
descartado — para persistir por pacote seria preciso **uma coluna nova** em
`shopee_package` + migração (ainda não feita).

### Cuidados
- `useCep`/`resolveCepsCached` só rodam em componente `"use client"`.
- Em Server Component, use `lookupCeps` direto (não o hook).
- `resolveCepsAction` exige sessão logada (anti-abuso do ViaCEP).

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

_(vazio — mova itens para cá com a data quando uma tela passar a importá-los)_

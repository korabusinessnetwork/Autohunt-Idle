# Spec de execução: slots de equipamento por parte do corpo

*(spec de **build**. Amenda `specs/build-fase-3c-equipamento.md`, que já está construído.)*

- **Decisão do dono:** 2026-08-11 — "a estrutura de itens é a mesma do TB: capacete, armadura,
  luva, bota etc"
- **Reverte:** a exclusão "mais de 4 tipos de item" de `specs/equipamento-e-poder.md`, seção 2

## 1. O que muda

De **1 arma + 2 acessórios genéricos** para **6 slots por parte do corpo**:

| Slot | Papel |
|---|---|
| `arma` | única peça que carrega **tipo de dano** (físico ou mágico) |
| `capacete` | peça de poder, pode ter afinidade |
| `armadura` | peça de poder, pode ter afinidade |
| `luva` | peça de poder, pode ter afinidade |
| `bota` | peça de poder, pode ter afinidade |
| `acessorio` | peça de poder, pode ter afinidade |
| `skin` | **cosmético**, continua fora de qualquer cálculo |

## 2. Decisões de execução

| # | Assunto | Decisão |
|---|---|---|
| D1 | **Tipo determina o slot** | Um capacete só cabe no slot de capacete. Como a correspondência é 1:1, `equipar_item` **perde o parâmetro de slot** — o servidor deriva do tipo do item. Menos superfície, menos como errar. |
| D2 | **Afinidade em todas as peças** | Antes era exclusiva do acessório. Com seis slots, manter assim faria cinco deles serem só um número somado. Agora qualquer peça que não seja a arma pode ter afinidade. |
| D3 | **Bônus de conjunto em 2/4/6** | "Completo" passou de 3 para 6 peças, então precisa de degrau intermediário. Cada degrau continua valendo **mais que o dobro do anterior**, que era a garantia do critério 16 da spec de origem. |
| D4 | **Arma inicial** | Segue existindo (critério 8 da origem). Os outros cinco slots **começam vazios** — vazio funciona normalmente, só não contribui. |

## 3. Critérios de aceite

1. Existem exatamente **6 slots de poder** — arma, capacete, armadura, luva, bota, acessório — e
   1 slot de skin.
2. Um item só entra no slot do próprio tipo; tentar outro é recusado pelo servidor.
3. `equipar_item` recebe **só o id do item** — o slot é derivado, não informado.
4. **Slot vazio funciona normalmente**, apenas sem contribuir para o poder.
5. Só a **arma** carrega tipo de dano.
6. **Qualquer peça que não seja a arma** pode ter afinidade, e a sinergia vale para todas.
7. Bônus de conjunto em três degraus — **2, 4 e 6 peças** —, cada um valendo mais que o dobro do
   anterior.
8. **Skin continua fora de todo cálculo de poder**, exatamente como antes.
9. O drop distribui entre os seis tipos de equipamento.
10. `npm test` e `npm run build` verdes; os testes de conjunto e sinergia cobrem os degraus novos.

## 4. Definição de "aprovado sem ressalvas"

Os 10 critérios verificados, com as três provas da rodada anterior ainda de pé: **skin fora do
cálculo**, **degrau de conjunto sempre maior que o dobro do anterior**, e **bônus parcial não
empilha entre conjuntos diferentes**.

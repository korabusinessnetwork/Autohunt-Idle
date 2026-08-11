# Spec de execução: passe de recompensas

- **Spec de origem:** `specs/passe-de-recompensas.md` (6 critérios)
- **Rodada do loop:** 9ª

## 1. Escopo

A **trilha de recompensas**: um produto comprado à parte da assinatura, que dá acesso a uma
sequência de prêmios destravados **jogando** — não recebidos de uma vez na compra.

A assinatura já existe e já dá 24h de farm + 2x XP (critério 5 da spec de origem, fechado na
Fase 1). Esta rodada constrói o passe como **produto independente**: dá para ter um, o outro, os
dois, ou nenhum.

## 2. As duas regras que não são preferência de design

### 2.1 A trilha inteira é publicada antes da compra

O jogador vê **cada tier, cada recompensa e quantos pontos faltam** antes de decidir pagar. Sem
"surpresa", sem "prêmio misterioso", sem faixa.

Não é polidez: um passe pago cuja recompensa é desconhecida no momento da compra **é recompensa
aleatória paga** — a restrição CRÍTICA permanente do projeto (`memory/restrictions.md`). A
diferença entre este passe e uma loot box é exatamente esta, e por isso vira teste estrutural:
**nada no caminho de conceder recompensa de passe pode sortear.**

### 2.2 Não existe prazo

Passe de mercado usa temporada com expiração, e é isso que empurra urgência de compra. Contradiz a
restrição "sem dark pattern de urgência", já registrada. A spec de origem decidiu: **a trilha não
expira, o progresso não some, e uma recompensa destravada é do jogador para sempre** — inclusive
depois de cancelar.

Vira teste também: **nenhuma coluna de prazo na trilha, e nenhuma rota que remova item de origem
`passe`.**

## 3. Fora de escopo — e por quê

- **Preço, e compra com dinheiro real.** Depende de gateway contratado (P3). Entra o *seam*: a
  ativação é RPC exclusiva de `service_role`, chamada por webhook assinado — mesmo padrão da
  assinatura, mesmo motivo.
- **Comprar o passe com diamante.** Seria a única forma de exercitar o passe hoje, mas muda o
  desenho de monetização — é decisão do dono, não escolha minha. Registro como pendência.
- **A lista final de prêmios.** A spec de origem confirma **uma** recompensa: a skin exclusiva. O
  resto é placeholder, e ela diz isso explicitamente. A trilha nasce como **dado em tabela**, então
  trocar prêmio é `update`, não migration.
- **Duas trilhas (grátis × paga).** A spec de origem descarta: é uma trilha só, paga.

## 4. Critérios de aceite

1. O passe é **independente da assinatura**: ter um não implica o outro, e cancelar um não afeta o
   outro.
2. A ativação do passe só acontece por **RPC exclusiva de `service_role`** — o client nunca se
   declara portador.
3. O progresso vem de **atividade normal de jogo** (ciclos de farm e dungeon), pela mesma RPC que
   já credita tudo. O client nunca informa quantos pontos ganhou.
4. **Pontos só acumulam com o passe ativo.** Cancelou, para de progredir — e volta a progredir do
   ponto onde parou se reativar. Não perde o que tinha.
5. A trilha é **dado em tabela**, legível pelo client: tier, pontos necessários, tipo e raridade da
   recompensa. Publicada inteira, antes da compra.
6. **Nenhum sorteio no caminho do passe.** Verificação estrutural: a função que concede recompensa
   de passe não usa `sorteio01`, `escalar_raridade`, `random(` nem `conceder_item`.
7. A trilha **não tem coluna de prazo, expiração ou temporada** — verificação estrutural.
8. Recompensa destravada **nunca é retirada**: nenhuma rota apaga item de origem `passe`, nem
   quando o passe é desativado.
9. Existe **pelo menos uma recompensa exclusiva** — uma skin que nenhuma outra rota do jogo
   concede. Verificação estrutural: só a trilha do passe marca um item como exclusivo.
10. Cruzar um tier concede a recompensa **automaticamente**, sem botão de "resgatar". Fila de
    prêmio não coletado é cobrança disfarçada, e o Princípio nº1 não aceita.
11. `npm test`, `npm run build` e `./scripts/pg-local.sh` verdes.

## 5. Edge cases

- **Ganhar pontos suficientes para dois tiers de uma vez** (ausência longa) — concede os dois, em
  ordem. Nunca pula tier.
- **Cancelar no meio da trilha** — mantém tier, pontos e itens; para de ganhar pontos novos.
- **Reativar depois** — retoma do mesmo ponto. Nada é zerado.
- **Passe ativo sem assinatura** (e vice-versa) — funciona normalmente.
- **Chegar ao fim da trilha** — pontos continuam acumulando, sem nada para conceder. Não é erro.
- **Progresso durante farm offline** — a spec de origem deixou "a decidir" e apontou a leitura
  natural. **Decido que sim**, e registro como decisão reversível: é a mesma RPC que credita, e
  fazer o farm offline não contar exigiria um caminho de crédito separado — justamente o tipo de
  bifurcação que a arquitetura evitou desde a Fase 1.

## 6. Definição de "aprovado sem ressalvas"

Os 11 critérios verificados; e as três provas centrais por teste: **nada sorteia**, **nada
expira**, **nada é retirado**.

---

# Resultado da review — 2026-08-11

`npm test`: **179 passando** (174 → 179). `npm run build`: **verde**, 0,44 MB de 8 MB.
`./scripts/pg-local.sh`: **13 migrations aplicam e a fumaça passa**, com uma seção nova
(`== passe de recompensas ==`) que joga a trilha inteira contra Postgres 16.

## Auditoria dos 11 critérios

| # | Veredito | Evidência |
|---|---|---|
| 1 | sim | `ter passe não torna o jogador assinante`, `o passe não dá o 2x XP da assinatura`, `a assinatura vencer não desliga o passe` e `…não mexe no tier do passe` |
| 2 | sim | `ativar_passe`/`desativar_passe` revogadas de `authenticated`, concedidas a `service_role`; a fumaça confere que `authenticated` não as alcança |
| 3 | sim | `o client nunca informa progresso de passe nem se declara portador` — o progresso entra por `creditar_ciclos`, que o client não alcança |
| 4 | sim | `sem passe ativo, jogar não acumula ponto`, `passe desativado para de acumular ponto`, `passe desativado não regride o tier`, `reativar retoma de onde parou, sem zerar` |
| 5 | sim | `passe_recompensa` com `grant select`; `a trilha inteira é publicada antes da compra` confere os 12 degraus **antes** de o passe existir |
| 6 | sim | `a recompensa do passe nunca é sorteada` — nem `sorteio01`, nem `escalar_raridade`, nem `random(`, nem `conceder_item`; `a recompensa concedida é exatamente a que a trilha publicava` |
| 7 | sim | `nada na trilha do passe expira` — a tabela não pode conter `expira`, `validade`, `temporada`, `prazo` ou `termina` |
| 8 | sim | `recompensa de passe já destravada nunca é retirada`; `desativar o passe não retira nenhuma recompensa já destravada` |
| 9 | sim | `só a trilha do passe concede item exclusivo` — **um** `insert` no schema inteiro marca `exclusivo_do_passe`, e ele está dentro de `conceder_recompensa_passe` |
| 10 | sim | `cruzar o primeiro tier concede sozinho, sem resgatar` — não existe RPC de resgate, e a UI não tem botão |
| 11 | sim | as três verificações verdes |

## Decisões de implementação que valem registro

- **A trilha é tabela, não código.** Trocar prêmio vira `update`, não migration — e é o que permite
  publicá-la inteira antes da compra, que é a diferença entre isto e uma caixa aleatória.
- **`conceder_recompensa_passe` faz `insert` direto, e NÃO chama `conceder_item`.** Parece
  duplicação e não é: `conceder_item` sorteia raridade a partir de piso/teto. Reaproveitá-la
  transformaria a recompensa publicada em recompensa sorteada — exatamente o que o critério 6
  proíbe. O teste tranca a porta.
- **Concessão automática ao cruzar o tier.** Sem botão de resgatar e sem fila de "prêmio não
  coletado" — fila é cobrança disfarçada, e o Princípio nº1 não aceita.
- **O passe progride no farm offline.** A spec de origem deixou "a decidir"; decidi que sim, porque
  é a mesma rota de crédito e separar exigiria uma segunda via — a bifurcação que a arquitetura
  evita desde a Fase 1. Reversível: é uma linha em `creditar_ciclos`.
- **`exportar_meus_dados()` ganhou o passe na mesma migration que criou a tabela.** Deixar para
  depois é como o direito de acesso vira promessa parcial.
- **A UI não tem contagem regressiva, prazo nem "última chance".** A ausência é a feature, e está
  dita em `passe.semPrazo` em vez de ficar implícita.

## Ressalvas que continuam valendo

- **A calibragem não é testável.** Um ponto por ciclo e a curva 100→10.000 são chute fundamentado
  (D4). Se a trilha for longa demais para terminar sem comprar algo mais, ela vira outra coisa —
  e nenhum teste julga isso. Registrado como ameaça 10.10, **ABERTA**.
- **Sem gateway, ninguém compra o passe** (P3). A trilha aparece, o botão aparece desabilitado com o
  motivo escrito, e `ativar_passe` só é alcançável por `service_role`.
- **Onze prêmios dos doze são placeholder** — a spec de origem confirma só a skin exclusiva, e diz
  isso. Trocar é `update` na tabela.

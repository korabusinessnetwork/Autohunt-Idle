# Spec de execução: os 8 biomas

- **Spec de origem:** `specs/mapa-mundo-e-dungeon.md` (7 critérios)
- **Rodada do loop:** 10ª

## 1. O que esta rodada é — e o que ela não pode virar

O mundo aberto é **simulação puramente visual** (`src/game/mundo.ts`, core 15). Nada desenhado ali
vale economicamente: XP, moeda, nível e loot vêm exclusivamente do servidor.

Isso torna esta a primeira rodada inteiramente **client-side** desde a Fase 2 — e cria um risco
próprio, que vira o critério mais importante da lista: **bioma não pode influenciar recompensa**.
No instante em que "estar no bioma 7" mudar um número que o servidor credita, a regra que sustenta
o produto inteiro (o client nunca declara ganho) passa a depender de um cálculo que roda no
navegador do jogador.

Bioma é cenário. Só cenário.

## 2. Escopo

Progressão visual de nível 1 a 1000 em **8 biomas de 125 níveis**, cada um com **5 blocos de 25
níveis** que escalam intensidade reaproveitando o mesmo tema — o desenho que a spec de origem
escolheu para caber num time pequeno em fase bootstrap.

- **`src/game/biomas.ts`** — funções puras: nível → bioma, nível → bloco, bloco → intensidade.
- **`src/styles/tokens.css`** — as cores de cada bioma, porque tokens são a fonte única da paleta
  e **nenhum hex pode nascer em TypeScript**.
- **`src/game/sprites.ts`** — 8 silhuetas novas, uma por bioma (o inimigo assinatura).
- **`src/game/mundo.ts`** — o pool passa a ser o do bioma corrente.
- **i18n** — 8 nomes de bioma e 8 de inimigo, nas duas línguas, com piada própria em inglês.

## 3. Fora de escopo — e por quê

- **Tema visual da dungeon** (critério 4 da spec de origem). Não é recusa: **a dungeon não tem
  cena**. Ela é resolvida por RPC e devolve o resultado pronto; não existe tela para tematizar.
  Guardar o bioma na chave hoje seria dado sem consumidor. Fica registrado como pendência, com o
  que exigirá quando houver cena.
- **Arte final.** Continua placeholder (D3): silhuetas geométricas na paleta oficial. A camada
  de sprite segue isolada para troca sem tocar em motor, mundo ou renderizador.
- **Mecânica de transição entre biomas** — a spec de origem já a coloca fora: só ordem visual.

## 4. Critérios de aceite

1. **Bioma não influencia recompensa nenhuma.** Verificação estrutural: nenhuma migration menciona
   bioma, e nenhum módulo de regra (`src/game/regras*.ts`) importa `biomas.ts`.
2. 8 biomas cobrem os níveis 1 a 1000, com fronteiras exatas a cada 125 níveis.
3. Cada bioma tem 5 blocos de 25 níveis, e o bloco escala **intensidade** — saturação do cenário,
   densidade de elemento e tamanho de inimigo — sem exigir arte nova.
4. As cores de cada bioma vivem em `tokens.css`. **Nenhum hex em TypeScript** — o teste varre.
5. Cada bioma tem o **pool base de 5 inimigos** mais **1 inimigo assinatura exclusivo**. O
   assinatura **não substitui** o pool: soma.
6. Nome de bioma e de inimigo assinatura existem em pt e en, e o nome em inglês **não é tradução
   literal** (core, 14).
7. **Nível acima de 1000 permanece no bioma 8.** O nível é infinito
   (`specs/ranking-global.md`); o conteúdo visual não.
8. Nível inválido (0, negativo, `NaN`) cai no bioma 1 sem quebrar o render. Tela branca é o que o
   Princípio nº1 proíbe acima de tudo.
9. O `aria-label` do canvas passa a nomear o bioma corrente — hoje está fixo no bioma 1.
10. `npm test`, `npm run build` e `./scripts/pg-local.sh` verdes.

## 5. Edge cases

- **Nível exatamente na fronteira** (125, 126, 250…) — 125 é o último do bioma 1; 126 abre o 2.
- **Nível 1** — bioma 1, bloco 1, intensidade mínima.
- **Nível 1000** — bioma 8, bloco 5, intensidade máxima.
- **Subir de nível durante a sessão** — o cenário muda sem recriar o motor: o mundo passa a sortear
  do pool novo, e os inimigos vivos terminam a vida deles. Recriar o motor descartaria a cena
  inteira num piscar, o que é pior que a transição gradual.
- **Jogador de nível alto "revisitando" bioma inicial** — a spec de origem cita, mas **não existe
  mecânica de revisitar**: o cenário é função do nível, e o nível não desce.

## 6. Definição de "aprovado sem ressalvas"

Os 10 critérios verificados; a prova central por teste — **bioma não toca em recompensa** — e as
fronteiras dos 8 biomas exercitadas nível a nível, não por amostragem.

---

# Resultado da review — 2026-08-11

`npm test`: **192 passando** (179 → 192, +13). `npm run build`: **verde**, 0,44 MB de 8 MB.
`./scripts/pg-local.sh`: verde — **e sem uma linha de SQL nova**, que é exatamente o esperado de
uma rodada em que bioma é cenário.

## Auditoria dos 10 critérios

| # | Veredito | Evidência |
|---|---|---|
| 1 | sim | `nenhuma migration menciona bioma` (varre as 13) + `nenhum módulo de regra importa biomas` — as duas direções |
| 2 | sim | `cobre o nível 1 ao 1000 sem buraco e sem sobreposição` percorre **nível a nível**, não por amostragem; `as fronteiras caem exatamente a cada 125 níveis` |
| 3 | sim | três alavancas: densidade (`quantosInimigos`), tamanho de inimigo (`surgirInimigo`) e saturação do cenário (`desenharCenario`). `a intensidade vai de 0 a 1 dentro do bioma` |
| 4 | sim | `nenhuma cor de bioma nasce em TypeScript` + `os 24 tokens existem em tokens.css` |
| 5 | sim | `o assinatura SOMA ao pool base, nunca substitui` confere os 6 do pool nos 8 biomas; `cada bioma tem um assinatura exclusivo` |
| 6 | sim | 16 chaves novas em pt e en; o teste de chave órfã exige que todas sejam usadas, e o dicionário tipado exige as duas línguas |
| 7 | sim | `acima de 1000 permanece no bioma 8` — testado até `Number.MAX_SAFE_INTEGER` |
| 8 | sim | `nível inválido cai no bioma 1 sem quebrar` — 0, negativo, `NaN` e fracionário |
| 9 | sim | `aria-label={t(biomaDoNivel(jogador?.nivel ?? 1).nome)}` |
| 10 | sim | as três verificações verdes |

## Decisões de implementação que valem registro

- **13 silhuetas, não 40.** Pool base de 5 + 1 assinatura por bioma. É a economia que a nota de
  design da spec de origem justifica, e o que separa isto de escopo de estúdio grande.
- **24 tokens novos em `tokens.css`, zero hex em TypeScript.** Trocar a cor de um bioma continua
  sendo editar uma linha do design system.
- **Token de bioma ausente não derruba o jogo**: cai para a cor de marca equivalente. Cenário com
  a cor errada é infinitamente melhor que tela de erro — e a ausência aparece no teste, não para o
  jogador.
- **Subir de nível não recria o motor.** `definirNivel` troca a zona no lugar: os inimigos vivos
  terminam a vida deles e os próximos já nascem do pool novo. Recriar descartaria a cena num
  quadro, o que é pior que a transição gradual.
- **A moldura 16:9 também usa a cor do bioma.** Sem isso, a área que sobra fora do mundo
  denunciava a troca de zona com uma faixa creme.
- **Os nomes em inglês são piada própria, não tradução.** "Mount Chewmore" (Vulcão de Goma),
  "Mint Condition" (Geleira de Menta), "Special Snowflake" (Floco Afiado), "Truffle Shuffle"
  (Trufa Pesada).

## Ressalvas que continuam valendo

- **Critério 4 da spec de origem — tema visual da dungeon — não foi implementado, e não é
  recusa: a dungeon não tem cena.** É resolvida por RPC e devolve o resultado pronto. Guardar o
  bioma na chave hoje seria dado sem consumidor. Quando houver cena de dungeon, a chave precisa de
  uma coluna de bioma e `resolver_uma_dungeon` precisa devolvê-la. **Registrado como D13.**
- **Arte continua placeholder** (D3). São silhuetas geométricas na paleta oficial; a camada de
  sprite segue isolada para troca sem tocar em motor, mundo ou renderizador.
- **O balanceamento visual é chute** (D4): +35% de raio e +3 inimigos do 1º ao 5º bloco. Números
  escolhidos para a diferença ser perceptível sem virar poluição.

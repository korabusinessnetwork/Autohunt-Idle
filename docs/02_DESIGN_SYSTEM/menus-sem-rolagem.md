# Menus sem rolagem

> Regra do dono, 2026-08-13: **nenhum menu do jogo rola.** Tudo que o painel
> mostra tem de caber na tela, e não pode existir barra de rolagem no front.

Isto não é preferência estética — é o Princípio nº 1 (intuitividade) aplicado a
painel. Barra de rolagem esconde conteúdo atrás de um gesto: o jogador só
descobre que existe mais coisa se pensar em rolar. Num jogo casual que ninguém
vai ler tutorial para entender, o que está escondido não existe.

## As três saídas (nesta ordem)

Quando o conteúdo não cabe, ele vira uma destas coisas — nunca rolagem.

**1. Vira largura.** Lista de tamanho conhecido e fechado (8 mapas, 5
atributos, 6 itens da loja) vira grade. `repeat(auto-fit, minmax(Xrem, 1fr))`
usa a tela que sobra na horizontal em vez de crescer na vertical.

**2. Vira página.** Lista de tamanho imprevisível (mochila, peças
equipáveis, ranking, trilha do passe) é paginada por `usePaginacao`
(`src/components/shared/ListaPaginada.tsx`). A paginação **mede** o espaço
disponível — não conta linhas com altura chutada — então ela se ajusta sozinha a
qualquer tela e a qualquer compactação de fonte.

**3. Vira menos moldura.** O que compete por altura é o texto de apoio e o
respiro, não a informação. Os `@media` de compactação encolhem padding, gap e
fonte de explicação; nunca escondem um dado que o jogador precisa para decidir.

## O que a paginação exige do CSS

- **O cartão tem `height` fixo, não `max-height`.** A conta de "quantos cabem"
  se apoia na altura do trilho; um cartão que cresce com o conteúdo faz a conta
  mudar a cada troca de página e a lista oscila.
  Padrão: `height: min(Nrem, calc(100dvh - var(--espaco-3) * 2))` — os
  `* 2` são o padding do overlay em cima e embaixo.
- **O trilho é `flex: 1 1 0; min-height: 0; overflow: hidden`** (classe
  `.lista-paginada`). Sem o `min-height: 0`, um item de flex/grid se recusa a
  encolher abaixo do conteúdo e o cartão estoura.
- **O controle de página ocupa lugar mesmo quando há uma página só**
  (`.paginacao--unica { visibility: hidden }`). Se ele sumisse, os ~40px dele
  entrariam e sairiam da conta em laço infinito.

## Ordem das regras (isto já quebrou uma vez)

`@media` **não** ganha especificidade por ser `@media`. Uma compactação escrita
antes da regra larga da mesma classe simplesmente perde. Por isso todo `@media`
mora no **fim** do arquivo, num bloco "ADAPTAÇÕES DE TELA".

O bloco compartilhado de "modo apertado" vive em `global.css` e é prefixado com
`[role='dialog']` pelo mesmo motivo: `global.css` é importado primeiro, então
uma regra de classe pura ali perderia para a regra do painel.

## Os degraus de tela

| Consulta | Quem é | O que muda |
|---|---|---|
| `max-height: 52rem` | notebook comum (~700px) | padding e gap menores; os 7 slots viram uma fileira só (com `auto-fit` eles quebravam em duas, e a segunda fileira custava mais altura do que a lista de peças tinha para viver) |
| `max-width: 48rem` | celular em pé | mochila empilha em uma coluna |
| `max-width: 48rem`, `max-height: 34rem` | pouco espaço em qualquer eixo | slots viram hotbar de ícones, fortificação em 2 colunas, linha de item sem fileira extra |
| `max-height: 34rem` | celular deitado | subtítulos saem (o `aria-label` fica), listas viram grade |

A consulta `(max-width: 48rem), (max-height: 34rem)` também existe em
JavaScript, em `src/utils/useTelaEstreita.ts`, porque CSS não abre nem fecha um
`<details>` — é ela que recolhe o bloco de fortificação no celular. **Se uma
mudar, a outra muda junto.**

## O que verifica que isto continua verdade

`src/styles/semRolagem.test.ts` reprova o build se:

1. Qualquer CSS de tela de jogador declarar `overflow: auto | scroll | overlay`.
2. Um arquivo com `position: fixed` e regra de `__cartao` não declarar `height`
   nem `max-height` nesse cartão.

**Exceção única e deliberada:** `src/features/console/` — o console do dono é
ferramenta de auditoria interna, não menu de jogador. Está na constante
`FORA_DA_REGRA` do teste, com o motivo escrito. Qualquer outra exceção precisa
de decisão do dono.

## Ligações

- `src/components/shared/ListaPaginada.tsx` — `usePaginacao` e `Paginacao`
- `src/utils/useTelaEstreita.ts` — a consulta em JavaScript
- `src/styles/semRolagem.test.ts` — o teste que segura a regra
- CLAUDE.md — Princípio nº 1 e a regra de separar CSS do JSX

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
`[role='dialog']` para ganhar especificidade (0,2,0).

> **Corrigido em 2026-08-14.** Este parágrafo dizia que `global.css` é importado
> **primeiro**, e que o prefixo existia para compensar isso. É o contrário.
> `main.tsx` importa `./App` na linha 4 e `./styles/global.css` só na linha 6, e
> módulo ES avalia em profundidade — então todo CSS de painel entra **antes** do
> global. Medido nos dois lados: em dev, `PainelAtributos.css` é a folha 5 e
> `global.css` a 24; no bundle de produção, o bloco do painel está no byte 7.721
> e o de modo apertado no 47.900.
>
> A consequência inverteu de lado e vale saber antes de compactar um painel: o
> bloco de `global.css` vence os painéis **por especificidade e por ordem**.
> Abaixo de `34rem`, uma regra de classe simples no painel não sobrepõe nada e
> falha **em silêncio** — sem erro, sem aviso, com a media query casando. Para
> sobrepor de verdade é preciso 0,3,0, como em
> `.atributos[role='dialog'] > .atributos__cartao`.

## Os degraus de tela

| Consulta | Quem é | O que muda |
|---|---|---|
| `max-height: 52rem` | notebook comum (~700px) | padding e gap menores; os 7 slots viram uma fileira só (com `auto-fit` eles quebravam em duas, e a segunda fileira custava mais altura do que a lista de peças tinha para viver) |
| `max-height: 52rem` **e** `min-width: 40rem` | notebook e celular deitado — falta altura, sobra largura | os **5 atributos viram 2 colunas** (saída 1). Desceu de `34rem` para `52rem` em 2026-08-14, quando entrou a Destreza: 5 linhas em 2 colunas viram 3, quase metade da altura. O `min-width` impede a mesma regra de cair no celular **em pé**, onde duas colunas espremem o nome do atributo até sobrar uma letra |
| `max-height: 52rem` **e** `max-width: 40rem` | celular em pé (iPhone SE, ~553px úteis) | sem largura para grade, vale a saída 3: os 3 botões do painel de atributos viram uma fileira só, e padding encolhe |
| `max-width: 48rem` | celular em pé | mochila empilha em uma coluna |
| `max-width: 48rem`, `max-height: 34rem` | pouco espaço em qualquer eixo | slots viram hotbar de ícones, fortificação em 2 colunas, linha de item sem fileira extra |
| `max-height: 34rem` | celular deitado | subtítulos saem (o `aria-label` fica), listas viram grade; no painel de atributos, respiro do cartão, altura dos botões de ação e respiro interno da linha cedem — mas o `−`/`+` **não** encolhe, e o texto de efeito **não** sai (ver abaixo) |

> **A ordem das três saídas não é sugestão.** Em 2026-08-14, ao entrar o quinto atributo, a
> tentação foi ir direto à saída 3 (encolher fonte e respiro) porque é a mais fácil de escrever.
> A saída 1 — grade — era a certa, e ela consertou de quebra um estouro que já existia **com
> quatro atributos**: um notebook de 700px ficava a poucos pixels de cortar os botões dentro do
> `overflow: hidden` do cartão. `semRolagem.test.ts` não pegava, porque ele confere que existe
> teto, nunca que o conteúdo cabe embaixo dele.

## "Vira largura" também vale DENTRO da linha

A saída 1 costuma ser lida como "a lista vira grade". Ela é maior que isso: vale
para qualquer bloco que esteja crescendo na vertical **enquanto sobra vazio ao
lado dele** — inclusive dentro de um item de lista.

O caso que ensinou isto (2026-08-14, painel de atributos): cada linha tinha uma
faixa de largura inteira embaixo das duas colunas só para o `Próximo: N pt`,
enquanto ao lado do `−`/`+` sobravam 112×39px vazios. A faixa custava ~19px por
linha, **cinco vezes**. Subindo o custo para a coluna do stepper, a linha caiu de
68px para 59px sem esconder nada — e ficou mais legível, porque o preço do `+`
passou a morar embaixo do `+`.

Vale procurar por isso antes de recorrer à saída 3: **encolher fonte é o que se
faz quando não há mais vazio para ocupar**, não a primeira tentativa.

> **Armadilha de grid que custou uma medição.** `grid-row: 1 / -1` **não**
> funciona quando o container não declara `grid-template-rows`: índice negativo
> conta a partir do fim do grid *explícito*, e sem faixas explícitas o `-1`
> resolve para a própria linha 1. O item ocupa uma faixa só, a regra não faz
> nada, e **não há erro no console** — a medição some sem explicação. Use
> `grid-row: 1 / span 2`. (No eixo das colunas o `1 / -1` funciona justamente
> porque `grid-template-columns` existe.)

## O que a regra NÃO autoriza a tirar

O degrau de `34rem` permite tirar subtítulo. Ele não autoriza tirar **o dado que
responde à pergunta que a tela existe para responder**. No painel de atributos o
texto de efeito ("Dano de arco e adaga") parece subtítulo e não é: é o que
responde "para que serve Destreza?", na única tela onde essa decisão acontece —
Princípio nº 1. Ele fica, e o pixel sai da moldura.

Pela mesma razão o `−`/`+` mantém 1,75rem mesmo no degrau mais apertado:
encolher o alvo de toque de um botão que se aperta muitas vezes seguidas é o
pior lugar do painel para economizar altura. Os botões de ação, que são largos e
se apertam uma vez, cedem altura no lugar dele.

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

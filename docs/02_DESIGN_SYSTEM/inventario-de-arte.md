# Inventário de arte — Autohunt Idle

> O que existe em `public/arte/`, de onde veio, quem consome e o que ainda falta.
> Entregue pelo Claude Design em **2026-08-12**, fechando a dívida D3 do backlog.

O índice em código é `src/game/atlas.ts` — **nenhum caminho de arte é montado
fora dele**, e `src/game/atlas.test.ts` confere arquivo por arquivo contra o
disco. Se um PNG for renomeado, o build reprova.

## Origem

Duas rodadas de brief, ambas nesta pasta:

1. `brief-arte-claude-design.md` — o pedido original (pixel art, universo doce,
   9 levas).
2. `brief-arte-correcao.md` — a rodada 2, que pediu **padronização em escala 8**,
   cenário de verdade nos biomas (não textura), e as telas de interface.

O pacote entregue é `export-escala8/`, ou seja, a **pendência 2 da rodada 2 foi
atendida**: tudo divide a mesma grade de pixel. Cada pixel do desenho é um bloco
8×8 no arquivo, e é isso que `ESCALA_EXPORTACAO` em `sprites.ts` representa.

## O que entrou (230 arquivos, ~250 KB)

| Pasta | Peças | Quem consome |
|---|---|---|
| `personagem/` | 3 poses (parado, atacando, comemorando) | `sprites.ts` → `desenharHeroi` |
| `inimigos/` | 5 do pool base + 5 silhuetas de dano (`-sil`) | `desenharInimigo` |
| `biomas/` | 8 cenários (`sc-`), 8 props (`prop-`), 8 inimigos assinatura (`en-`) | `desenharCenario`, `desenharProps` |
| `itens/` | 158 ícones: 6 famílias de arma × 10 tiers, 6 de secundário, 3 de acessório, 8 de conjunto | `IconeItem` |
| `slots/` | 9 ícones de slot vazio + o diamante | `IconeSlotVazio` |
| `skins/` | 8 skins, da base à cósmica | herói e `IconeItem` (tipo `skin`) |
| `dungeon/` | portal, 3 inimigos de dungeon, 4 chaves | chaves em `IconeItem`; o resto é reserva (ver D13) |
| `npcs/` | 3 NPCs (ferreiro, vendedor, guia) | **reserva** — não há tela de NPC ainda |
| `marca/` | 4 tamanhos de ícone + 2 wordmarks | `index.html`, `TelaCarregando` |

## O que foi descartado, e por quê

O pacote trazia **73 arquivos redundantes** em 23 grupos de duplicata byte a
byte. A leva 3 era quase toda cópia da leva 4:

- `bag-0` … `bag-31` — os 16 últimos são o **mesmo arquivo**, e os 16 primeiros
  repetem ícones de item da leva 4.
- `rnA-0` … `rnA-7` — idem.
- `mkt-m1` … `mkt-m6` e `dia-m1` … `dia-m6` — os seis de cada grupo são
  idênticos entre si. Sobreviveu **um** diamante, renomeado para `ic-diamante`.
- `inv-char` — cópia de `pose-idle`.
- `ly-*` e `rc-*` (camadas e recolores avulsos) — sem consumidor no motor.
- `wordmark.png` — cópia de `wordmark-light.png`.

Manter duplicata seria pagar peso de download e, pior, criar dois caminhos para
a mesma imagem — e um deles envelheceria.

## Como a raridade entra no ícone

Os arquivos de item terminam em `-0` … `-9`, que são os **10 tiers** de
`regrasLoot.ts` (`-0` = comum, `-9` = cósmico). O atlas converte raridade 1–10
no sufixo 0–9, satura fora da faixa, e a cor da moldura vem de
`--raridade-<nome>` em `tokens.css`.

A **família** do desenho (espada × adaga × arco…) sai de um hash estável do id
do item, e o **canal de dano** escolhe o conjunto de famílias: físico usa espada
e martelo, destreza usa arco e adaga, mágico usa cajado e varinha. É o que faz o
ícone denunciar o canal antes de qualquer tooltip.

> Eram dois canais até 2026-08-14 (mágico com duas famílias, físico com quatro).
> O **pacote de arte não mudou**: os 60 PNGs `w-*` já cobriam as seis famílias e
> continuam os mesmos — só o agrupamento canal→família mudou. A ordem das listas
> em `src/game/armas.ts` é **carga, não estética**: ela foi escolhida para que
> toda arma já concedida continue com exatamente o mesmo desenho (a conta e a
> medição estão em `docs/08_DECISOES/adr-005-canais-de-dano-e-destreza.md`).

## O que a arte NÃO cobre (dívidas registradas)

- **As telas de interface** (pendência 1 da rodada 2) **não vieram** — nem a de
  "bem-vindo de volta", nem inventário, nem mercado. Só ícones soltos. As telas
  seguem sendo React puro, o que não bloqueia nada, mas o momento mais
  importante do produto continua sem direção de arte própria.
- **Quatro dos sete slots** (capacete, armadura, luva, bota) não têm ícone por
  raridade — só o ícone de slot. Dívida **D16** do backlog.
- **As três pedras** não têm ícone nenhum; `arteDoItem` devolve `null` e a
  interface mostra o rótulo de texto que já mostrava.
- **As skins vieram numa pose só.** Até 2026-08-14 isso significava que equipar
  uma skin **desligava as três poses** do personagem base — e o dono relatou
  como bug: *"quando eu equipo a skin o boneco fica travado de animação"*. Era
  literal. Pior: `sk-base.png` é **byte a byte idêntico** a `pose-idle.png`
  (1928 bytes), e serve as raridades 1–2 — então a primeira skin que o jogador
  equipava não mudava nada visualmente, só desligava as poses. As 8 skins são
  160×184, como as 3 poses.
  **A dívida mudou de forma, não foi fechada.** O movimento do herói passou a
  ser **procedural** (`deslocamentoDoHeroi`, em `src/game/sprites.ts`): balanço
  de caminhada, avanço no golpe e pulinho na comemoração, por transformação de
  canvas sobre o mesmo sprite. Custo zero, funciona com e sem skin, e a função
  **não recebe a raridade da skin** — é assim que "skin nunca tem stat"
  continua sendo estrutural em vez de combinado.
  O que segue em aberto é outra coisa: **a skin não tem variação de silhueta por
  ação**. Isso é arte dedicada (16 PNGs novos), é trabalho pago, e por
  `CLAUDE.md` fica adiado até haver receita. É upgrade, não pré-requisito — não
  encomende arte por causa deste parágrafo sem falar com o dono.
- **O wordmark** usa a espada como o "I" de IDLE. A pendência 4 da rodada 2
  (espada cobrindo o "T" de AUTOHUNT) foi corrigida; o "I" é leitura de design,
  não bug — mas some no ícone de 16px, onde só o `ic-*` é usado.

## Ligações

- `src/game/atlas.ts` — o índice, com a regra de cada mapeamento
- `src/game/atlas.test.ts` — a verificação contra o disco
- `README.md` (nesta pasta) — a paleta
- `docs/09_BACKLOG/README.md` — D3 (fechada), D16 (aberta, mas **não é mais "só arte"**)
- `src/game/sprites.ts` — `deslocamentoDoHeroi`, o movimento que substituiu as poses da skin

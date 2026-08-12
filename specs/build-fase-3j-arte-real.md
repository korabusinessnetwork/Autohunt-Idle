# Build — Fase 3, rodada J: a arte real entra no jogo

> Fecha a dívida **D3** do backlog: *"Arte é placeholder. O brief foi ao Claude
> Design e os assets não voltaram."* Voltaram em **2026-08-12**.

## Contexto

O jogo desenhava silhuetas geométricas na paleta oficial. A camada de sprite já
estava isolada em `src/game/sprites.ts` exatamente para esta troca — e a aposta
se pagou: **`mundo.ts` e `motor.ts` não mudaram por causa da arte** (`mundo.ts`
só ganhou os temporizadores de pose, que são estado de desenho).

O pacote entregue é `export-escala8/`, 302 PNGs em 9 levas.

## Decisão que precede tudo: a paleta muda

A arte veio na **paleta endurecida** (`#C93A6E`, `#2E2733`, `#F0E6D8`…), não na
"chiclete" pastel clara que `tokens.css` tinha. Não é escolha desta rodada: é
instrução do dono na rodada 2 do brief — *"mantenha o clima escuro que já está
funcionando; não volte pro pastel claro"*.

Não existe leitura em que pixel art escura sobre painel creme funcione, então a
interface acompanha. Os 24 tokens de bioma foram **amostrados dos próprios
PNGs** (decodificando os arquivos), não estimados — é o que garante que canvas e
interface sejam a mesma paleta.

## Critérios

1. **Os assets vivem no repositório**, curados: nenhuma das 73 duplicatas byte a
   byte que vieram no pacote entra. → `public/arte/`, 230 arquivos.
2. **Nenhum caminho de arte é montado fora do atlas.** Um `src` solto num
   componente é um arquivo que ninguém percebe que sumiu. → `src/game/atlas.ts`.
3. **Um teste confere cada caminho contra o disco**, exaustivamente sobre tipo ×
   raridade × tipo de dano — não por amostragem. → `atlas.test.ts`.
4. **Arte nunca é pré-requisito para jogar.** O carregador é assíncrono e devolve
   `null` enquanto a imagem não está pronta; quem desenha cai na silhueta
   geométrica. O jogo abre com a rede fora do ar. *(Princípio nº1.)*
5. **As silhuetas geométricas continuam no código** e não são código morto — são
   o fallback do critério 4.
6. O herói usa as **3 poses** (parado, atacando, comemorando), escolhidas pela
   ação e não pelo relógio, e espelha por direção sem um segundo desenho.
7. A **skin equipada troca o sprite do herói**, escolhida pela raridade — o banco
   não guarda qual skin é.
8. Cada bioma desenha **cenário + props**, e a densidade de prop cresce com o
   bloco (a terceira alavanca da escalada visual, que antes era saturação).
9. Os **ícones de item** aparecem na mochila, no equipamento e na trilha do
   passe, com a moldura da raridade.
10. A **marca** aparece: favicon, ícone de toque e wordmark na tela de
    carregamento — que era a única superfície onde o produto não se apresentava.
11. **O orçamento de portal continua verde** (`verificar-orcamento.mjs`).
12. **A paleta continua tendo fonte única**, agora verificada: token ausente,
    `var()` órfão, hex solto e `theme-color` divergente reprovam o build.

## Fora de escopo, e por quê

- **As telas de interface da leva 3** (bem-vindo de volta, inventário, mercado)
  **não foram entregues** — o pacote trouxe só ícones soltos. As telas seguem
  React puro. Registrado no inventário de arte.
- **Dungeon com cena** continua sendo D13: a arte de portal e boss entrou no
  repositório como reserva, mas não há tela para tematizar.
- **Balanceamento** segue sendo D4. Esta rodada não move número de jogo.

## Dívida que a rodada abre

**D16** — quatro dos sete slots (capacete, armadura, luva, bota) não têm ícone
por raridade no pacote; usam o ícone de slot, sem escalada visual. E as skins
vieram numa pose só, então equipar uma skin desliga as três poses.

## Arquivos

| Arquivo | O quê |
|---|---|
| `public/arte/**` | novo — 230 assets curados |
| `src/game/atlas.ts` | novo — o índice e o carregador |
| `src/game/atlas.test.ts` | novo — 21 verificações |
| `src/styles/tokens.test.ts` | novo — 5 verificações de paleta |
| `src/components/shared/IconeItem.tsx` `.css` | novo — ícone de item e de slot vazio |
| `src/styles/tokens.css` | paleta endurecida + 10 tokens de raridade |
| `src/game/sprites.ts` | desenha PNG, silhueta como fallback |
| `src/game/mundo.ts` | temporizadores de pose |
| `src/game/renderizador.ts` | pose, skin e pré-carga por bioma |
| `src/game/paleta.ts` | token `--cor-contorno` |
| `src/hooks/useMotorDeJogo.ts` | passa a skin equipada |
| `src/features/mochila/*`, `src/features/passe/*` | ícones; raridade vira token |
| `src/components/shared/EstadoTela.tsx` `.css` | wordmark no carregamento |
| `index.html` | favicon, apple-touch-icon, theme-color |

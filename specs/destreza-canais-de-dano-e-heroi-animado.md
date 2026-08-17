# Spec: Destreza, três canais de dano, e o herói que se mexe

*(emenda `specs/build-fase-3c-equipamento.md` §8–9 e `specs/equipamento-e-poder.md` §9, §12, §17;
decisão em `docs/08_DECISOES/adr-005-canais-de-dano-e-destreza.md`)*

## 1. Escopo

Três pedidos do dono, na mesma conversa. Os dois primeiros são o mesmo sistema visto de dois lados;
o terceiro é independente e entrou junto por ser defeito visível na tela principal.

1. *"o sistema de atributos tem que estar vinculado com a arma que o personagem usa por exemplo, se
   ele usa cajado tem que dar dano mágico, logo se ele upar força não pode aumentar o dano"*
2. *"temos que criar o atributo destreza também"* — *"pra arqueiro"*
3. *"quando eu equipo a skin o boneco ta ficando travado de animação"*

Entra nesta rodada: o quinto atributo (**Destreza**), o terceiro canal de dano, a reclassificação
identidade-preservante do acervo de armas, dois conjuntos temáticos de destreza, o vínculo
arma→atributo visível no painel, e o movimento procedural do herói.

## 2. Fora de escopo

- **Redistribuir a `afinidade` das peças já existentes.** Afinidade é dado sorteado, não derivado —
  não há identidade a preservar, e remexer tiraria sinergia de quem não pediu nada. O sorteio de
  drop novo já é de três vias e o acervo se equilibra sozinho. É decisão do dono reabrir.
- **Arte de skin por pose** (16 PNGs). Custa dinheiro, e `CLAUDE.md` adia investimento por padrão.
  O movimento procedural resolve o sintoma relatado hoje; a arte dedicada segue como upgrade em
  `docs/02_DESIGN_SYSTEM/inventario-de-arte.md`.
- **Classe de personagem.** Continua não existindo: "arqueiro" é identidade emergente do loadout,
  como "mago" já era. Não há tela de criação de personagem, e isto não reabre essa decisão.
- **Rebalancear o bônus de sinergia.** Ele continua +20%, embora a chance de uma peça sorteada casar
  tenha caído de 1/2 para 1/3. É balanceamento, e balanceamento espera dado de jogador real (D4).

## 3. Arquivos afetados

- `supabase/migrations/20260830_destreza_e_canais_de_dano.sql` — **novo**: coluna, constraints,
  reclassificação, `poder_de_ataque`, `conceder_item`, conjuntos, `redistribuir_atributos`,
  `montar_snapshot`, `exportar_meus_dados`, `resolver_uma_dungeon`, devolução de pontos
- `src/game/armas.ts` — três listas de duas famílias; a ordem é carga (ver critério 4)
- `src/game/regrasEquipamento.ts` — `ATRIBUTO_DO_DANO`; morre o secundário/2
- `src/game/regrasAtributos.ts`, `src/lib/tipos.ts` — o quinto atributo e o terceiro canal
- `src/game/sprites.ts` — `deslocamentoDoHeroi`, a função pura do movimento
- `src/game/mundo.ts` — acumulador de fase de passo e `progressoDaPose`
- `src/game/renderizador.ts`, `src/game/atlas.ts` — a ponte até o desenho, e o pré-carregamento
- `src/features/atributos/PainelAtributos.tsx` + `.css` — quinta linha, selo da arma, grade
- `src/lib/i18n/pt.ts` + `en.ts`, `src/features/mochila/rotulos.ts` — o canal nomeado pelo atributo
- `scripts/teste-migrations.sql`, `scripts/conferir-supabase.sql` — fumaça e auditoria
- `src/dev/sandbox.ts` + `sandbox.html` — o seletor de skin, para calibrar o movimento

## 4. Critérios de aceite

1. Existem **cinco** atributos, e Destreza é um deles — na tabela, no snapshot, no export de LGPD,
   na RPC de respec e no painel.
2. Existem **três** canais de dano (`fisico`, `destreza`, `magico`), aceitos pelo `check` de
   `tipo_dano` e de `afinidade`, e o `check` bate com o `TipoDano` declarado no TypeScript.
3. **O atributo que casa com a arma conta inteiro; os outros contam zero.** Com arco na mão, Força
   e Inteligência somam exatamente o mesmo que zero — provado no servidor, não só no espelho.
4. **Toda arma já concedida mantém a família.** Uma adaga continua adaga; um arco continua arco —
   nome, ícone e jeito de atirar, que saem do mesmo hash. Provado por oráculo contra a tabela
   antiga, para centenas de ids.
5. O helper de hash em SQL e o `embaralhar` em TypeScript concordam em `% 4`, e a migration não
   reimplementa o FNV-1a de 32 bits.
6. Arma **de conjunto** não é reclassificada, e arma **sem `tipo_dano`** (sintetizada) é tratada
   como física para efeito de reclassificação — sem isso, a metade sintetizada do acervo troca de
   família em silêncio.
7. A build de arqueiro alcança tudo que as outras alcançam: canal, atributo, sinergia de afinidade
   e **degrau de seis peças de conjunto**.
8. A versão de quatro argumentos de `redistribuir_atributos` **deixa de existir**, e a de cinco é
   concedida a `authenticated`.
9. O painel de atributos **marca qual atributo casa com a arma equipada**, e não marca nenhum
   quando não há arma equipada.
10. O painel de atributos **não rola e não corta** com cinco linhas, em tela alta, em notebook
    baixo, em celular em pé e em celular deitado.
11. **O herói se mexe com skin equipada**: balanço ao andar, avanço ao golpear, pulinho ao
    comemorar — nos dois modos (auto e manual) e nos dois ramos de desenho (sprite e silhueta).
12. O movimento **não depende da raridade da skin** — estruturalmente, não por combinado: a função
    de deslocamento não recebe esse argumento.
13. `arteDoHeroi` continua apontando só para arquivos que existem no disco.

## 5. Edge cases conhecidos

- **Arma sem `tipo_dano`.** `sintetizar` insere arma sem canal, então existe uma população inteira
  com a coluna nula. `tipo_dano = 'fisico'` não casa com `NULL` — o predicado precisa de
  `coalesce`. Foi o defeito mais perigoso desta rodada, e ele não quebra nada: só troca a arma de
  metade dos jogadores, calado.
- **Herói teleportado.** `ferirHeroi` devolve o herói à entrada ao zerar a vitalidade, e
  `definirMapa` faz o mesmo ao trocar de instância. Detectar "andando" por delta de posição entre
  quadros dispararia o ciclo de caminhada na hora da morte — por isso o acumulador vive dentro de
  `mover()`.
- **Modo automático.** `definirModo` zera a intenção no auto e `definirIntencao` recusa input lá.
  Uma animação que leia a intenção passa em todo teste manual e falha em silêncio no modo que o
  jogo vende.
- **Herói colado na parede.** `mover()` roda mesmo com a posição travada pelos limites do mapa.
- **`sk-base.png` é byte a byte idêntico a `pose-idle.png`** e serve as raridades 1–2: a primeira
  skin do jogo não muda nada visualmente. Isso é produto, não bug desta rodada, e segue aberto.
- **Jogador com alocação alta em Força e arco equipado** perderia todo o rendimento de atributo sem
  aviso. Resolvido zerando a alocação de todos e devolvendo os pontos.

## 6. Definição de "aprovado sem ressalvas"

Os 13 critérios verificados; `tsc --noEmit` limpo; `npm test` verde **com os testes novos**, e não
só com os antigos (vários testes desta superfície continuam verdes tendo perdido cobertura — a
prova de que a rodada terminou é a existência do teste de preservação de identidade, dos três
canais em `regrasEquipamento.test.ts` e das asserções de espelho sobre `poder_de_ataque`);
`./scripts/pg-local.sh` aplicando as migrations contra um Postgres de verdade e passando a fumaça,
incluindo o bloco `== canal de dano ==`; o painel de atributos medido sem estouro em quatro
tamanhos de tela; e o herói observado se mexendo com skin equipada.

---

# Resultado da review — 2026-08-14

`npm test`: **364 passando** (329 → 364), 26 arquivos. `npm run build`: **verde**, orçamento em
0,53 MB de 8 MB, 233 arquivos.

## Critério 10 — o painel medido nas quatro telas

Estava **reprovado** e foi consertado nesta review. Medida no navegador, com o painel aberto:

| Tela | Quem é | Conteúdo | Teto do cartão | Folga | Botões |
|---|---|---|---|---|---|
| 1200×900 | monitor alto | 812 | 868 | +56 | inteiros |
| 1200×700 | notebook comum | 384 | 668 | +284 | inteiros |
| 375×553 | iPhone SE em pé | 491 | 521 | +30 | inteiros |
| 812×375 | celular deitado | 320 | 343 | +23 | inteiros |

Antes: **563 de conteúdo em 521 de cartão** a 375×553, e **396 em 343** a 812×375 — com
`overflow: hidden` num `aria-modal`, o que ficava cortado eram Salvar / Zerar / Fechar. O
comentário do CSS afirmava que pôr os três botões numa fileira só "devolve mais altura do que a
quinta linha custa"; a medição desmentiu (devolve 43px, faltavam 42 **depois** disso).

Os pixels saíram de: (a) o `Próximo: N pt` deixando a faixa de largura inteira e subindo para a
coluna do stepper — saída 1 aplicada dentro da linha, 68px → 59px por linha; (b) respiro do cartão,
altura dos botões de ação e respiro interno da linha. Nada foi escondido: os cinco atributos, com
nome, selo, efeito, valor e custo, continuam na tela ao mesmo tempo nas quatro telas.

## Dois defeitos encontrados no caminho

1. **`sandbox.html` não tinha o botão de skin.** `sandbox.ts` faz
   `querySelector('#skin')!` — o `!` era mentira, o script morria no
   `addEventListener` e o sandbox INTEIRO ficava morto (placar parado em "…"). A ironia: a
   ferramenta existe justamente para reproduzir "equipei a skin e o boneco travou". O `<style>` do
   arquivo já tinha sido escrito para dois botões ("o segundo controle empurrava o primeiro"); só a
   marcação ficou para trás. Corrigido.
2. **`global.css` é o ÚLTIMO a entrar, não o primeiro.** O comentário dele e
   `menus-sem-rolagem.md` afirmavam o contrário. `main.tsx` importa `./App` (linha 4) antes de
   `./styles/global.css` (linha 6). Medido em dev (folha 5 × folha 24) e no bundle de produção
   (byte 7.721 × 47.900). Consequência: abaixo de `34rem`, regra de classe simples num painel
   **falha em silêncio** contra o bloco "modo apertado". Os dois textos foram corrigidos, e o
   painel de atributos passou a usar 0,3,0 onde disputa.

## Ressalvas — o que esta review NÃO provou

- **Critério 11 não foi confirmado com os olhos.** O motor roda em `requestAnimationFrame`, e a
  aba de preview desta sessão está `visibilityState: "hidden"` — medido: **0 quadros em 1s**. Com o
  motor parado, "o boneco não se mexe" ali não distingue defeito de ambiente, então nada foi
  concluído a partir daquilo. O que sustenta o critério hoje é execução de teste
  (`mundo.test.ts:455-547` para a fase de passo, `sprites.test.ts` para o deslocamento) e a
  estrutura: `deslocamentoDoHeroi` é calculado em `sprites.ts:537`, **antes** do desvio, e os dois
  ramos recebem o offset — `ctx.translate(dx, dy)` no ramo de sprite (553) e `x + dx, y + dy` no de
  silhueta (560). **Falta um par de olhos humanos no sandbox**, que agora abre.
- **A migration foi aplicada no Supabase de produção pelo dono em 2026-08-17.** Registro por
  declaração do dono, **não por verificação minha**: o app estava deslogado nesta sessão, então não
  houve snapshot do servidor para conferir se `montar_snapshot` já devolve `destreza`, e criar conta
  não é coisa que eu faça. Quem quiser a confirmação objetiva roda
  `scripts/conferir-supabase.sql` no SQL editor — as 8 checagens dizem sozinhas se o schema bate.
- **A migration não foi exercitada contra o Postgres local** (`./scripts/pg-local.sh` precisa do
  Docker Desktop, que não estava de pé nesta máquina). Isso importa mesmo com ela já em produção,
  porque é o passo que roda o bloco de fumaça `== canal de dano ==` — o que prova que Força e
  Inteligência somam **zero** com arco na mão. Em produção a migration aplicou; a *regra* que ela
  carrega segue provada só pelo espelho em TypeScript.
- `semRolagem.test.ts` continua conferindo só que existe teto, nunca que o conteúdo cabe embaixo
  dele — foi por isso que os dois estouros chegaram até aqui com a suíte verde.

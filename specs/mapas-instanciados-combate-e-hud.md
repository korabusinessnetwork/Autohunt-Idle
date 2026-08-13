# Mapas instanciados, combate de verdade e HUD de uma tela só

> Spec de rodada. Nasce de sete pedidos do dono, em 2026-08-13.
>
> Amenda `specs/mundo-aberto-e-modo-manual.md` e `specs/mapa-mundo-e-dungeon.md`.

## 0. A regra que nada aqui pode quebrar

Continua valendo, sem exceção: **nada do que acontece na tela credita**. Dano,
morte, mapa escolhido, arma equipada e HUD são simulação visual. O servidor
segue creditando por tempo decorrido × poder, e nenhum campo novo desta spec é
enviado a ele. As migrations não ganham a palavra "mapa" nem "bioma", e os
módulos `regras*.ts` continuam proibidos de importar cenário.

A única coisa que atravessa a fronteira é de **leitura**: o nível do jogador
(que vem do servidor) decide qual mapa está liberado.

## 1. Monstro dá dano (defeito)

Hoje o inimigo encosta no herói e nada acontece — o mundo tinha colisão só na
direção herói → inimigo.

- Toda espécie ganha `dano` e `recargaAtaque`.
- O inimigo ataca quando o herói entra no alcance de corpo dele (`raio + 10`).
- O herói tem **vitalidade visual** (`heroiVida` / `heroiVidaMaxima`), com
  `heroiVidaMaxima` copiada da `vitalidadeMaxima` que o servidor publica — para
  a barra da HUD ter a escala do servidor, mesmo sendo a simulação local que a
  move.
- Levar dano dá 0,8s de invulnerabilidade e pisca o herói. Sem i-frames, dois
  inimigos colados drenam a barra em meio segundo.
- Zerar a vitalidade **não** é tela de morte (core, 16): o herói pisca, volta ao
  ponto de entrada do mapa com a barra cheia e continua. Nada é retirado.
- Fora de combate por 4s, a vitalidade regenera.
- Número de dano flutuante sobe do herói (vermelho) e do inimigo (creme) — é o
  que faz "está dando dano" ser visível sem ler barra.

## 2. Mapa instanciado por nível, com botão de mapa

Hoje existe um mapa único de 5120×1440 dividido em 8 regiões: o bioma sai de
onde o herói está. Passa a existir **8 mapas instanciados**, um por bioma.

- `NIVEIS_POR_MAPA = 10`, `TOTAL_MAPAS = 8` → o mapa 8 abre no nível 71 e a
  primeira leva cobre **até o nível 80**.
- Nível infinito continua existindo: acima de 80 o jogador fica no mapa 8 até a
  próxima leva de mapas. Isso é conteúdo, não teto.
- Cada mapa é um retângulo próprio (1920×1080), com o tema do seu bioma.
- Botão **Mapa** na tela do jogo abre o painel com os 8 destinos: nome, nível
  exigido, cadeado e o mapa corrente destacado. Viajar troca a instância.
- Mapa bloqueado mostra o nível que falta — prevenção de erro, não mensagem de
  erro.
- Trocar de mapa recria a população e leva o herói ao ponto de entrada.

`biomas.ts` deixa de conhecer geometria e vira catálogo de tema. A geometria e o
destravamento passam para `mapas.ts`.

## 3. Ambientação de arena (cara de Slither.io)

O chão procedural atual é uma malha de bolinhas chapada. Passa a ter:

- gradiente radial de fundo, mais claro no centro do mapa;
- malha hexagonal fina na cor de detalhe do bioma (a assinatura visual do
  gênero);
- **migalhas** — pontos luminosos espalhados de forma determinística, que dão
  escala e movimento ao andar;
- **borda do mapa** desenhada e brilhante: fim do mundo visível, como na arena
  do Slither;
- vinheta escurecendo os cantos.

Tudo procedural, sem asset novo — o orçamento de portal não muda.

## 4. Monstro fica no mapa; o herói é quem procura

Hoje todo inimigo persegue o herói para sempre e nasce ao redor dele.

- Cada mapa tem **ninhos** (posições determinísticas por id de mapa). O inimigo
  nasce no ninho, não ao redor do jogador.
- Fora de agressão o inimigo **vagueia em volta do ninho**, e nunca sai dele.
- O herói entrando no raio de agressão (150px) faz o inimigo avançar e atacar.
- Saindo, o inimigo **volta para o ninho**. Não existe trem de monstros atrás do
  herói atravessando o mapa.
- O ninho repovoa com atraso quando o herói limpa a área.

## 5. HUD responsiva, tudo em uma tela

- A página inteira é o jogo: `100dvh`, sem rolagem, canvas em tela cheia.
- Fim da moldura preta 16:9. O canvas mostra **mais mundo** em tela larga em vez
  de barras — a escala nasce de um mínimo garantido de 640×360 unidades.
- HUD sobreposta ao canvas, em cantos: nível/XP/vitalidade à esquerda,
  ouro/diamante/conta à direita, ações embaixo.
- Tudo dimensionado em `clamp()`, então cabe no celular sem quebrar linha.

## 6. Botões dentro da tela do jogo

Nenhum painel fica escondido: uma barra de **ícones** sobre o canvas — mapa,
mochila, equipamento, atributos, loja, passe, ranking, configurações — com selo
de contagem (pontos livres, chaves). Ícones em SVG inline, sem asset novo.

## 7. Botão de login

Faltava a porta de volta: quem cadastrou e abriu o jogo em outro navegador não
tinha como entrar na própria conta.

- `entrar(email, senha)` no `authService`.
- Botão de conta na HUD: **Entrar** para quem é convidado, apelido/e-mail para
  quem tem cadastro.
- O painel de login diz, antes do clique, que entrar em outra conta abandona o
  progresso do convidado atual. Prevenção de erro.

## 8. Arma decide o ataque

Hoje toda arma dispara a mesma bolinha. A família da arma já era escolhida por
hash do id (para o ícone); agora ela **também** decide o combate — mesma função,
então ícone e comportamento nunca divergem.

| Família  | Tipo   | Alcance | Comportamento                          |
| -------- | ------ | ------- | -------------------------------------- |
| martelo  | corpo  | baixo   | arco largo, lento, dano alto           |
| adaga    | corpo  | baixo   | arco estreito, muito rápido, dano baixo|
| espada   | corpo  | médio   | arco médio, ritmo médio                |
| arco     | à dist.| longo   | **flecha**, viaja e some no fim        |
| cajado   | à dist.| longo   | orbe mágico, lento e forte             |
| varinha  | à dist.| médio   | orbe rápido e fraco                    |
| (sem arma)| corpo | mínimo  | soco                                   |

Nenhuma arma tem alcance infinito: o projétil morre por **distância percorrida**,
não por tempo, então o alcance da tabela é o alcance real na tela.

Os ajustes do console continuam mandando: cada perfil é multiplicador sobre
`heroi_alcance_tiro`, `heroi_recarga_tiro` e `heroi_dano_projetil`.

## 9. Critérios de aceite

1. Encostar num inimigo tira vitalidade do herói, com número visível.
2. Zerar a vitalidade não abre tela nenhuma: o herói volta ao ponto de entrada.
3. Inimigo longe do herói não se move na direção dele.
4. Inimigo que perde o herói de vista volta para perto do ninho.
5. O painel de mapa lista 8 mapas; o de nível maior que o do jogador está
   bloqueado e diz qual nível falta.
6. O mapa 8 exige nível 71; nível 80 continua nele, e nível 999 também.
7. Em qualquer tela de 320px a 2560px de largura, o jogo cabe sem rolagem.
8. Todos os painéis são acessíveis por ícone sobre o canvas.
9. Existe botão de login, e ele autentica com e-mail e senha.
10. Espada/martelo/adaga não criam projétil nenhum; arco cria flecha; cajado e
    varinha criam orbe que some numa distância finita.
11. Nenhuma migration menciona mapa; nenhum `regras*.ts` importa `mapas.ts`.

---

# Adendo — segunda leva de ajustes (2026-08-13)

Dois pedidos que chegaram depois de a rodada acima estar de pé.

## 10. Mochila e equipamento viram um lugar só

O ícone de equipamento **sai da barra**. Abrir a mochila passa a mostrar o que
está vestido e permite equipar dali.

A divisão anterior era do construtor, não do jogador: "mochila" listava o que
você tem, "equipamento" vestia. Quem joga abre a mochila para vestir o que
caiu — e com dois ícones lado a lado, escolher errado era o caso comum, não a
exceção.

- `PainelMochila` vira a casca: título, poder de ataque, duas abas e rodapé.
- Aba **Equipamento** (padrão, porque é o que se vem fazer): slots, fortificação
  e a lista do slot aberto — o antigo `PainelEquipamento`, agora
  `AbaEquipamento`, sem diálogo próprio.
- Aba **Itens**: chaves, dungeon e síntese.
- No rodapé, **Ver atributos**. Fechar os atributos volta para a mochila quando
  foi de lá que eles foram abertos — quem estava trocando de arma não pode ser
  jogado no mundo aberto para refazer o caminho.

O ícone da barra continua com o selo de chaves, e a aba de itens repete o selo:
quem tem chave precisa ver isso sem abrir nada.

## 11. Escala: o herói encolhe, o mundo cresce

O personagem ocupava tela demais e a arena virava fundo atrás dele. Corrigido
pelos dois lados, porque mexer só no sprite do herói o deixaria menor que o
bicho que ele caça:

| O quê | Antes | Depois | Efeito |
| --- | --- | --- | --- |
| Viewport mínima | 640×360 | 800×450 | tudo desenha 20% menor; vê-se 25% mais mundo em cada eixo |
| Altura do herói | 48 | 42 | com a viewport, ~30% menor na tela |
| Escala dos props | 3 | 4 | cenário maior no mundo |
| Malha do fundo | lado 26 | lado 32 | mantém a leitura depois do afastamento |
| Passo das migalhas | 84 | 105 | idem — migalha é referência de movimento, não poeira |

A margem do herói para o inimigo médio (~37px) foi preservada de propósito:
abaixo de ~40px ele deixa de ler como protagonista.

## Critérios de aceite do adendo

12. Não existe ícone de equipamento na barra; abrir a mochila mostra os slots
    equipados e permite equipar sem sair dela.
13. A mochila tem um botão de atributos, e fechar os atributos abertos por ele
    devolve o jogador à mochila.
14. O herói ocupa menos tela que antes, e o cenário mais — sem que o herói fique
    menor que o inimigo médio.

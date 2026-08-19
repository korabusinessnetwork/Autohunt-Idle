# Spec: A fábrica morta — biomas 9 a 16, chão desenhado e bicho que se mexe

*(emenda `specs/mapas-instanciados-combate-e-hud.md` §2 e `specs/mundo-aberto-e-modo-manual.md` §9;
o inventário de arte fica em `docs/02_DESIGN_SYSTEM/inventario-de-arte.md`)*

## 1. Escopo

Seis pacotes de arte entregues pelo dono em sequência, na mesma conversa. Os cinco primeiros vieram
com uma instrução de uma linha cada; o sexto foi o único com brief escrito, e por um motivo: até
ele não havia referência a apontar.

1. `Bioma 09_ Fábrica de Refrigerante.zip` — apesar do nome, traz **oito biomas** (09–16): os
   artboards, mais 24 PNGs (cenário, prop e inimigo assinatura de cada um).
2. `tiles.zip` — 32 ladrilhos de chão, 64×64, quatro variantes por bioma novo.
3. `animação de inimigos.zip` — 8 folhas de repouso, 4 quadros de 160×184.
4. `props.zip` — as mesmas 8 folhas de repouso (byte a byte) e mais 8 de prop animado.
5. `more features.zip` — de novo o que já entrou, mais **dano** (2 quadros), **morte** (4 quadros)
   e **cena animada** (4 quadros de 608×352) para cada um dos oito.
6. `o_que_faltava.zip` — **82 arquivos** que trazem os oito biomas doces (01–08) ao mesmo padrão:
   32 ladrilhos e 40 folhas, mais o item opcional do brief — repouso e morte para os **cinco do
   pool base**, que aparecem nos dezesseis mapas.

O arco começou como o contraponto industrial do universo doce: a mesma fábrica que produzia o mundo
dos oito primeiros biomas, abandonada. Doce que apodreceu, não um tema novo colado ao lado.

E terminou noutro lugar. Os cinco primeiros pacotes criaram uma **assimetria** — metade do mundo com
chão desenhado e bicho que se mexe, metade em malha procedural e PNG parado — que este documento
registrou como fora de escopo e deliberada. O sexto pacote a desfez. **A spec cobre os dezesseis**,
e o nome do arquivo guarda só onde ela começou.

### O brief, e o que ele obrigou a escrever

Pedir paridade exigiu dizer em voz alta uma coisa que o projeto nunca tinha escrito: **a câmera é a
de Realm of the Mad God**. Chão visto de cima, 90°, sem perspectiva nem ponto de fuga — ladrilho é
quadrado visto do alto, e não losango isométrico. Atores vistos de frente, de pé sobre esse chão.
Câmera centrada no herói, zoom fixo, sem rotação.

Os oito industriais acertaram isso sem que ninguém tivesse pedido, porque o artista viu a referência
nos arquivos que já existiam. Escrever a regra foi o que permitiu pedir a paridade sem torcer para
que ela se repetisse — e é por isso que ela está aqui e não só no brief.

## 2. A terceira inversão de premissa

`src/game/biomas.ts` registra duas inversões anteriores. Esta é a terceira, e está anotada lá:

> **2026-08-19** — o catálogo saiu de **8 para 16 biomas**, e a premissa que caiu foi a de que o
> jogo tem *um* universo visual.

O que **não** mudou, e é o que mantém o resto do sistema de pé: **bioma continua sendo só cenário**.
Nenhum dos dezesseis entra em cálculo de recompensa, nenhum é enviado ao servidor, e os testes que
guardam essa fronteira (`espelhoDeRegra.test.ts`, `nenhuma migration declara bioma nem mapa`,
`o mapa escolhido não vai para o servidor`) valem para os novos exatamente como valiam para os oito.

Os números dos assinatura novos **não inflam por serem tardios**. `escalaDoMapa` já multiplica com o
mapa; inflar a base outra vez seria aplicar a progressão duas vezes. Eles seguem o mesmo contrato de
sempre — grande e lento bate forte, pequeno e rápido bate fraco.

## 3. Fora de escopo

- **Usar a cena animada dentro do mundo.** Ela traz chão, props e inimigos já compostos, que é
  exatamente o que o motor desenha ao vivo. Ver §6.
- **Rebalancear a curva de mapa.** `escalaDoMapa` no mapa 16 dá 6,25× contra 3,45× no 8. É salto
  grande, é só cenário, e mexer nele é decisão do dono com dado de jogador real na mão.
- **Pré-carregar as cenas animadas.** Elas são 431 KB — quase o dobro das outras quatro famílias
  somadas — e só aparecem no painel de mapa. Aquecê-las junto com a zona pagaria o arquivo mais caro
  do pacote pelo uso mais raro dele. O degradê do CSS cobre a espera.
- **Desenhar folha de dano para o pool base.** Ver §11.

> **Saiu daqui no sexto pacote.** "Dar folha de animação à leva doce" e "arte de chão para os oito
> doces" eram itens desta lista, com a justificativa de que animação é melhoria e nunca
> pré-requisito (regra 2 de `atlas.ts`). A regra continua valendo — o que mudou foi que a melhoria
> chegou. Ficam registrados aqui porque a assimetria era deliberada enquanto durou, e não um
> esquecimento que alguém consertou.

## 4. Arquivos afetados

- `src/game/biomas.ts` — 16 entradas, 8 formas assinatura novas, a terceira inversão anotada
- `src/styles/tokens.css` — 24 tokens novos; quatro cores inéditas na paleta
- `src/game/paleta.ts` — deixou de contar 8 na mão e passou a ler `TOTAL_BIOMAS`
- `src/game/atlas.ts` — apelidos, folhas, ladrilhos, cena; um mapa de apelido para as três folhas
- `src/game/sprites.ts` — 8 silhuetas geométricas novas, `desenharPiso`, `desenharMorte`, recorte
  de folha, e as duas contas puras de quadro
- `src/game/mundo.ts` — `Morte`, `DURACAO_LAMPEJO`, `DURACAO_MORTE`
- `src/game/renderizador.ts` — desenha os abatidos
- `src/features/mapa/PainelMapa.tsx` + `.css` — a miniatura virou o lugar
- `src/lib/i18n/pt.ts` + `en.ts` — 16 chaves novas em cada
- `src/dev/sandbox.ts`, `sandbox.html` — ciclador dos 16 mapas

No sexto pacote, a paridade mexeu em quatro deles outra vez:

- `src/game/atlas.ts` — o apelido virou **derivado** do nome do PNG parado, e sumiram
  `biomaTemLadrilho` e a tabela de apelidos da fábrica: sem leva parada, não há mais o que
  perguntar. `arteDoLadrilho`, `ladrilhosDoBioma`, `arteDaAnimacaoDoProp` e `arteDaCenaAnimada`
  deixaram de poder devolver `null`.
- `src/game/sprites.ts` — `desenharPiso` passou a devolver `boolean`, e é esse `false` que chama a
  malha (§5). O caminho de lampejo ganhou o comentário do porquê o pool cai na silhueta gerada
  (§11).
- `src/features/mapa/PainelMapa.tsx` + `.css` — a classe `--viva` sumiu; a animação desceu para a
  regra base (§8).
- `public/arte/biomas/`, `public/arte/inimigos/` — 82 arquivos, e o inventário atualizado em
  `docs/02_DESIGN_SYSTEM/inventario-de-arte.md`.

## 5. O chão desenhado

Os dezesseis têm ladrilho. `desenharCenario` desenha **um dos dois**, nunca os dois: a malha
hexagonal existe para dar referência de movimento num fundo chapado, e um piso de verdade já faz
isso melhor. Sobrepor deixaria um risco de papel milimetrado por cima da chapa rebitada — o efeito
exato que a malha existe para evitar.

**A malha virou o estado de carregamento.** Enquanto metade dos biomas não tinha chão, ela era o
caminho permanente deles e `desenharCenario` perguntava `biomaTemLadrilho(bioma)`. Com todos
ladrilhados essa pergunta some, e a malha passa a ser o que o comentário dela sempre disse que era:
o fundo que segura a tela **enquanto** o PNG do chão não decodifica — primeiro quadro de mapa novo,
aba que voltou do cache frio, portal lento. `desenharPiso` devolve `boolean`, e o `false` é o que
chama a malha; sem ela, esse intervalo seria uma cor chapada onde andar não parece andar.

Três decisões de desenho, todas tomadas contra a tela e não no papel:

**Lado 48, e não os 64 do arquivo.** A 64 a chapa saiu maior que o herói de 42px e o chão leu como
tabuleiro. A 48 uma chapa mede aproximadamente um ator, que é a proporção da própria arte de cenário
do pacote. E 48 continua limpo na grade: o arquivo tem 8×8 pixels de desenho, então cada um vira 6
de mundo, inteiro. Descer a 32 foi longe demais — trocava tabuleiro por azulejo de banheiro.

**Junta amarrada.** As fiadas ímpares andam meia chapa, como piso de chapa é assentado de verdade.
É o que resolve o defeito que nenhum tamanho resolvia sozinho: com as juntas alinhadas as linhas
verticais atravessam a tela inteira e o olho trava na grade. Quebrada a junta, sobra a linha
horizontal, que é referência de chão, e some a coluna, que era só grade.

**Acento raro, e mais raro quanto mais alto.** As variantes crescem em barulho — a 2 é rebite a
mais, a 4 é a caixa dourada, a grelha acesa, a poça de chocolate. Distribuídas em partes iguais, a
mais alta aparecia dezenas de vezes por tela, e um quadrado âmbar repetido no chão de um jogo de
loot **lê como item, e o jogador anda até ele**. O briefing pede isso explicitamente ("nada no
cenário parece coletável ou interativo") e o Princípio nº1 pede o mesmo em outras palavras:
prevenção de erro vale mais que mensagem de erro.

Qual variante cai em qual célula sai de **ruído determinístico**, nunca de sorteio — a mesma regra
dos props e das migalhas, e pelo mesmo motivo: chão que se redesenha diferente quando o jogador
volta destrói a sensação de lugar.

## 6. As cinco folhas, e onde cada uma vai

| Folha | Quadros | Onde entra |
|---|---|---|
| `-idle` | 4 de 160×184 | o assinatura respirando no mundo |
| `-hit` | 2 de 160×184 | o lampejo de dano — o quadro 0 é o vulto branco |
| `-die` | 4 de 160×184 | o abatido caindo |
| `-prop` | 4, medida variável | o elemento de cenário espalhado |
| `-scene` | 4 de 608×352 | **a miniatura do painel de mapa** |

As três folhas de inimigo saem do **mesmo apelido**, e desde o sexto pacote esse apelido não é mais
escrito à mão: ele é derivado do nome do PNG parado, que é a regra que o pacote inteiro segue
(`en-floresta.png` tem `anim-floresta-idle.png` ao lado). Uma tabela escrita seria uma terceira
lista das mesmas 21 chaves, e ela sairia de sincronia sem barulho nenhum — apelido errado não
quebra, ele só para de animar.

**O prop não tem medida fixa.** Os oito da fábrica são 176×176; os doces variam com o objeto —
`prop-geleia` é 144×72, `prop-vulcao` 144×56, `prop-geleira` 64×96. Poça e boca de cratera não têm
por que ser altas. O recorte é `largura / 4`, então uma folha montada na medida da fábrica
desenharia o prop deslocado em metade dos biomas; o teste confere cada quadro contra a caixa do
`prop-` parado.

**O lampejo desenhado vence o gerado.** `sprites.ts` gerava a silhueta branca pintando de branco o
que já estava opaco. O artista desenhou a dele, e ela sabe onde o contorno engorda. A gerada
continua no código como degrau de reserva, para quem não tem folha.

**A cena animada não entra no mundo.** Ela traz a composição inteira já montada — chão, props e
inimigos juntos — que é exatamente o que o motor desenha ao vivo. Usá-la no jogo desenharia tudo
duas vezes, uma delas num enquadramento que não é o da câmera. O lugar dela é onde o jogador
**escolhe** para onde ir.

E não é a tela de retorno. Bioma na tela de pagamento sugere que o bioma mexeu no pagamento — a
inferência exata que a regra "mapa é cenário" existe para impedir.

## 7. O abatido

A animação de morte introduziu a primeira lista de coisas que existem **depois de terem morrido**.
Ela é separada de `inimigos`, e não um inimigo com vida zero esperando a vez: mantido na lista, o
cadáver continuaria sendo mirado pela auto-mira, contando para a população do ninho, empurrando o
herói e podendo levar um segundo tiro.

Três regras, todas cobertas por teste:

1. **O abate continua imediato.** Loot, XP e pose de comemoração saem no mesmo quadro de sempre. A
   animação não atrasa recompensa nenhuma — ela mostra o que já aconteceu.
2. **Sumir por distância não deixa corpo.** Isso acontece fora da tela e não é vitória de ninguém;
   marcar aquilo com animação de abate creditaria ao jogador um abate que ele não fez.
3. **Trocar de mapa não leva o corpo junto.** `Morte` guarda coordenada de mundo, e mantê-la
   desenharia um abate fantasma na instância recém-aberta, num lugar onde ninguém morreu.

A duração é curta (0,34s) de propósito: abate é o que este jogo mais produz, e cadáver que demora
vira lixo acumulado na tela em vez de peso do golpe.

## 8. A miniatura do painel de mapa

Era um degradê dos tokens `--bioma-N-*`, com a justificativa de que um PNG por mapa custaria
arquivos no orçamento de portal para dizer a mesma coisa. Duas coisas mudaram:

- Os PNGs passaram a existir de qualquer forma — o motor já os baixa para desenhar o mundo.
- Com dezesseis zonas **a cor parou de bastar**: há biomas com o mesmo fundo e a mesma assinatura,
  cujos degradês saem indistinguíveis lado a lado.

E esta é a tela que "vende lugar novo": mostrar o lugar é literalmente a função dela.

O degradê continua por baixo, no CSS, e aparece enquanto o PNG não chega. O componente entrega o
**dado** (qual arquivo, quantos quadros) como custom property; o CSS decide o enquadramento e a
animação, com `steps()` — sem `steps()` o navegador interpola entre os quadros e a folha desliza
como panorama em vez de trocar de quadro. Quem pediu menos movimento fica com o primeiro quadro.

**As dezesseis se mexem.** Enquanto metade tinha cena, o componente ligava uma classe `--viva` item
a item e a outra metade caía no cenário parado com um quadro só. Sem ninguém para deixar de fora, a
classe virou um modificador sempre presente, e a animação desceu para a regra base. O que substituiu
o ramo "e se esta zona não tiver cena" não é confiança de que o arquivo existe: é o degradê, que
aparece enquanto o PNG viaja e continua aparecendo se ele nunca chegar.

O laço é lento (0,66 s) porque agora são dezesseis cartões animando ao mesmo tempo, numa tela em que
o jogador está **lendo** faixa de nível para decidir para onde ir.

## 9. Critérios de aceite

1. Existem 16 biomas e 16 mapas; `mapaSugerido` cobre nível 1 a 80 e satura no 16.
2. Nenhum arquivo de regra importa `biomas.ts` nem `mapas.ts`; nenhuma migration menciona bioma ou
   mapa; `mapaId` não sai para o servidor. (Os três testes já existentes, agora com 16.)
3. Cada bioma tem assinatura exclusivo, e nenhuma silhueta geométrica repete outra.
4. Todo caminho de arte declarado no atlas existe no disco, e cada família de folha tem largura
   divisível pela **sua** contagem de quadros — dano tem 2, as outras têm 4.
5. Os dezesseis têm as quatro variantes de ladrilho no disco, 64×64, sem repetir. A malha só
   aparece enquanto o ladrilho base não decodificou.
6. As 21 formas — 16 assinatura e 5 do pool base — têm repouso e morte. A folha de dano existe para
   as 16 assinatura e para nenhuma do pool, que usa o `-sil` desenhado à mão (§11).
7. Todo quadro de folha cabe na caixa do PNG parado correspondente, e a largura de cada família
   divide pela **sua** contagem de quadros.
8. Matar deixa corpo e tira o bicho de `inimigos` no mesmo quadro; sumir por distância não deixa;
   trocar de mapa limpa; o corpo não é mirado nem conta como população.
9. As contas de quadro saturam e nunca devolvem índice fora da folha, nem com `NaN` na entrada.
10. O painel de mapa lista os 16 sem rolagem, paginado, e as dezesseis miniaturas animam.

## 10. O que ficou sabido e não resolvido

- **`escalaDoMapa` no mapa 16 é 6,25×**, contra 3,45× no mapa 8. Salto grande de dificuldade
  visual. Não afeta recompensa. Fica registrado para o dono decidir com dado na mão. **E o §12
  encurtou o caminho até lá**: o mapa 16 agora abre no nível 76, não no 151.
- **Bioma 9 e bioma 14 têm o mesmo trio de cor** (`#0e0b14` / `#5c5566` / `#c93a6e`), como vieram
  do pacote. A miniatura com a cena resolve o sintoma no painel; os tokens seguem iguais.
- **O pool base não tem folha de dano** — ver §11. É a única assimetria que sobrou do arco.

## 11. O pool base, e o `-sil` que ficou onde estava

Os cinco bichos que aparecem nos dezesseis mapas ganharam repouso e morte, e **não** ganharam folha
de dano. O brief tratou isso como já resolvido — "o `-hit` deles já existe: são os `-sil`" — e é a
única coisa do pedido em que o brief errou.

O `-sil` é silhueta de quadro único, desenhada para a pose do PNG parado. Medindo o alfa: ele bate
**100%** com o PNG parado, que bate **100%** com o quadro 1 do repouso e diverge **6 a 12%** dos
quadros 2, 3 e 4. Desenhá-lo sobre um corpo animado acertaria a pose em um acerto de cada quatro e
estouraria nos outros três — dezenas de vezes por minuto, porque abate é o que este jogo mais
produz.

Então no caminho animado o motor **gera** a silhueta do quadro corrente, que é o que ele já fazia.
A arte desenhada não ficou órfã: o `-sil` continua sendo o lampejo do caminho do PNG parado, que é
onde o bicho fica enquanto a folha não decodifica — e lá a pose casa, porque lá o corpo **é** o PNG
parado.

Pedir cinco `-hit` de dois quadros resolveria de vez, e é melhoria, nunca pré-requisito. Não valia
segurar o pacote por ela.

## 12. A arte que ninguém via

Entregue o pacote, o dono foi jogar e voltou com uma frase: *"os mapas não estão mudando e nem os
monstros"*. Não era bug — o motor troca o cenário inteiro ao viajar (medido: 100% dos pixels
mudam entre mapa 1 e mapa 2, contra 0% no controle). Eram **dois números de ritmo que nunca
tinham sido recalculados**, e juntos eles escondiam a arte que acabava de chegar.

### O portão: 10 níveis por mapa, com 16 mapas

`NIVEIS_POR_MAPA = 10` foi escolhido quando existiam **oito** mapas, e cobria o jogo inteiro até
o nível 80. O catálogo dobrou no arco da fábrica morta e o passo ficou parado, então o mesmo
nível 80 passou a mostrar metade: a fábrica só começava no 81, e os dezesseis só terminavam de
abrir no **151**. No nível 1 o painel tinha **15 cadeados**.

Passou a **5**. Os dezesseis voltam a caber nos mesmos 80 níveis que os oito cobriam — o alcance
é o que foi preservado, o passo é o que cedeu. Não há o que proteger: mapa não credita nada, e o
cadeado existe para dar ritmo de descoberta, não para impedir trapaça. Entre ritmo e o jogador
não ver a arte que existe, o Princípio nº1 decide.

| | antes | depois |
|---|---|---|
| todos os 16 abertos em | nível 151 | **nível 76** |
| a fábrica morta começa em | nível 81 | **nível 41** |

### O pool: assinatura em 1 de 6

`poolDoMapa` devolve os 5 base **mais** o assinatura, e `surgirNoNinho` sorteava igual entre os
seis. Medido em 300 sementes por mapa: o bicho exclusivo do lugar era **16,0%** dos que nasciam,
e a distribuição saía **idêntica nos dezesseis mapas** — 84% do que aparecia na tela era o mesmo
em toda parte. Viajar trocava o chão e as paredes e deixava a fauna igual.

O sorteio virou ponderado, com `FATIA_DO_ASSINATURA = 0.45`. O assinatura passou a **46,8%** do
que nasce, contra 10–11% de cada base: sozinho, é o mais comum da tela por quatro vezes. O pool
compartilhado continua lá, porque é ele que dá continuidade entre zonas — a soma nunca virou
troca.

`especieQueNasce` gasta **um sorteio só**, e isso não é economia: o mundo sai de um gerador com
semente, e a posição, o ângulo e a recarga de cada inimigo vêm dos números seguintes na mesma
sequência. Gastar dois deslocaria todos os outros e mudaria cada mapa já gerado, chão e ninhos
inclusive, só para escolher um bicho.

Ela é pura de propósito: o desenho não é testável neste projeto (os testes rodam em nó, sem
canvas), mas a distribuição é — e a varredura do sorteio inteiro em `mapas.test.ts` mede a fatia
exata, sem margem de amostragem.

### O que ficou de fora

**Separar o pool base por universo.** Os 5 base são todos doces (`pudim`, `minhoca`, `pirulito`,
`rosquinha`, `casquinha`), então a fábrica morta é povoada de bala — problema temático que pesar
o assinatura ameniza mas não resolve. A solução de verdade é um pool base industrial, e isso é
arte nova: 5 inimigos que o pacote não trouxe.

# Spec: A fábrica morta — biomas 9 a 16, chão desenhado e bicho que se mexe

*(emenda `specs/mapas-instanciados-combate-e-hud.md` §2 e `specs/mundo-aberto-e-modo-manual.md` §9;
o inventário de arte fica em `docs/02_DESIGN_SYSTEM/inventario-de-arte.md`)*

## 1. Escopo

Cinco pacotes de arte entregues pelo dono em sequência, na mesma conversa, cada um com uma instrução
de uma linha. Juntos eles dobram o mundo e trocam a natureza do cenário:

1. `Bioma 09_ Fábrica de Refrigerante.zip` — apesar do nome, traz **oito biomas** (09–16): os
   artboards, mais 24 PNGs (cenário, prop e inimigo assinatura de cada um).
2. `tiles.zip` — 32 ladrilhos de chão, 64×64, quatro variantes por bioma novo.
3. `animação de inimigos.zip` — 8 folhas de repouso, 4 quadros de 160×184.
4. `props.zip` — as mesmas 8 folhas de repouso (byte a byte) e mais 8 de prop animado.
5. `more features.zip` — de novo o que já entrou, mais **dano** (2 quadros), **morte** (4 quadros)
   e **cena animada** (4 quadros de 608×352) para cada um dos oito.

O arco é o contraponto industrial do universo doce: a mesma fábrica que produzia o mundo dos oito
primeiros biomas, abandonada. Doce que apodreceu, não um tema novo colado ao lado.

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

- **Dar folha de animação à leva doce.** Os oito primeiros continuam com PNG parado. Não é
  esquecimento: é a regra 2 de `atlas.ts` — animação é melhoria, nunca pré-requisito — e a
  assimetria está coberta por teste, para ser deliberada em vez de descoberta.
- **Usar a cena animada dentro do mundo.** Ela traz chão, props e inimigos já compostos, que é
  exatamente o que o motor desenha ao vivo. Ver §6.
- **Rebalancear a curva de mapa.** `escalaDoMapa` no mapa 16 dá 6,25× contra 3,45× no 8. É salto
  grande, é só cenário, e mexer nele é decisão do dono com dado de jogador real na mão.
- **Arte de chão para os oito doces.** O pacote não trouxe, e eles seguem na malha procedural.

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

## 5. O chão desenhado

Os oito biomas novos têm ladrilho; os oito doces, não. `desenharCenario` escolhe **um dos dois**,
nunca os dois: a malha hexagonal existe para dar referência de movimento num fundo chapado, e um
piso de verdade já faz isso melhor. Sobrepor deixaria um risco de papel milimetrado por cima da
chapa rebitada — o efeito exato que a malha existe para evitar.

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
| `-prop` | 4 de 176×176 | o elemento de cenário espalhado |
| `-scene` | 4 de 608×352 | **a miniatura do painel de mapa** |

As três folhas de inimigo saem do **mesmo apelido**, num mapa só. Escritas em tabelas separadas,
seriam três listas para manter em sincronia e uma para esquecer no dia em que chegar a nona forma.

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

## 9. Critérios de aceite

1. Existem 16 biomas e 16 mapas; `mapaSugerido` cobre nível 1 a 160 e satura no 16.
2. Nenhum arquivo de regra importa `biomas.ts` nem `mapas.ts`; nenhuma migration menciona bioma ou
   mapa; `mapaId` não sai para o servidor. (Os três testes já existentes, agora com 16.)
3. Cada bioma tem assinatura exclusivo, e nenhuma silhueta geométrica repete outra.
4. Todo caminho de arte declarado no atlas existe no disco, e cada família de folha tem largura
   divisível pela **sua** contagem de quadros — dano tem 2, as outras têm 4.
5. Os oito biomas do arco têm ladrilho e as quatro variantes no disco; os oito doces não têm
   nenhuma, e caem na malha.
6. Dano e morte existem exatamente para quem tem repouso — as três folhas saem do mesmo apelido.
7. Matar deixa corpo e tira o bicho de `inimigos` no mesmo quadro; sumir por distância não deixa;
   trocar de mapa limpa; o corpo não é mirado nem conta como população.
8. As contas de quadro saturam e nunca devolvem índice fora da folha, nem com `NaN` na entrada.
9. O painel de mapa lista os 16 sem rolagem, paginado.

## 10. O que ficou sabido e não resolvido

- **`escalaDoMapa` no mapa 16 é 6,25×**, contra 3,45× no mapa 8. Salto grande de dificuldade
  visual. Não afeta recompensa. Fica registrado para o dono decidir com dado na mão.
- **Bioma 9 e bioma 14 têm o mesmo trio de cor** (`#0e0b14` / `#5c5566` / `#c93a6e`), como vieram
  do pacote. A miniatura com a cena resolve o sintoma no painel; os tokens seguem iguais.

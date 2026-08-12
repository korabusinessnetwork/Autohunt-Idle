# Spec: mundo aberto e modo manual

> **Esta spec inverte a premissa do produto.** Até aqui, o jogo era auto-play com o mundo como
> enfeite. Passa a ser um jogo que se joga, com o auto-play virando **produto vendido**.
>
> Decidido pelo dono em 2026-08-12. Amenda `specs/game-idle-farm-core.md` (critérios 1, 5, 6, 15 e
> 17) e `specs/mapa-mundo-e-dungeon.md`.

## 1. O problema

`specs/game-idle-farm-core.md` abre dizendo "estética inspirada em **Realm of the Mad God**
(top-down)". O que foi construído não é isso.

Hoje o mundo tem exatamente o tamanho da tela (640×360). O herói nunca sai dali, os inimigos nascem
em volta dele, e o jogador não tem input nenhum. Isso é uma **arena de tela única** — a sensação é
de Crazy Chase, não de mundo aberto. A distância entre a spec e o build é real, e é de premissa,
não de acabamento.

## 2. O que muda

| | Antes | Depois |
|---|---|---|
| **Controle** | nenhum — o herói joga sozinho, sempre | **manual por padrão**: o jogador anda e mira |
| **Auto-play** | é o jogo | é **conveniência vendida** (anúncio ou assinatura) |
| **Mundo** | 640×360, do tamanho da tela | mapa grande, **câmera segue o herói** |
| **Inimigos** | nascem em volta do herói | **habitam** o mapa em grupos; o herói vai até eles |
| **Bioma** | função do nível | **região do mapa** |

## 3. As três decisões do dono, e o que cada uma implica

### 3.1 Manual e auto rendem exatamente igual

> *"manual e automatico é a mesma coisa, a diferença é que auto o cara pode ir viajar e deixar o pc
> ligado"*

**Consequência boa, e é a principal:** a arquitetura de segurança fica **intacta**. O servidor
continua creditando por tempo decorrido × poder, e o client continua sem declarar ganho nenhum.
As 13 ameaças que pendem dessa regra continuam fechadas, sem uma linha nova de anti-cheat.

**Consequência que precisa estar escrita:** a habilidade do jogador **não muda número nenhum**.
Jogar bem é sensação, não vantagem. Se um dia isso mudar, o client passa a precisar reportar abates
e a regra "o client nunca declara ganho" cai — é outra spec, com outro modelo de ameaças.

### 3.2 Sem auto destravado, ficar parado não rende

O servidor credita por tempo e **não sabe se alguém está jogando**. Sem trava, largar a aba aberta
renderia igual a jogar — e o auto, que é o produto, não teria por que ser comprado.

**A trava, e o motivo de ela ser barata:** o client acompanha o último input. Passados
**2 minutos sem nenhum**, com auto **não** destravado, ele chama `encerrar_sessao()` — exatamente o
que já acontece quando a aba fecha. A partir daí valem as regras de farm offline que já existem
(0h para quem não desbloqueou). Voltar a jogar reabre a sessão pela porta normal, com a tela de
retorno de sempre.

**Nenhuma regra nova de servidor.** Inatividade sem auto = fechar a aba. Uma regra só.

> **A trava de 2 minutos é anti-ocioso, não anti-cheat.** Ela pega quem levanta e sai, não quem
> escreve um script. É barata justamente por isso.

### 3.2b Captcha a cada 2 horas — o que a trava de 2 minutos não pega

*(decidido pelo dono na mesma conversa)*

Um script que simula input derrota a trava de 2 minutos sem esforço. E aí está o único incentivo
real a burlar que este jogo tem: **não é ganhar mais — é ganhar sem estar lá**, que é exatamente o
produto vendido.

Por isso o captcha existe, e por isso ele tem uma regra que não pode ser negociada:

> **Quem tem auto destravado NUNCA vê captcha.** Nem assinante, nem quem assistiu anúncio,
> enquanto o saldo durar.

Sem essa regra o captcha vira fricção cobrada de quem pagou — e é o oposto do que se está
vendendo. Com ela, o captcha deixa de ser incômodo e vira a **fronteira do produto**: ou você está
jogando de verdade, ou você comprou o direito de não estar.

**Como funciona:**

- A cada **2 horas de sessão contínua sem auto destravado**, o jogo pede a verificação.
- Enquanto não resolver, o crédito pausa. **Nada é perdido** — o que já foi creditado é do jogador,
  e resolver retoma de onde parou. Progresso nunca é punido.
- Resolver **nunca** é atestado pelo client. O token vai para uma Edge Function, que confere com o
  provedor usando o segredo do servidor e só então chama uma RPC de `service_role` que carimba a
  verificação. É o mesmo padrão do crédito de anúncio, e pelo mesmo motivo.

**Custo, e ele não é zero:**

- **Provedor de terceiro.** Cloudflare Turnstile tem tier gratuito e é o que melhor cabe na
  restrição de custo e na de privacidade. Precisa de conta — entra como pendência do dono, junto de
  P2 e P3.
- **LGPD.** O provedor recebe IP e sinais do navegador do jogador. Isso **entra no inventário de
  `docs/11_SEGURANCA/dados-pessoais-lgpd.md`** e na cláusula de compartilhamento dos termos. Não é
  detalhe: é um terceiro novo recebendo dado pessoal.
- **Sem provedor contratado**, o gate nasce desligado e o jogo funciona — mesma postura do anúncio
  e do gateway.

### 3.3 Auto na tela e farm offline são produtos separados

Cada um com seu saldo, seu teto e seu anúncio.

| Produto | O que é | Grátis | Assinante |
|---|---|---|---|
| **Auto na tela** | o personagem joga sozinho com a aba aberta | até 2h/dia por anúncio | ilimitado |
| **Farm offline** | rende com a aba fechada | até 2h/dia por anúncio | 24h por ausência |

**Custo desta escolha, e ele é de usabilidade:** o jogador passa a ter **duas moedas de tempo**
para entender. O Princípio nº 1 cobra caro por isso, então a UI precisa deixar as duas legíveis
lado a lado, com o nome do que cada uma compra — nunca dois números soltos.

## 4. Escopo

### 4.1 Mundo

- Mapa **muito maior que a viewport**, com câmera seguindo o herói e limitada às bordas.
- Inimigos **populam a região**, com respawn por área — não nascem colados no jogador.
- Os 8 biomas viram **regiões do mapa**, não função do nível.
- Herói limitado às bordas do mundo.

### 4.2 Controle

- **Teclado:** WASD e setas para andar. **Mouse:** mira e tiro.
- **Toque:** joystick virtual para andar; tiro automático no alvo mais próximo — a tela pequena não
  comporta dois polegares mirando.
- **O tiro continua sem física fina** (`game-idle-farm-core.md`, fora de escopo): não existe
  desviar de projétil. O jogador mira e atira; o dano é resolvido por cálculo.

### 4.3 Auto

- Um botão no HUD, com o estado sempre visível: **ligado / desligado / bloqueado com o motivo**.
- Ligado, o herói faz o que faz hoje: escolhe alvo, aproxima, atira.
- **Auto liga sozinho quando o saldo existe e o jogador para** — é o que ele comprou. Se não há
  saldo, entra a trava de inatividade de 3.2.

## 5. Fora de escopo — e por quê

- **Recompensa por habilidade.** Decisão 3.1. Exigiria o client reportar abates e derrubaria a
  regra central do produto.
- **Mundo compartilhado.** Continua fora (`game-idle-farm-core.md`): mundo instanciado, sem
  servidor de jogo.
- **Loot no chão.** RotMG derruba item no chão para ser apanhado. Aqui o loot é decidido no
  servidor e entregue no snapshot — apanhar do chão exigiria o client dizer "peguei", que é
  declarar ganho. **Fica como efeito visual apenas**, se entrar.
- **Cena de dungeon.** Continua sem cena (D13).

## 6. Critérios de aceite

1. O mundo é **maior que a viewport**, e a câmera segue o herói sem sair das bordas do mapa.
2. **O jogador anda com teclado e mira com o mouse.** No toque, joystick para andar e tiro
   automático.
3. **Auto é um modo**, com estado visível no HUD, e reproduz o comportamento atual do herói.
4. **Manual e auto creditam exatamente o mesmo.** Verificação estrutural: nenhuma RPC recebe modo,
   abate ou qualquer sinal de desempenho — o contrato de zero parâmetro continua valendo.
5. **Sem saldo de auto, 2 minutos sem input encerram a sessão** pela mesma rota do fechar-aba.
   Com saldo, nunca encerra.
5a. **A cada 2h de sessão sem auto destravado, o jogo pede captcha.** Quem tem auto destravado
   nunca vê. O crédito pausa até resolver, e **nada do que já foi creditado se perde**.
5b. **A verificação do captcha nunca é atestada pelo client**: Edge Function confere o token com o
   provedor e uma RPC de `service_role` carimba. Verificação estrutural, igual à do anúncio.
6. Os **dois saldos são independentes**: gastar auto não consome offline, e vice-versa.
7. A UI mostra **os dois saldos com o nome do que compram**, nunca dois números soltos.
8. Inimigos **habitam regiões** do mapa; nenhum nasce dentro do campo de visão do jogador.
9. Os 8 biomas são **regiões**, e o bioma corrente sai da **posição** do herói — não do nível.
10. **Bioma continua sem influenciar recompensa** — o teste que garante isso continua valendo.
11. `npm test`, `npm run build` e `./scripts/pg-local.sh` verdes.

## 7. Edge cases

- **Aba perde o foco com auto ligado** — continua rendendo; é exatamente o produto.
- **Aba perde o foco sem auto** — conta como inatividade e encerra depois dos 2 minutos.
- **Saldo de auto acaba no meio da sessão** — o auto desliga, avisa em texto, e a trava de
  inatividade passa a valer. Não encerra na hora: o jogador pode simplesmente voltar a jogar.
- **Jogador anda até a borda do mapa** — para na borda, sem parede invisível surpresa: a borda é
  visível.
- **Teclado e toque na mesma sessão** (laptop com tela sensível) — o último usado manda.
- **Nível sobe e a região não muda** — normal agora: o cenário é lugar, não progressão.
- **Captcha aparece e o jogador ignora** — o crédito fica pausado, sem tela bloqueante e sem
  contagem regressiva. Ele volta quando quiser; o que já era dele continua sendo.
- **Saldo de auto acaba exatamente na hora do captcha** — o captcha vale a partir dali, e o relógio
  das 2h começa a contar no momento em que o auto caiu, não retroativo.
- **Provedor de captcha fora do ar** — o gate **libera**, não bloqueia. Derrubar jogador legítimo
  porque um terceiro caiu é pior que deixar passar duas horas de bot.

## 8. O que esta mudança custa em documentação

Não é detalhe: várias afirmações do projeto ficam **falsas** no dia em que isto entrar, e
`CLAUDE.md` diz que a documentação prevalece.

| Documento | O que precisa mudar |
|---|---|
| `game-idle-farm-core.md` | critérios 1, 5, 6, 15 e 17 |
| `mapa-mundo-e-dungeon.md` | bioma deixa de ser função do nível |
| `docs/03_REGRAS_DE_NEGOCIO/` | a tabela de farm offline ganha o segundo produto |
| `docs/05_FLUXOS/` | "não existe input de jogo" deixa de ser verdade |
| `docs/06_COMPONENTES/` | idem, e o HUD ganha os dois saldos |
| `docs/11_SEGURANCA/` | ameaça nova: o client passa a informar inatividade; e o captcha traz um **terceiro novo recebendo dado pessoal**, que entra no inventário de LGPD e nos termos |
| **ADR novo** | a inversão da premissa precisa de decisão registrada, com o custo escrito |

## 9. Definição de "aprovado sem ressalvas"

Os 11 critérios verificados; a prova central por teste — **nenhuma RPC aprendeu a receber modo,
abate ou desempenho** — e a documentação acima corrigida na mesma rodada, não depois.

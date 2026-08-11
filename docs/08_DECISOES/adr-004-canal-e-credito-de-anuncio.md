# ADR-004 — Crédito de anúncio recompensado atestado pelo client

**Status**: **Proposto** — precisa de decisão do dono antes de virar Aceito
**Data**: 2026-08-11
**Decisores**: pendente (Matheus Bonato)
**Supersede**: —
**Supersedido por**: —

---

## Contexto

`specs/game-idle-farm-core.md`, critério 7, é categórico:

> Conclusão de anúncio só é creditada via callback validado do SDK **no servidor** — nenhuma
> rota credita minutos de anúncio direto a partir do client.

A regra é boa e tem a mesma raiz do cálculo de farm offline: nunca confiar no client para o que
vale economicamente. Só que ela colide com um fato dos canais escolhidos.

Os SDKs de anúncio recompensado da **Poki** (`rewardedBreak()`) e da **CrazyGames**
(`ad.requestAd('rewarded', ...)`) são **client-side**. A conclusão do anúncio volta como
promise ou callback dentro do navegador. Nenhum dos dois publica confirmação
servidor-a-servidor para anúncio recompensado — isso existe no mundo mobile (AdMob, Unity Ads),
não nos SDKs web desses portais.

Ou seja: **o critério 7, como escrito, é inimplementável nos dois canais que o produto
escolheu.** Não é questão de esforço de implementação — o dado não existe do lado do servidor.

Isso não apareceu na Fase 1 porque nenhum provedor estava plugado. Apareceu agora, ao construir
a camada de portal.

## Decisão proposta

Manter **toda a autorização e todos os tetos no servidor**, e aceitar que apenas o *atestado de
conclusão* venha do client.

Na prática, para um minuto de farm offline ser creditado, é preciso:

1. um **ticket emitido pelo servidor** antes do anúncio começar (`emitir_ticket_anuncio`) — o
   client não tem como inventar um id válido;
2. que o jogador esteja **autenticado**, provado pelo JWT conferido na Edge Function
   `anuncio-resgate` — o `player_id` nunca vem do corpo da requisição;
3. que o ticket seja **daquele jogador**, **nunca resgatado** e **dentro da validade** de 30
   minutos — tudo verificado numa única instrução atômica;
4. que os **tetos ainda comportem**: 15 min por ticket, 2 h por dia, saldo máximo de 2 h,
   reaplicados no banco a cada resgate.

O que o client consegue afirmar é uma coisa só: "o anúncio terminou". Ele não diz quanto vale,
nem para quem, nem quantas vezes.

## Alternativas Consideradas

### 1. Cumprir o critério 7 à risca, com um provedor que ofereça callback S2S

- **Prós**: mantém a promessa original intacta
- **Contras**: nenhum provedor com S2S para anúncio recompensado web está disponível nos canais
  escolhidos. Adotar um significaria abandonar Poki e CrazyGames — as duas rotas de distribuição
  do produto (`memory/identity.md`, Fase 2)
- **Descartado porque**: trocaria um risco econômico pequeno e limitado por perder o canal de
  aquisição inteiro

### 2. Não ter anúncio recompensado

- **Prós**: zero exposição
- **Contras**: o tier grátis deixa de existir. Não-assinante fica com 0 h de farm offline
  permanentemente, e como os dois portais **proíbem assinatura dentro do jogo**, o jogador de
  portal nunca veria a tela de retorno com um número — que é o "aha moment" declarado do produto
- **Descartado porque**: mataria justamente a hipótese que a Fase 2 existe para testar

### 3. Aceitar sem mitigação (creditar direto do client)

- **Descartado porque**: seria abrir uma rota pública de "me dá 15 minutos", sem custo nenhum
  para o atacante e sem teto por jogador

## Exposição residual — quantificada

Um jogador que forje a conclusão do anúncio (chamando o resgate sem assistir) ganha, no máximo,
**2 h de farm offline por dia** — exatamente o que ganharia assistindo aos anúncios de verdade.

O prejuízo não é o farm; é a **receita do anúncio não exibido**. O teto diário limita o dano por
conta, e o custo de fraudar (automatizar um navegador autenticado) é alto perto de um ganho que
já está disponível de graça.

Ainda assim, é uma diferença real em relação ao que o critério 7 prometia, e por isso este ADR
nasce **Proposto**, não Aceito.

## O que muda se você aprovar

- `specs/game-idle-farm-core.md`, critério 7, ganha uma amenda dizendo que em canal com SDK
  client-side vale o esquema de ticket + tetos servidor-side descrito aqui
- O ADR passa a Aceito e a data de decisão é preenchida

## O que muda se você recusar

- O anúncio recompensado sai do escopo enquanto não houver provedor com S2S
- O tier grátis fica sem farm offline, e a Fase 2 vira validação só de retenção, não de receita
- `supabase/functions/anuncio-resgate/` e `resgatar_anuncio_do_jogador` são removidos

## Consequências

### Positivas

- O tier grátis passa a existir de fato nos dois portais
- Todos os limites econômicos continuam decididos pelo Postgres, com `now()` do servidor
- Replay do mesmo resgate não credita duas vezes (resgate atômico por ticket)

### Negativas / Trade-offs

- A conclusão do anúncio é uma afirmação do client — auditável em `evento_jogo`, mas não
  verificável
- Se algum dia um provedor com S2S entrar, passam a existir dois caminhos de crédito
  (`creditar_anuncio` e `resgatar_anuncio_do_jogador`) — os dois já compartilham o mesmo núcleo
  (`aplicar_credito_anuncio`), então a manutenção é de uma regra só

## Referências

- `specs/build-fase-2-portal.md` — seção 3 e critérios 12 a 14
- `supabase/migrations/20260812_resgate_anuncio_do_client.sql`
- `supabase/functions/anuncio-resgate/index.ts`
- `docs/01_ARQUITETURA/publicacao-portais.md`
- `memory/restrictions.md` — "SDK de anúncio recompensado: OK usar desde já"

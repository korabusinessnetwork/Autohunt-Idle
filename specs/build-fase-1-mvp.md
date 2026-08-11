# Spec de execução: Build da Fase 1 (MVP validável)

*(spec de **build** — traduz `specs/game-idle-farm-core.md` em algo implementável e auditável.
Não inventa regra de produto nova: cada critério aqui rastreia até um critério do core.
Escopo travado por `memory/identity.md` → Roadmap → **Fase 1 = só `specs/game-idle-farm-core.md`**.)*

- **Spec de origem:** `specs/game-idle-farm-core.md` (18 critérios, incluindo amendas)
- **Data:** 2026-08-11
- **Rodada do loop:** `/spec` → `/build` → `/review`

---

## 1. Escopo

Construir o MVP jogável do Autohunt Idle: projeto React + Vite + TypeScript com loop de jogo
em canvas fora do ciclo do React, schema Supabase com RLS por jogador, a RPC `SECURITY DEFINER`
que é a **única** autoridade sobre XP/moeda (tanto no farm offline quanto na validação em lote
da sessão ao vivo), conta anônima automática, cadastro tardio com gate de idade 18+, crédito de
anúncio recompensado apenas por callback assinado no servidor, tela de retorno bilíngue, e suíte
de testes das funções puras de cálculo.

## 2. Fora de escopo

Tudo que o roadmap coloca na Fase 3 em diante, e tudo que a fase bootstrap não paga:

- **Dungeon, raridade de 10 tiers, síntese, skin** (`specs/dungeons-loot-skins.md`) — Fase 3
- **Equipamento, conjunto, tipo de dano, afinidade** (`specs/equipamento-e-poder.md`) — Fase 3
- **Atributos (Força/Inteligência/Vitalidade/Sorte), respec, ranking global, nickname**
  (`specs/ranking-global.md`) — Fase 3. Da spec de ranking, a Fase 1 leva **só** o critério 1
  (nível sem teto), que já é amenda do core (critério 12), e a formatação legível de número grande,
  que a tela de retorno precisa pra não exibir dígito cru
- **Passe de recompensas** (`specs/passe-de-recompensas.md`) — Fase 3. Da spec do passe, a Fase 1
  leva **só** o critério 5 (assinatura = 24h + 2x XP), que já é amenda do core (critério 4a)
- **Diamante, loja e mercado P2P** (`specs/mercado-diamante.md`) — Fase 3. Consequência: o critério
  18 do core cita "gastar diamante" como um dos gatilhos de cadastro; na Fase 1 **não existe
  diamante**, então sobra só o outro gatilho já previsto no mesmo critério (ativar farm offline)
- **8 biomas / mapa até level 1000** (`specs/mapa-mundo-e-dungeon.md`) — Fase 3. O MVP tem um único
  cenário do bioma 1 (Floresta de Algodão-Doce)
- **Integração com gateway de pagamento real** (Stripe/Asaas) — não há conta contratada e
  `memory/restrictions.md` adia todo item pago por padrão. Entra o *seam* (webhook + estado de
  assinatura no banco), não o provedor
- **Integração com SDK de anúncio real** (Poki/CrazyGames/AdSense) — mesma razão: a escolha de
  canal está em aberto e a Poki proíbe IAP. Entra o *seam* (callback assinado), não o provedor
- **Arte final** — o brief foi encomendado ao Claude Design e os assets não voltaram. O MVP
  renderiza placeholders geométricos na paleta oficial, com a camada de sprite isolada pra troca
- **Deploy em Vercel / publicação em portal** — Fase 2

## 3. Decisões de execução (o que estava pendente e fica fechado aqui)

Estas eram lacunas reais da fundação. Ficam decididas para o `/build` não travar; todas são
reversíveis e nenhuma contradiz ADR existente.

| # | Pendência | Decisão | Origem |
|---|---|---|---|
| D1 | `TEST_CMD` "pendente" | **Vitest** (`npm test`), já embutido no ecossistema Vite, custo zero | `respostas-intake.md` Bloco 4 |
| D2 | TypeScript "a confirmar" | **Confirmado TypeScript** — padrão dos outros projetos Kora | `docs/01_ARQUITETURA/tech-stack.md` |
| D3 | PixiJS "a confirmar na 1ª sprint" | **Canvas 2D nativo**, sem PixiJS. O MVP desenha ~20 sprites chapados sem shader; a API `CanvasRenderingContext2D` cobre isso com zero dependência e zero bundle. A camada de render fica atrás de uma interface (`Renderizador`) pra trocar por PixiJS se o conteúdo crescer | `docs/01_ARQUITETURA/tech-stack.md` |
| D4 | i18next "ou equivalente" | **Módulo próprio tipado** (`src/lib/i18n/`): o dicionário é `Record<ChaveI18n, string>` nas duas línguas, então **faltar uma tradução vira erro de compilação** — garantia mais forte que i18next dá, e sem dependência | `docs/01_ARQUITETURA/tech-stack.md` |
| D5 | "N segundos" do lote ao vivo | **15 s** entre validações de lote (valor de balanceamento, constante única em `src/constants/`) | core, critério 15 |
| D6 | Provedor de anúncio/gateway | **Padrão adapter**: interface no servidor, nenhum provedor real plugado. Um adapter `dev`, ativo só quando `AD_PROVIDER=dev` está setado no servidor, permite testar o fluxo sem contratar nada — o segredo de assinatura vive só no servidor, então o client continua sem conseguir forjar crédito | `memory/restrictions.md` (fase custo) |

## 4. Arquivos afetados

```
package.json, tsconfig.json, vite.config.ts, index.html, .env.example
supabase/migrations/20260811_fundacao_jogador_farm.sql      # tabelas + RLS
supabase/migrations/20260811_rpc_farm_e_sessao.sql          # RPCs SECURITY DEFINER
supabase/functions/anuncio-callback/index.ts                # callback assinado do SDK
supabase/functions/assinatura-webhook/index.ts              # webhook do gateway
supabase/functions/_shared/assinatura.ts                    # verificação HMAC compartilhada
src/lib/supabaseClient.ts                                   # (substitui o esboço)
src/lib/services/{authService,farmService,adService,subscriptionService}.ts  # (idem)
src/lib/i18n/{index.ts,pt.ts,en.ts,chaves.ts}
src/game/{motor.ts,mundo.ts,combate.ts,renderizador.ts,sprites.ts}
src/game/regrasFarm.ts                                      # funções puras, espelham o SQL
src/features/farm-offline/{TelaRetorno.tsx,TelaRetorno.css,useFarmOffline.ts}
src/features/cadastro/{ModalCadastro.tsx,ModalCadastro.css,idade.ts}
src/components/shared/, src/context/SessaoContext.tsx, src/hooks/, src/pages/, src/styles/, src/utils/
src/**/*.test.ts                                            # Vitest
```

Convenções obrigatórias (`docs/01_ARQUITETURA/padroes.md`): SQL `snake_case`, migrations
`YYYYMMDD_descricao.sql`, TS `camelCase`, componentes `PascalCase`, CSS fora do JSX, envelope
`{ data, error, meta }` em todo serviço, códigos de erro estáveis, eventos de domínio em
`dot.case` no passado, RLS por `player_id`/`user_id` (**nunca** `tenant_id`, ADR-002).

## 5. Critérios de aceite

Cada item é verificável com sim/não. A coluna "core" rastreia até `specs/game-idle-farm-core.md`.

### Combate e sessão ao vivo

1. **(core 1)** Com o client aberto, o personagem se move e ataca sozinho — nenhum input do
   jogador é necessário nem lido para o combate acontecer.
2. **(core 15)** O client simula o combate localmente só para a visão; XP/moeda são creditados
   exclusivamente pela RPC de lote, chamada a cada 15 s (D5). O payload dessa RPC **não contém**
   XP, moeda, abates nem timestamp — o servidor deriva tudo do próprio `now()` e do estado do
   jogador. Verificação: `grep` no payload do serviço não acha campo de recompensa.
3. **(core 16)** Quando a Vitalidade zera no mundo aberto, só o ciclo de farm em andamento
   (o trecho ainda não creditado) é perdido; o total já creditado não é reduzido, e o personagem
   volta a farmar imediatamente, sem tela de morte e sem cooldown.
4. **(core 2)** Fechar/ocultar a aba encerra a sessão ao vivo e marca o início da contagem offline.
   O encerramento **não depende** do beacon do navegador chegar: o servidor trata `last_seen_at`
   parado como sessão encerrada, então matar o processo do browser produz o mesmo resultado.

### Farm offline (o coração da regra de segurança)

5. **(core 3)** O cálculo de recompensa offline roda em RPC `SECURITY DEFINER` usando `now()` do
   Postgres. Nenhuma RPC/função aceita timestamp, duração ou recompensa vinda do client — nem como
   parâmetro opcional. Verificação: nenhuma assinatura de função no SQL tem parâmetro de tempo.
6. **(core 4)** Assinante ativo acumula até **24 h** por ausência.
7. **(core 4a)** Assinante ativo recebe **2x XP** em toda atividade — no lote ao vivo e no offline.
   O multiplicador é aplicado no SQL, não no client.
8. **(core 5)** Não-assinante acumula **0 h** de farm offline por padrão.
9. **(core 6)** Não-assinante desbloqueia até **2 h/dia** em incrementos de **15 min** por anúncio.
10. **(core 8)** O bucket de 2 h reseta a cada 24 h, decidido pelo servidor (`now()`), não por
    contador do client.
11. **(core 9)** Quando a assinatura vence de fato (fim do período pago / falha definitiva de
    cobrança — **não** o clique de cancelar), o progresso acumulado e ainda não coletado é zerado.
    Cancelar mantém o benefício até o fim do período pago.
12. **(edge case do core)** Reconexões rápidas em sequência não creditam o mesmo intervalo duas
    vezes: o avanço de `last_seen_at` é atômico, na mesma instrução que credita.
13. **(core 12)** Nível não tem teto: a curva de XP é crescente e o tipo no banco é `bigint`,
    sem constante de nível máximo em lugar nenhum do código.

### Anúncio recompensado

14. **(core 7)** Minutos de anúncio só são creditados pela Edge Function de callback, que rejeita
    requisição sem assinatura HMAC válida do provedor. Nenhuma RPC exposta ao client credita
    minuto de anúncio. Verificação: chamar a RPC de crédito direto com o token do jogador falha.
15. **(edge case do core)** Anúncio fechado/com erro antes do fim não credita — o crédito exige um
    ticket emitido pelo servidor que só é resgatado pelo callback de conclusão, e cada ticket é
    resgatável **uma vez só** (replay do mesmo callback não credita de novo).
16. **(edge case do core)** Jogador que já está no teto de 2 h é avisado **antes** de assistir —
    a UI não oferece um anúncio que não vai render nada.

### Conta, cadastro e compliance

17. **(core 17)** O jogo abre direto no mundo aberto com o personagem já agindo — sem tela de
    boas-vindas e sem escolha inicial. Uma conta anônima real (`signInAnonymously`) é criada
    silenciosamente na inicialização, antes de qualquer progresso existir.
18. **(core 18)** Cadastro (e-mail/senha) só é pedido quando o jogador tenta ativar o farm offline,
    e **adiciona credenciais à conta anônima existente** (`updateUser`) — sem migrar nem reimportar
    progresso, sem criar um segundo usuário.
19. **(`memory/restrictions.md`, CRÍTICA)** O cadastro exige **data de nascimento real** e bloqueia
    <18 anos. A idade é validada também no servidor (constraint/trigger), não só no formulário —
    política sem enforcement não vale nada.
20. **(CLAUDE.md)** RLS ativa em toda tabela nova, com policy por `player_id`/`user_id`. Nenhuma
    tabela fica sem policy. Nenhum `select *` em tabela de dado sensível. Nenhuma chave/URL
    hardcodada — tudo `import.meta.env.VITE_*` no client e env var no servidor.

### Apresentação

21. **(core 10)** A tela de retorno mostra tempo decorrido e rendimento, **ou** informa que o
    progresso não foi salvo por falta de assinatura/anúncio — os dois caminhos existem e são
    legíveis sem leitura atenta (Princípio nº1).
22. **(edge case do core)** Os números da tela de retorno vêm prontos do servidor; o client não
    recalcula rendimento nem duração a partir do relógio local.
23. **(core 13)** Toda string de UI existe em **pt** e **en**, com detecção pelo idioma do
    navegador e troca manual persistida. Faltar uma chave em uma das línguas quebra o build (D4).
24. **(core 14)** Nome de inimigo tem versão em inglês **pensada**, com trocadilho próprio — não
    tradução literal. Verificação: os 5 inimigos do pool têm nome en que não é a tradução palavra
    a palavra do pt.
25. **(core 11 / ADR-001)** Nenhum processo persistente, worker ou servidor de jogo: tudo é
    Postgres + RPC + Edge Function, resolvido sob demanda no reconnect.
26. **(`docs/02_DESIGN_SYSTEM/`)** As 7 cores da paleta oficial são tokens CSS em um único arquivo
    e a UI não usa hex solto fora dele.
27. **(CLAUDE.md)** `npm test` passa, `npm run build` passa, e as funções puras de cálculo de farm
    nascem com teste — incluindo um teste que prova que adiantar o relógio do client não muda o
    resultado do cálculo.
28. **(CLAUDE.md)** Toda tela tem os quatro estados visíveis: carregando, erro, vazio e sucesso.

## 6. Edge cases que o build precisa tratar

Além dos já listados no core (todos viraram critério acima):

- **Duas abas do mesmo jogador abertas** — as duas simulam visualmente, mas o crédito é do
  servidor e é idempotente por intervalo, então não dobra ganho.
- **Jogador nunca assinou e nunca viu anúncio** — a tela de retorno precisa do estado "0 min
  acumulados" sem parecer erro, e sem dar bronca (`memory/identity.md`: tom nunca punitivo).
- **Ausência maior que o teto** — 40 h fora com assinatura credita 24 h e diz isso claramente,
  sem simular urgência artificial (restrição ética).
- **Relógio do client adiantado/atrasado** — irrelevante pro cálculo por design; a UI não pode
  derivar nada dele.
- **`signInAnonymously` desabilitado no projeto Supabase** — o jogo precisa falhar de forma
  legível ("não deu pra conectar", com retry), nunca tela branca.
- **Segundo cadastro com e-mail já usado** — mensagem clara, sem perder a sessão anônima em curso.

## 7. Definição de "aprovado sem ressalvas"

Os 28 critérios acima marcados como **sim**, com evidência em arquivo/linha; `npm test` e
`npm run build` verdes; nenhum `console.log` esquecido; nenhum `TODO` sem justificativa escrita;
nenhum segredo hardcodado; e a prova central do produto — **não existe caminho pelo qual o client
declare quanto ganhou**, nem ao vivo nem offline — verificável lendo as assinaturas das RPCs.

---

# Resultado da review — 2026-08-11

`npm test`: **52 passando**. `npm run build`: **verde** (`tsc --noEmit` + `vite build`).

## Auditoria dos 28 critérios

| # | Veredito | Evidência |
|---|---|---|
| 1 | sim | `src/game/mundo.ts:avancarMundo` move e atira sozinho; `grep addEventListener src/game` não retorna nada — nenhum input alimenta o combate |
| 2 | sim | `src/game/motor.ts` dispara `aoValidarLote` a cada `INTERVALO_LOTE_MS` (15 s); `src/lib/services/farmService.test.ts` prova que o payload é `{}` e não contém campo de tempo ou recompensa |
| 3 | sim | `resolver_ciclos` no SQL e o espelho em `regrasFarm.ts` descartam só o ciclo corrente; teste "perde SÓ o ciclo em que a Vitalidade zera" |
| 4 | sim | `SessaoContext` trata `visibilitychange`/`pagehide`; a regra real é `last_seen_at` parar de avançar, então matar o navegador dá o mesmo resultado |
| 5 | sim | `contratoRpc.test.ts` reprova qualquer função concedida a `authenticated` que tenha parâmetro |
| 6 | sim | `c_teto_assinante_min = 1440` em `iniciar_sessao` |
| 7 | sim | `v_multiplicador` aplicado dentro de `resolver_ciclos`, no SQL; teste confirma que dobra XP e **não** dobra moeda |
| 8 | sim | `farm_state.minutos_anuncio_saldo` nasce 0; `tetoOfflineMinutos(false, 0) === 0` |
| 9 | sim | `emitir_ticket_anuncio` emite 15 min; `creditar_anuncio` limita a 120/dia |
| 10 | sim | reset por `now() - janela_anuncio_iniciada_em >= interval '24 hours'`, no servidor |
| 11 | sim | `iniciar_sessao` só zera o pendente quando `expira_em <= now()`; `'cancelada'` segue valendo até lá |
| 12 | sim | `select ... for update` antes de qualquer cálculo; crédito e avanço de `last_seen_at` na mesma instrução |
| 13 | sim | `bigint` no schema, curva `50·(n-1)·n`, teste com nível 1.000.000; `grep` não acha constante de nível máximo |
| 14 | sim | `revoke execute on function public.creditar_anuncio(uuid) from public, anon, authenticated` — verificado por teste |
| 15 | sim | resgate atômico via `update ... where resgatado_em is null`; callback com status ≠ `concluido` não credita |
| 16 | sim | `PainelDesbloqueio.motivoIndisponibilidade` desabilita o botão com o motivo antes de qualquer anúncio |
| 17 | sim | `garantirSessao` chama `signInAnonymously` na inicialização; não há tela de boas-vindas nem escolha |
| 18 | sim | `authService.cadastrar` usa `auth.updateUser`, mantendo o mesmo `user.id` |
| 19 | sim | trigger `validar_idade_minima` no banco, além da validação de formulário; 9 testes em `idade.test.ts` |
| 20 | sim | RLS + policy em todas as 5 tabelas (verificado por teste); `GRANT` de coluna impede o jogador de escrever progressão; nenhum hex/segredo hardcodado |
| 21 | sim | `TelaRetorno` tem o caminho com ganho e o caminho "não foi salvo", cada um com o texto do motivo |
| 22 | sim | os números saem do bloco `retorno` montado no servidor; não há `Date` em `features/farm-offline/` nem em `utils/formato.ts` |
| 23 | sim | `en` é `Record<ChaveI18n, string>` — chave faltando quebra o build; detecção + troca manual persistida |
| 24 | sim | Cone Head / Glum Worm / Sir Glazealot / Sucker Punch / Flanpathy / The Fluffwoods, com teste que reprova a tradução literal |
| 25 | sim | só Postgres + RPC + Edge Function; nenhum worker ou processo persistente |
| 26 | sim | `src/styles/tokens.css` é a única fonte; o canvas lê os tokens em runtime (`src/game/paleta.ts`); `grep` de hex fora do arquivo não retorna nada |
| 27 | sim | 52 testes verdes, build verde; inclui o teste de relógio adiantado em 30 dias |
| 28 | sim | `EstadoTela` concentra carregando/erro/vazio; a tela de retorno tem estado vazio próprio |

## Corrigido durante a review (8 achados)

1. **Trocar de aba remontava o jogo inteiro.** `conectar()` voltava para `carregando` a cada
   retorno de visibilidade, destruindo e recriando o motor. Agora o resync não mexe no estado
   de tela.
2. **`subscriptionService` decidia assinatura pelo relógio do client** (`Date.now()`) — a mesma
   classe de erro que a regra do farm offline proíbe. A função foi removida: quem responde isso
   é o servidor, no snapshot.
3. **Data de nascimento era regravável.** O jogador tem `UPDATE` na coluna, então o gate de 18+
   era reversível com um clique. Agora um trigger a torna imutável depois de informada.
4. **Cadastro poderia ser pedido de novo a quem já cadastrou.** Com confirmação de e-mail
   ligada, `auth.users.email` fica vazio até o clique no link. Entrou `identidadeVerificada`,
   que exige gate de idade **e** credenciais criadas (confirmadas ou pendentes).
5. **Hex solto** (`#fff`) em `ModalCadastro.css`, furando a regra de fonte única da paleta.
6. **`jogador.idioma` era coluna morta** — a troca de idioma só ia para o `localStorage`,
   embora seja o campo que decide o gateway de pagamento do jogador.
7. **Duas chaves de tradução mortas** (`hud.validando`, `cadastro.sucesso`) e um botão rotulado
   "Assistir anúncio" que na verdade abria o painel de desbloqueio.
8. **Os nomes bilíngues de inimigo não apareciam em lugar nenhum** — existiam nos dois
   dicionários e nunca chegavam à tela. Agora o nome do alvo é desenhado no canvas.

Três testes novos foram acrescentados para que esses achados não voltem: imutabilidade da data
de nascimento, ausência de chave de tradução órfã, e o mapa explícito de códigos de erro do
cadastro.

## Precisa da sua decisão (não corrigido de propósito)

Nenhum destes é bug: são escolhas de produto ou de negócio, registradas em
`docs/09_BACKLOG/README.md` com o detalhe completo.

1. **Confirmação de e-mail no Supabase Auth** — exigir (mais seguro) ou dispensar (menos
   fricção, mais alinhado ao Princípio nº1)?
2. **Provedor de anúncio** — sem ele, **não-assinante não tem nenhuma forma de farm offline**.
   Depende da escolha de canal, que segue em aberto.
3. **Gateway de pagamento** — sem conta contratada, não existe assinante, e os critérios 6 e 7
   acima nunca são exercidos por um jogador de verdade.
4. **Poki bloqueia chamada ao Supabase?** — `memory/restrictions.md` mandava confirmar **antes
   do build** e isso não aconteceu. Se bloquear, a arquitetura SPA + BaaS não cabe naquele
   canal. É a pendência de maior impacto.

## Ressalva que não é decisão sua, é limite do ambiente

As migrations foram **auditadas estruturalmente** (`src/lib/contratoRpc.test.ts` lê o SQL e
reprova RPC exposta com parâmetro, tabela sem RLS e `tenant_id`), mas **não foram executadas**:
não há Postgres nesta máquina. Aplicá-las num projeto Supabase e repetir os testes manuais da
seção 7 é pré-requisito de qualquer deploy — registrado como D1 no backlog.

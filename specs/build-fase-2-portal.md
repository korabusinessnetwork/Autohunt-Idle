# Spec de execução: Build da Fase 2 (distribuição em portal)

*(spec de **build**. Traduz a Fase 2 do roadmap — "publicar o MVP num portal, validação com
jogador real, não hipótese" (`memory/identity.md`) — no que dá para construir e auditar.)*

- **Docs de origem:** `docs/01_ARQUITETURA/publicacao-portais.md`, `memory/restrictions.md`
- **Depende de:** `specs/build-fase-1-mvp.md` (concluído e revisado)
- **Data:** 2026-08-11
- **Rodada do loop:** 2ª (`/spec` → `/build` → `/review`)

---

## 1. Escopo

Deixar o MVP tecnicamente publicável num portal, com a camada de portal isolada atrás de
interfaces — de modo que trocar de canal (ou rodar em domínio próprio) seja configuração, não
reescrita. Alvo primário: **CrazyGames Basic Launch**, que segundo
`docs/01_ARQUITETURA/publicacao-portais.md` **não exige SDK nem monetização** e portanto é o
único caminho de validação com jogador real que não depende de nenhuma decisão pendente.

Cobre: orçamento de tamanho do build, artefato com caminhos relativos, resiliência de
armazenamento (modo incógnito e iframe de terceiro), adapters de SDK de portal atrás da
`ProvedorAnuncio` já existente, eventos de ciclo de vida, e um modo de canal que garante zero
elemento de compra onde o portal proíbe.

## 2. Fora de escopo

- **A submissão em si** — é ato do dono (conta, formulário, dado fiscal), não código
- **Assinatura / qualquer IAP** — proibido na Poki e restrito a convite + Xsolla na CrazyGames
  (`memory/restrictions.md`). Continua desligado
- **Full Launch da CrazyGames e o SDK obrigatório dele** — é por convite, depois de performar no
  Basic Launch. Esta rodada entrega o *adapter*, não a integração validada em produção
- **Arte final** — segue placeholder (D3 do backlog)
- **Tudo da Fase 3** — dungeon, passe, ranking, equipamento, diamante, biomas
- **Resolver o bloqueio de request externo da Poki** — é uma pergunta ao suporte deles (P4), não
  uma tarefa de código

## 3. O conflito que esta rodada NÃO resolve sozinha

`specs/game-idle-farm-core.md`, critério 7:

> Conclusão de anúncio só é creditada via callback validado do SDK **no servidor** — nenhuma
> rota credita minutos de anúncio direto a partir do client.

O SDK de anúncio recompensado da Poki e o da CrazyGames são **client-side**: a conclusão volta
como uma promise/callback no navegador. Nenhum dos dois oferece confirmação servidor-a-servidor
para anúncio recompensado. Ou seja, **o critério 7, do jeito que está escrito, é
inimplementável nos dois canais que o produto escolheu.**

Isto não bloqueia esta rodada — Basic Launch não tem anúncio nenhum — mas bloqueia o Full
Launch, e a decisão é de produto. O build entrega a mitigação mais forte possível (seção 5,
critérios 12 a 14) e a decisão fica registrada como pendência explícita, não resolvida no
silêncio.

## 4. Arquivos afetados

```
vite.config.ts                            # base relativa + orçamento
scripts/verificar-orcamento.mjs           # falha o build se dist estourar o teto
src/lib/armazenamento.ts                  # storage à prova de incógnito/iframe
src/lib/supabaseClient.ts                 # passa a usar o storage resiliente
src/lib/i18n/index.ts                     # idem
src/lib/portal/{index.ts,tipos.ts,crazygames.ts,poki.ts,dominioProprio.ts}
src/lib/services/adService.ts             # provedor vem do portal ativo
src/context/SessaoContext.tsx             # eventos de ciclo de vida
src/features/desbloqueio/PainelDesbloqueio.tsx  # respeita a proibição de IAP do canal
docs/08_DECISOES/adr-004-canal-e-credito-de-anuncio.md
docs/01_ARQUITETURA/publicacao-portais.md # atualizado com o que o build fixou
.env.example
```

## 5. Critérios de aceite

### Artefato publicável

1. O build gera artefato com **caminhos relativos** (`base: './'`), funcionando servido de
   subdiretório ou de dentro de um zip — é como os dois portais hospedam.
2. Existe **orçamento de tamanho verificado automaticamente**: `npm run build` falha se o
   download inicial passar de **8 MB** (o teto da Poki, que é o mais apertado dos dois; a
   CrazyGames pede ≤50 MB inicial e ≤250 MB total).
3. O build **não faz nenhuma requisição a CDN externo** — fonte, script ou estilo. Tudo que a
   página precisa sai do próprio artefato. (A Poki bloqueia request externo por padrão; o
   Supabase é a única saída de rede, e é exatamente a que está sob a pendência P4.)
4. O artefato é **16:9 e responsivo dentro de um iframe**, sem barra de rolagem horizontal.

### Armazenamento (o risco silencioso do canal)

5. **Nenhum acesso a `localStorage` acontece fora de `try/catch`.** Em modo incógnito estrito e
   em iframe de terceiro, o acesso pode **lançar exceção** — não apenas devolver `null` —, e hoje
   o código usa `window.localStorage?.getItem`, que protege contra ausência mas não contra erro.
6. Quando o armazenamento persistente não estiver disponível, o jogo **continua jogável** com
   armazenamento em memória: a sessão anônima vale enquanto a aba estiver aberta, e nada
   quebra ou fica em branco.
7. O client do Supabase usa esse mesmo armazenamento resiliente — a sessão anônima é o que
   segura o progresso (core, 17), então ela não pode depender de um `localStorage` que talvez
   nem exista.

### Camada de portal

8. Existe uma **interface de portal** (`src/lib/portal/`) com: nome do canal, se permite compra
   dentro do jogo, provedor de anúncio (ou `null`), e eventos de ciclo de vida
   (`aoCarregarProgresso`, `aoIniciarJogo`, `aoPausarJogo`).
9. Há três implementações: **CrazyGames**, **Poki** e **domínio próprio**. O canal ativo vem de
   `VITE_CANAL`, e o padrão é **domínio próprio** — nenhum SDK de portal carrega sem
   configuração explícita.
10. Nenhum adapter carrega script externo por conta própria: o SDK do portal é injetado pelo
    `index.html` do canal ou já existe na página do portal. Se o SDK não estiver presente, o
    adapter degrada para "sem anúncio" em vez de quebrar o jogo.
11. `gameplayStart` / `gameplayStop` são disparados nos momentos corretos: início quando o
    mundo começa a rodar, pausa quando a aba some ou um painel modal abre por cima do jogo.

### Anúncio e a regra do core

12. O crédito de anúncio **continua exigindo um ticket emitido pelo servidor** e resgatável uma
    única vez — o client nunca diz quantos minutos ganhou, só apresenta o ticket.
13. O resgate client-side (único caminho possível com os SDKs dos portais) fica atrás de uma
    Edge Function que exige autenticação do jogador e **reaplica todos os tetos no servidor**:
    15 min por ticket, 2 h por dia, saldo máximo de 2 h.
14. A exposição residual está **quantificada e documentada em ADR**: o máximo que um jogador
    desonesto consegue é exatamente o que um jogador honesto já ganha de graça — 2 h/dia. O ADR
    fica com status **Proposto**, aguardando decisão do dono; não se declara resolvido.

### Conformidade de canal

15. Quando `VITE_CANAL=poki`, **nenhum elemento de compra ou menção a assinatura paga aparece**
    na interface — a Poki proíbe qualquer elemento de compra, sem exceção.
16. O modo incógnito da Poki é respeitado como consequência dos critérios 5 a 7, não como
    tratamento à parte.

### Qualidade

17. `npm test` e `npm run build` verdes; testes novos cobrem o armazenamento resiliente, a
    seleção de canal e a conformidade de IAP por canal.
18. Nenhum `console.log` esquecido, nenhum segredo hardcodado, nenhum `TODO` sem justificativa.

## 6. Edge cases que o build precisa tratar

- **`localStorage` lança ao ser lido** (incógnito estrito, iframe com storage bloqueado) — o
  jogo abre normalmente, em memória.
- **SDK do portal ausente** na página (teste local, domínio próprio, portal que não carregou) —
  degrada para "sem anúncio", nunca quebra.
- **Anúncio pedido enquanto outro está em exibição** — o adapter recusa o segundo pedido em vez
  de empilhar.
- **Aba escondida durante um anúncio** — o encerramento de sessão ao vivo não pode disparar no
  meio de um `commercialBreak`, senão o jogador perde o crédito.
- **Portal serve o jogo de um caminho com subdiretório** — coberto pelo critério 1.
- **Safari com ITP em iframe de terceiro** — o armazenamento pode ser descartado em ~7 dias. Não
  há o que fazer em código; precisa estar documentado para não virar bug fantasma.

## 7. Definição de "aprovado sem ressalvas"

Os 18 critérios marcados como **sim**, com evidência; `npm test` e `npm run build` verdes com o
orçamento de tamanho passando; o artefato de `dist/` servido de um subdiretório resolve todos os
assets (prova prática do critério 1); e o conflito da seção 3 registrado em ADR com status
**Proposto** — nunca dado como resolvido por conta própria.

---

# Resultado da review — 2026-08-11

`npm test`: **82 passando** (74 → 82 nesta rodada). `npm run build`: **verde**, com o orçamento
de portal em **0,39 MB de 8 MB**.

## Auditoria dos 18 critérios

| # | Veredito | Evidência |
|---|---|---|
| 1 | sim | `vite.config.ts` com `base: './'`; verificado servindo `dist/` de `/jogos/autohunt/` — `index.html` referencia `./assets/…` e os dois assets respondem 200 |
| 2 | sim | `scripts/verificar-orcamento.mjs` roda como etapa do `npm run build` e falha o build ao estourar; hoje reporta `inicial 0.39 MB / 8.00 MB` |
| 3 | sim | varredura de URL no bundle só acha namespace XML e link de documentação em string de erro — nenhuma requisição a CDN |
| 4 | sim | mundo 16:9 escalado e **centralizado**, com a moldura pintada; `ResizeObserver` acompanha o container |
| 5 | sim | `grep localStorage` só encontra `src/lib/armazenamento.ts`, e lá o acesso está dentro de `try` — inclusive o `window.localStorage` em si |
| 6 | sim | `criarArmazenamento` cai para memória; teste "cai para memória quando o storage lança, sem propagar o erro" |
| 7 | sim | `supabaseClient.ts` passa `storage: obterArmazenamento()` para o Auth |
| 8 | sim | `src/lib/portal/tipos.ts` |
| 9 | sim | `resolverCanal` devolve `dominio-proprio` para valor vazio, desconhecido ou com caixa errada — 4 casos testados |
| 10 | sim | testes de degradação sem SDK e o teste que prova que criar portal não cria nenhum `<script>` |
| 11 | sim | `sinalizarJogo` só dispara na transição; `Jogo.tsx` considera painel aberto e tela de retorno como pausa |
| 12 | sim | `assistirAnuncio` pede ticket **antes** de exibir; `farmService.test.ts` prova que o resgate manda só o `ticketId` |
| 13 | sim | `anuncio-resgate` exige `Bearer`, resolve o jogador pelo JWT e chama `resgatar_anuncio_do_jogador`, que reaplica os tetos |
| 14 | sim | ADR-004, com a exposição quantificada em 2h/dia e status **Proposto** |
| 15 | sim | `tituloDoPainel` e `deveAvisarSobreAssinatura` em `regras.ts`, com teste que cobre canal que proíbe compra |
| 16 | sim | consequência dos critérios 5 a 7, como previsto |
| 17 | sim | 82 testes verdes; build verde |
| 18 | sim | nenhum `console.log`, nenhum segredo hardcodado, nenhum `TODO` |

## Corrigido durante a review (3 achados)

1. **O jogo era desenhado no canto do canvas.** A escala 16:9 estava certa, mas sem
   deslocamento de centralização — em qualquer container que não fosse exatamente 16:9, o mundo
   ficava colado no canto superior esquerdo e a área restante ficava transparente. Dentro de um
   iframe de portal isso é a regra, não a exceção. Agora o mundo é centralizado e a moldura é
   pintada.
2. **O canvas só reagia a `resize` de janela.** Um portal redimensiona o iframe e um painel
   abrindo muda o espaço do canvas sem gerar esse evento. Entrou `ResizeObserver`.
3. **A regra de conformidade de compra vivia dentro do JSX**, sem como testar — justamente a
   regra que, se falhar, reprova na revisão da Poki. Extraída para `regras.ts` (pura) com 8
   testes.

## Correção do próprio spec

A seção 7 pedia, como prova do critério 1, que `dist/index.html` abrisse "a partir do sistema de
arquivos". Esse teste está errado: o build usa módulos ES, e o navegador bloqueia módulo
carregado por `file://` — falharia mesmo com os caminhos perfeitos. A verificação correta, e a
que foi feita, é **servir de um subdiretório por HTTP**, que é como os dois portais hospedam. O
texto do spec foi corrigido.

## Precisa da sua decisão

1. **ADR-004 (crédito de anúncio atestado pelo client)** — está **Proposto**, não Aceito. É a
   única forma de existir tier grátis nos dois canais escolhidos, e a exposição é de 2h/dia por
   conta, mas a diferença em relação ao critério 7 do core é real e a decisão é sua.
2. **P4 — a Poki bloqueia chamada ao Supabase?** Continua sem resposta. O adapter da Poki está
   pronto, mas se a resposta for "bloqueia", ele não salva nada: a arquitetura inteira não cabe
   naquele canal.
3. **Qual canal submeter primeiro.** A leitura do próprio
   `docs/01_ARQUITETURA/publicacao-portais.md` e desta rodada apontam CrazyGames: o Basic Launch
   não exige SDK nem monetização, então dá para validar retenção com jogador real **sem depender
   de nenhuma das decisões acima**.

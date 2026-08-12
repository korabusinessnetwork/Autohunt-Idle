# 09 — BACKLOG · Autohunt Idle

> Features, bugs, MVP, runbooks, handoffs — tudo que está por fazer ou orientar.

## O que vive aqui

- **Features**: roadmap, user stories, acceptance criteria, prioridade
- **Bugs**: conhecidos, triagem, severidade, status
- **MVP**: escopo inicial, o que não entra v1, o que é "nice to have"
- **Runbooks**: "como fazer X", procedimentos operacionais, troubleshooting
- **Handoffs**: documentação para passar projeto/feature para outra pessoa
- **Dívida técnica**: refatoração, performance, segurança (registra, não ignora)

## O que NÃO vive aqui

- Código → `src/`
- Decisões formalizadas → `08_DECISOES/`
- Arquitetura → `01_ARQUITETURA/`
- Regras de negócio → `03_REGRAS_DE_NEGOCIO/`

## Arquivos sugeridos

- `features.md` — features planejadas, prioridade, esforço estimado, dono
- `bugs.md` — bugs conhecidos, status (aberto/em andamento/fechado), severity
- `mvp.md` — escopo de lançamento, o que entra/não entra v1
- `runbook-deploy.md` — procedimento passo-a-passo de deploy
- `runbook-incident.md` — como responder a incidente, escalação
- `handoff-para-equipe.md` — documentação técnica para transferência

## Como preencher

1. **MVP vem primeiro**: defina escopo de lançamento, o que espera para v1.1
2. **Features têm critério de aceitação**: como sabe quando está pronto?
3. **Bugs nunca morrem em silêncio**: registra, marca severidade/prioridade
4. **Runbooks salvam vidas**: procedimentos críticos, documentados, testados
5. **Dívida técnica é legítima**: registra, marca como "tech debt", prioriza
6. **Nada zumbi**: conteúdo vivo ou marcado obsoleto/posposto — zero ambiguidade

## Ligações

- Ferramenta de gestão (GitHub Issues, Jira, Linear) — puxe dados daqui pro backlog
- `memory/roadmap.md` — roadmap de produto (visão 3–6 meses)
- `05_FLUXOS/` — fluxos que features implementam

---

## Pendências abertas do build da Fase 1 (2026-08-11)

Registradas aqui para não morrerem em silêncio. Nenhuma delas bloqueou o build; todas
bloqueiam o *lançamento*.

### Precisam de decisão do dono

| # | Pendência | Por que precisa de você |
|---|---|---|
| P1 | **Confirmação de e-mail no Supabase Auth** | Com "Confirm email" ligada, `auth.users.email` só é preenchido depois que o jogador clica no link — o cadastro fica pendente até lá. O código já lida com isso (o gate usa `identidadeVerificada`, que a data de nascimento imutável garante), mas a escolha entre *exigir confirmação* (mais seguro contra e-mail digitado errado) e *dispensar* (menos fricção, alinhado ao Princípio nº1) é de produto. |
| P2 | **Provedor de anúncio recompensado** | Nenhum plugado. A escolha depende do canal, que está em aberto (`memory/restrictions.md`: Poki proíbe IAP, CrazyGames exige Xsolla e é por convite). Sem provedor, o botão de anúncio aparece desabilitado com o motivo — ou seja, **não-assinante não tem nenhuma forma de farm offline hoje**. |
| P7 | **Passe comprável com diamante?** | Hoje o passe só é ativável por webhook de gateway, que não existe (P3) — ou seja, **ninguém consegue comprá-lo**. Vender por diamante o tornaria alcançável já, e o diamante cai de graça em dungeon. Mas muda o desenho de monetização (o passe deixaria de ser receita nova e viraria sink de diamante), então é decisão sua, não minha. |
| P3 | **Gateway de pagamento** | Stripe/Asaas decididos no papel, nenhuma conta contratada. Também segura o passe: `ativar_passe` existe e é exclusiva de `service_role`, esperando webhook. Sem gateway não existe assinante, e sem assinante os critérios 4 e 4a do core (24h + 2x XP) existem no código mas nunca são exercitados por um jogador real. Também segura a compra de diamante com dinheiro: a RPC `creditar_diamante` já existe e é exclusiva de `service_role`, mas nada a chama enquanto não houver webhook assinado de um provedor. |
| ~~P5~~ | ~~**Fortificação de item por RNG**~~ — **decidida em 2026-08-11**, sai da lista de pendências | Custa ouro (loja vende ouro por diamante em quantidade fixa), e falhar só gasta o material, sem rebaixar o item. `specs/fortificacao-de-item.md` está buildável assim que equipamento existir. |
| P6 | **Preço da fortificação em ouro é condição de compliance, não só de diversão** | Os dois caminhos existem desde 2026-08-11 (dungeon dá diamante; diamante compra ouro em quantidade fixa). O que continua em aberto é a **calibragem**: se o custo for alto o bastante para forçar a compra, o caminho gratuito vira fachada e a estrutura volta a ser recompensa aleatória paga. Precisa ser revisado quando houver dado de quanto ouro um jogador ganha por hora. |
| P4 | **Poki bloqueia chamada ao Supabase?** | Restrição já registrada em `memory/restrictions.md` com a instrução "confirmar com a Poki **antes do build**". Não foi confirmada. Se a resposta for "bloqueia", a arquitetura inteira (SPA + BaaS direto) não cabe naquele canal — é a pendência de maior impacto da lista. |

### Dívida técnica assumida

| # | Item | Detalhe |
|---|---|---|
| ~~D1~~ | ~~**Migrations nunca executadas**~~ — **resolvido em 2026-08-11** | As 10 migrations agora aplicam contra um Postgres 16 de verdade, e um teste de fumaça exercita a lógica do jogo ponta a ponta: `./scripts/pg-local.sh`. Continua valendo uma ressalva menor: o stub reproduz `auth.users` e `auth.uid()`, então **RLS não é exercitada por um JWT real** — isso só num projeto Supabase. |
| D2 | **`signInAnonymously` precisa estar habilitado** | É pré-requisito do critério 17. Desabilitado, o jogo cai na tela de erro com retry (que existe e é legível), mas ninguém joga. |
| D3 | **Arte é placeholder** | O brief foi ao Claude Design e os assets não voltaram. O jogo desenha silhuetas geométricas na paleta oficial; a camada de sprite está isolada em `src/game/sprites.ts` para troca sem tocar em motor/mundo. |
| D4 | **Balanceamento é chute fundamentado** | Ciclo de 15s, 3 abates/ciclo, curva de XP `50·(n-1)·n`, derrota a cada ~11 ciclos. Números escolhidos para o sistema ficar observável e testável, não para ser divertido. Balancear com dado de jogador real é trabalho da Fase 2. |
| D5 | **Docs 03, 04, 05 e 06 seguem vazios** | Regras de negócio, modelagem, fluxos e componentes continuam com o README de esqueleto. **A doc 07 (APIs) saiu desta lista em 2026-08-11** — e escrevê-la revelou um furo de segurança real, ver D14. O schema e o contrato das RPCs existem em código e nas migrations, mas ainda não foram espelhados na documentação — e `CLAUDE.md` diz que a documentação é que prevalece. **Correção de 2026-08-11:** a doc 11 estava indevidamente nesta lista. `docs/11_SEGURANCA/README.md` não é esqueleto — são 97 linhas de plano real vindas da fundação. O problema dela é outro, e está em D9. |
| ~~D9~~ | ~~**O plano de segurança precede o sistema que ele deveria cobrir**~~ — **resolvido em 2026-08-11** | `docs/11_SEGURANCA/` foi consolidado: 53 ameaças em 10 superfícies, 43 delas com o nome do teste que reprova o build se a proteção sumir. O checklist não tem mais item de fé. Ficou uma ressalva menor, registrada como D11: 4 ameaças seguem ABERTAS, e nenhuma depende de código — esperam decisão do dono ou serviço contratado. |
| D6 | **`recomputar_ranking()` precisa de um agendador** | A função existe e é revogada do client, mas nada a chama ainda. Falta ligar o `pg_cron` no projeto Supabase (extensão gratuita, roda dentro do Postgres — não fere a restrição de "sem processo persistente"). Sem isso o placar só se atualiza quando alguém define um apelido. |
| D8 | **Mercado P2P: destravado sob condições, ainda não construído** | O plano específico que `memory/restrictions.md` exigia **existe desde 2026-08-11**: `docs/11_SEGURANCA/plano-mercado-p2p.md`. Ele autoriza a construção **sob 6 condições de entrada** (seção 7 do plano), e a nº 1 é bloqueio real: **termo de uso revisado por advogado e publicado** — único item sem alternativa gratuita. As outras cinco são decisões do dono (mercado cego × aberto, faixa de preço), P4, e uma spec de execução própria. |
| D10 | **Log de atividade aceita `jsonb` livre do client** | `evento_jogo` tem `grant insert` para `authenticated`, com `dados` em `jsonb` sem esquema. Não credita nada (não é vetor de trapaça), mas nada impede um `tipo` novo carregar dado pessoal, nem um script inflar a tabela. Convenção documentada, sem teste — ameaças 8.6 e §10 do modelo. |
| D11 | **5 ameaças seguem ABERTAS, nenhuma por falta de código** | RLS sob JWT real (só num Supabase de verdade), calibragem do preço da fortificação (P6), calibragem da trilha do passe, webhook de gateway (P3) e replay de callback de anúncio (P2). Listadas com impacto em `docs/11_SEGURANCA/README.md`. |
| D12 | **A trilha do passe é 11/12 placeholder** | `specs/passe-de-recompensas.md` confirma só a skin exclusiva e diz que o resto é placeholder. Os outros onze prêmios e a curva de pontos (100 → 10.000, um ponto por ciclo) são chute fundamentado, como D4. **A trilha é tabela**, então rebalancear é `update` em `passe_recompensa`, não migration. |
| ~~D14~~ | ~~**Superfície de sorteio alcançável pelo client**~~ — **resolvido em 2026-08-11** | `sorteio01` e `farm_state.contador_sorteio` estavam ao alcance de `authenticated`, o que tornava o loot previsível e permitia re-rolar queimando o contador numa ação barata. Nenhuma das duas era um GRANT: eram ausências de revoke, porque o Postgres concede EXECUTE a PUBLIC por padrão. Fechado na migration `20260823` (tempero de servidor no RNG, `alter default privileges` invertendo o padrão, e o contador fora do grant). Ver `docs/07_APIS/` §6. |
| D13 | **A dungeon não herda o tema do bioma — porque não tem cena** | Critério 4 de `specs/mapa-mundo-e-dungeon.md`. A dungeon é resolvida por RPC e devolve o resultado pronto; não existe tela para tematizar, então guardar o bioma na chave hoje seria dado sem consumidor. Quando houver cena: `item_jogador` (tipo `chave`) precisa de coluna de bioma, preenchida em `conceder_item`, e `resolver_uma_dungeon` precisa devolvê-la. |
| D7 | **Fase 3 está sendo construída sem o dado da Fase 2** | O roadmap condiciona a Fase 3 ao que a validação com jogador real mostrar. A construção começou antes disso, por decisão do dono, em ordem de dependência — o risco de construir sistema que o dado não justifique está aceito e registrado aqui. |

### Decisões tomadas por padrão, reversíveis

Ficam listadas para não virarem regra por esquecimento. Todas estavam marcadas como "a definir"
nas specs de origem.

| # | Decisão | Origem | Como reverter |
|---|---|---|---|
| R1 | Desempate no ranking: maior XP total, depois quem chegou primeiro | `specs/ranking-global.md`, edge cases | trocar o `order by` de `recomputar_ranking()` |
| R2 | ~~Apelido duplicado é permitido~~ → **revertido pelo dono em 2026-08-11**: apelido é único (sem diferenciar maiúscula) **e exige cadastro**. Conta anônima joga normal, só não entra no placar | `specs/ranking-global.md`, edge cases | remover o índice `jogador_apelido_unico` e o gate `identidade_verificada` em `definir_apelido` |
| R3 | Auto-alocação desliga no primeiro respec manual | não estava na spec; sem isso ela desfaria a escolha do jogador | coluna `atributo_jogador.auto_alocar` |

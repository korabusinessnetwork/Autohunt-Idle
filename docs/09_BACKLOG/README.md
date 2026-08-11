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
| P3 | **Gateway de pagamento** | Stripe/Asaas decididos no papel, nenhuma conta contratada. Sem gateway não existe assinante, e sem assinante os critérios 4 e 4a do core (24h + 2x XP) existem no código mas nunca são exercitados por um jogador real. |
| P5 | **Fortificação de item por RNG** (`specs/fortificacao-de-item.md`) | Pedido em 2026-08-11. Esbarra em duas regras registradas: pedra comprável com diamante seria recompensa aleatória paga (restrição CRÍTICA, ECA Digital), e falha que rebaixa o item contradiz "progresso nunca é punido" — o mesmo princípio que já cortou o permadeath. A spec está escrita com as duas opções; falta você escolher. |
| P4 | **Poki bloqueia chamada ao Supabase?** | Restrição já registrada em `memory/restrictions.md` com a instrução "confirmar com a Poki **antes do build**". Não foi confirmada. Se a resposta for "bloqueia", a arquitetura inteira (SPA + BaaS direto) não cabe naquele canal — é a pendência de maior impacto da lista. |

### Dívida técnica assumida

| # | Item | Detalhe |
|---|---|---|
| D1 | **Migrations nunca executadas** | O SQL foi escrito e auditado *estruturalmente* por teste (`src/lib/contratoRpc.test.ts`), mas não rodou contra um Postgres. Antes de qualquer deploy: aplicar as duas migrations num projeto Supabase e repetir os testes manuais da seção "aprovado sem ressalvas" de `specs/build-fase-1-mvp.md`. |
| D2 | **`signInAnonymously` precisa estar habilitado** | É pré-requisito do critério 17. Desabilitado, o jogo cai na tela de erro com retry (que existe e é legível), mas ninguém joga. |
| D3 | **Arte é placeholder** | O brief foi ao Claude Design e os assets não voltaram. O jogo desenha silhuetas geométricas na paleta oficial; a camada de sprite está isolada em `src/game/sprites.ts` para troca sem tocar em motor/mundo. |
| D4 | **Balanceamento é chute fundamentado** | Ciclo de 15s, 3 abates/ciclo, curva de XP `50·(n-1)·n`, derrota a cada ~11 ciclos. Números escolhidos para o sistema ficar observável e testável, não para ser divertido. Balancear com dado de jogador real é trabalho da Fase 2. |
| D5 | **Docs 03, 04, 05, 06, 07 e 11 seguem vazios** | Regras de negócio, modelagem, fluxos, componentes, APIs e o plano de segurança continuam com o README de esqueleto. O schema e o contrato das RPCs existem em código e nas migrations, mas ainda não foram espelhados na documentação — e `CLAUDE.md` diz que a documentação é que prevalece. |
| D6 | **`recomputar_ranking()` precisa de um agendador** | A função existe e é revogada do client, mas nada a chama ainda. Falta ligar o `pg_cron` no projeto Supabase (extensão gratuita, roda dentro do Postgres — não fere a restrição de "sem processo persistente"). Sem isso o placar só se atualiza quando alguém define um apelido. |
| D7 | **Fase 3 está sendo construída sem o dado da Fase 2** | O roadmap condiciona a Fase 3 ao que a validação com jogador real mostrar. A construção começou antes disso, por decisão do dono, em ordem de dependência — o risco de construir sistema que o dado não justifique está aceito e registrado aqui. |

### Decisões tomadas por padrão, reversíveis

Ficam listadas para não virarem regra por esquecimento. Todas estavam marcadas como "a definir"
nas specs de origem.

| # | Decisão | Origem | Como reverter |
|---|---|---|---|
| R1 | Desempate no ranking: maior XP total, depois quem chegou primeiro | `specs/ranking-global.md`, edge cases | trocar o `order by` de `recomputar_ranking()` |
| R2 | ~~Apelido duplicado é permitido~~ → **revertido pelo dono em 2026-08-11**: apelido é único (sem diferenciar maiúscula) **e exige cadastro**. Conta anônima joga normal, só não entra no placar | `specs/ranking-global.md`, edge cases | remover o índice `jogador_apelido_unico` e o gate `identidade_verificada` em `definir_apelido` |
| R3 | Auto-alocação desliga no primeiro respec manual | não estava na spec; sem isso ela desfaria a escolha do jogador | coluna `atributo_jogador.auto_alocar` |

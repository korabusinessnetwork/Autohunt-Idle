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
| ~~P1~~ | ~~**Confirmação de e-mail no Supabase Auth**~~ — **decidida em 2026-08-12: desligada**, sai da lista de pendências | A decisão vale para o desenvolvimento, e é reversível num botão. Volta à mesa antes do lançamento público — o checklist de release §3 é quem a traz de volta, para a escolha não virar padrão por esquecimento. Justificativa abaixo, mantida porque é o que se reavalia lá: |
| | | Com "Confirm email" ligada, `auth.users.email` só é preenchido depois que o jogador clica no link — o cadastro fica pendente até lá. O código já lida com isso (o gate usa `identidadeVerificada`, que a data de nascimento imutável garante), mas a escolha entre *exigir confirmação* (mais seguro contra e-mail digitado errado) e *dispensar* (menos fricção, alinhado ao Princípio nº1) é de produto. |
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
| ~~D3~~ | ~~**Arte é placeholder**~~ — **resolvido em 2026-08-12** | Os assets voltaram (302 PNGs, 9 levas, escala 8) e entraram pelo `src/game/atlas.ts`. A aposta de isolar a camada de sprite se pagou: **`motor.ts` não mudou uma linha**, e `mundo.ts` só ganhou temporizadores de pose. As silhuetas geométricas continuam no código como fallback do carregamento — o jogo abre mesmo sem a arte. Ver `specs/build-fase-3j-arte-real.md` e `docs/02_DESIGN_SYSTEM/inventario-de-arte.md`. Sobraram duas ressalvas, registradas como D16 e D17. |
| D16 | **A arte não cobre 4 dos 7 slots, nem as pedras** | Capacete, armadura, luva e bota não têm ícone por raridade no pacote entregue — usam o ícone de slot, sem escalada visual de tier. As três pedras não têm ícone nenhum (`arteDoItem` devolve `null` e a interface mostra o rótulo de texto). Também: as skins vieram numa **pose só**, então equipar uma skin desliga as três poses do personagem base. Nenhuma delas quebra tela; todas são pedido para a próxima rodada de arte, não código. |
| D17 | **As telas da leva 3 nunca foram entregues** | A rodada 2 do brief pediu três telas — "bem-vindo de volta" (nos dois estados), inventário e mercado — e o pacote trouxe **só ícones soltos**, pela segunda vez. As telas seguem sendo React puro, o que não bloqueia nada, mas **o momento mais importante do produto continua sem direção de arte própria** (`CLAUDE.md`, Princípio nº1: "a tela de retorno é o momento mais importante do produto"). É pedido de arte, não dívida de código. |
| D4 | **Balanceamento é chute fundamentado** — *e agora editável sem migration* | Ciclo de 15s, 3 abates/ciclo, curva de XP `50·(n-1)·n`, derrota a cada ~11 ciclos. Números escolhidos para o sistema ficar observável e testável, não para ser divertido. **Mudou em 2026-08-12:** o console de ajuste tirou 16 destes números do código e os pôs na tabela `ajuste`, com faixa e descrição — rebalancear virou `update`, não migration. O que **não** mudou é o essencial: continua sendo chute meu até existir dado de jogador real. A ferramenta encurtou o ciclo de correção; ela não sabe qual é o número certo. |
| ~~D5~~ | ~~**Docs de arquitetura vazias**~~ — **resolvido em 2026-08-11** | As docs 03 (regras de negócio), 04 (modelagem), 05 (fluxos), 06 (componentes) e 07 (APIs) saíram do esqueleto. As 04 e 07 foram escritas auditando o **banco vivo**, não o texto das migrations — e foi assim que o furo da superfície de sorteio apareceu (D14). Sobrou uma dívida menor, registrada como D15: documentação não tem teste que a impeça de envelhecer, exceto o espelho de regra. **Correção de 2026-08-11:** a doc 11 esteve indevidamente nesta lista; ela nunca foi esqueleto, e o problema dela era outro (D9). |
| ~~D9~~ | ~~**O plano de segurança precede o sistema que ele deveria cobrir**~~ — **resolvido em 2026-08-11** | `docs/11_SEGURANCA/` foi consolidado: 53 ameaças em 10 superfícies, 43 delas com o nome do teste que reprova o build se a proteção sumir. O checklist não tem mais item de fé. Ficou uma ressalva menor, registrada como D11: 4 ameaças seguem ABERTAS, e nenhuma depende de código — esperam decisão do dono ou serviço contratado. |
| D15 | **A documentação pode envelhecer sem quebrar nada** | As docs 03 a 07 descrevem o código de hoje, e `CLAUDE.md` diz que a documentação prevalece sobre o código quando os dois conflitam. Só uma parte é verificada: `espelhoDeRegra.test.ts` reprova o build se um número da doc 03 divergir do servidor. O resto — inventário de tabelas, lista de painéis, fluxos — depende de alguém lembrar de atualizar. Fechar de vez exigiria gerar a doc a partir do schema, o que é trabalho próprio. |
| D6 | **`recomputar_ranking()` precisa de um agendador** | A função existe e é revogada do client, mas nada a chama ainda. Falta ligar o `pg_cron` no projeto Supabase (extensão gratuita, roda dentro do Postgres — não fere a restrição de "sem processo persistente"). Sem isso o placar só se atualiza quando alguém define um apelido. |
| D8 | **Mercado P2P: destravado sob condições, ainda não construído** | **Atualizado em 2026-08-12:** o rastro obrigatório do §4.6 já tem onde aparecer — a aba de log do console foi construída antes do mercado, e `mercado.comprado` entra nela sem código de interface novo. A **escrita** do rastro nasce dentro da RPC do trade, na mesma transação, nunca como fase posterior. O plano específico que `memory/restrictions.md` exigia **existe desde 2026-08-11**: `docs/11_SEGURANCA/plano-mercado-p2p.md`. Ele autoriza a construção **sob 6 condições de entrada** (seção 7 do plano), e a nº 1 é bloqueio real: **termo de uso revisado por advogado e publicado** — único item sem alternativa gratuita. As outras cinco são decisões do dono (mercado cego × aberto, faixa de preço), P4, e uma spec de execução própria. |
| D10 | **Log de atividade aceita `jsonb` livre do client** | `evento_jogo` tem `grant insert` para `authenticated`, com `dados` em `jsonb` sem esquema. Não credita nada (não é vetor de trapaça), mas nada impede um `tipo` novo carregar dado pessoal, nem um script inflar a tabela. Convenção documentada, sem teste — ameaças 8.6 e §10 do modelo. |
| D11 | **5 ameaças seguem ABERTAS, nenhuma por falta de código** | RLS sob JWT real (só num Supabase de verdade), calibragem do preço da fortificação (P6), calibragem da trilha do passe, webhook de gateway (P3) e replay de callback de anúncio (P2). Listadas com impacto em `docs/11_SEGURANCA/README.md`. |
| D12 | **A trilha do passe é 11/12 placeholder** | `specs/passe-de-recompensas.md` confirma só a skin exclusiva e diz que o resto é placeholder. Os outros onze prêmios e a curva de pontos (100 → 10.000, um ponto por ciclo) são chute fundamentado, como D4. **A trilha é tabela**, então rebalancear é `update` em `passe_recompensa`, não migration. |
| ~~D14~~ | ~~**Superfície de sorteio alcançável pelo client**~~ — **resolvido em 2026-08-11** | `sorteio01` e `farm_state.contador_sorteio` estavam ao alcance de `authenticated`, o que tornava o loot previsível e permitia re-rolar queimando o contador numa ação barata. Nenhuma das duas era um GRANT: eram ausências de revoke, porque o Postgres concede EXECUTE a PUBLIC por padrão. Fechado na migration `20260823` (tempero de servidor no RNG, `alter default privileges` invertendo o padrão, e o contador fora do grant). Ver `docs/07_APIS/` §6. |
| D13 | **A dungeon não herda o tema do bioma — porque não tem cena** | Critério 4 de `specs/mapa-mundo-e-dungeon.md`. A dungeon é resolvida por RPC e devolve o resultado pronto; não existe tela para tematizar, então guardar o bioma na chave hoje seria dado sem consumidor. Quando houver cena: `item_jogador` (tipo `chave`) precisa de coluna de bioma, preenchida em `conceder_item`, e `resolver_uma_dungeon` precisa devolvê-la. |
| D18 | **O espelho de regra deixou de prever o crédito** | `regrasFarm.ts` espelhava as constantes de `resolver_ciclos`; elas agora vêm da tabela `ajuste`, e os valores econômicos vigentes **não chegam ao client de propósito**. O espelho passou a espelhar o *padrão semeado*, verificado por teste. Consequência: se o dono ajustar XP por abate, o espelho deixa de bater com o crédito. Não aparece para ninguém hoje (essas funções só são usadas nos próprios testes), mas quem for usá-las em previsão de tela precisa saber — e a saída, se um dia precisar, é publicar os econômicos como somente-leitura no snapshot, não recalcular no client. |
| ~~D22~~ | ~~**O ambiente de teste local aprovava o que o Supabase reprova**~~ — **resolvido em 2026-08-12** | `scripts/stub-supabase.sql` criava os três papéis do Supabase mas não reproduzia as *default privileges* — e num projeto real todo objeto novo em `public` já nasce concedido a `anon` e `authenticated`. Consequência: um `revoke` esquecido virava no-op invisível na suíte local. Custou duas concessões reais (`public.ajuste` com ALL, `emitir_ticket_auto()` alcançável por `anon`), achadas por `scripts/conferir-supabase.sql` contra o banco de verdade. Corrigido na migration `20260827` + stub fiel + varredura por tabela. **A crença que fica:** a suíte local prova lógica, não configuração de papéis. |
| D20 | **O log operacional é forense, não preventivo** | A aba de log do console (2026-08-12) mostra tudo que move valor ou muda configuração, com lista fechada de tipos. O que ele **não** faz: alertar. Ninguém é avisado quando um ajuste econômico muda ou quando um padrão estranho aparece — é preciso abrir e olhar. Alerta exigiria um processo persistente ou um agendador, e o `pg_cron` que já falta para o ranking (D6) seria o lugar natural quando houver para onde notificar. |
| D21 | **`console.log_recusado` pode ser inflado por chamada direta** | A tela não pede o log para quem não é admin, então abrir a URL não gera linha. Uma chamada direta e repetida à RPC ainda gera uma linha por chamada — mesma família de D10 (ausência de rate limit por jogador). Não credita nada e não vaza nada; é custo e ruído. |
| D23 | **Cadastro anônimo sem captcha** | O aviso é do próprio painel do Supabase, na hora de habilitar `signInAnonymously` (D2): sem captcha, um script cria contas em massa. **Não vaza nada** — cada conta enxerga só a própria linha, e a RLS não muda por a conta ser anônima. O custo é outro: incha o banco e **cada conta conta como MAU**, que é exatamente a métrica que o plano gratuito limita. Enquanto o jogo é privado o risco é teórico; ele passa a ser real no minuto em que a URL for pública. A saída é gratuita (hCaptcha e Turnstile têm plano free), então não esbarra na restrição de custo — é só configuração de painel, e está no checklist de release §3. |
| D19 | **Nada detecta uso indevido de uma sessão legítima de admin** | Ameaça 12.9. Toda alteração de balanceamento fica registrada em `evento_jogo` com autor, horário e de-para, mas o log é forense: ele conta o que aconteceu, não impede. Não há segunda pessoa para aprovar nem 2FA dentro do jogo — é conta única de produto single-tenant. A mitigação real é operacional (2FA no Supabase), já no checklist de release. |
| D7 | **Fase 3 está sendo construída sem o dado da Fase 2** | O roadmap condiciona a Fase 3 ao que a validação com jogador real mostrar. A construção começou antes disso, por decisão do dono, em ordem de dependência — o risco de construir sistema que o dado não justifique está aceito e registrado aqui. |

### Decisões tomadas por padrão, reversíveis

Ficam listadas para não virarem regra por esquecimento. Todas estavam marcadas como "a definir"
nas specs de origem.

| # | Decisão | Origem | Como reverter |
|---|---|---|---|
| R1 | Desempate no ranking: maior XP total, depois quem chegou primeiro | `specs/ranking-global.md`, edge cases | trocar o `order by` de `recomputar_ranking()` |
| R2 | ~~Apelido duplicado é permitido~~ → **revertido pelo dono em 2026-08-11**: apelido é único (sem diferenciar maiúscula) **e exige cadastro**. Conta anônima joga normal, só não entra no placar | `specs/ranking-global.md`, edge cases | remover o índice `jogador_apelido_unico` e o gate `identidade_verificada` em `definir_apelido` |
| R3 | Auto-alocação desliga no primeiro respec manual | não estava na spec; sem isso ela desfaria a escolha do jogador | coluna `atributo_jogador.auto_alocar` |
| R4 | Duração do ciclo e o 2× do assinante ficaram **fora** do console | `specs/console-de-ajuste.md` §6 | a duração é a unidade de contabilidade do `last_seen_at` (três funções de sessão fazem aritmética de resto com ela), e `abates_base` já dá o mesmo efeito; o 2× é o que o assinante comprou, e mexer nele mudaria o que já foi vendido |
| R5 | Admin é um booleano, concedido só por `update` manual no SQL editor | `specs/console-de-ajuste.md` §3 | qualquer fluxo de promoção dentro do jogo é um fluxo explorável. Reverter seria criar esse fluxo — e aí a coluna `admin` precisaria de proteção própria, que hoje ela ganha de graça por estar fora do grant |

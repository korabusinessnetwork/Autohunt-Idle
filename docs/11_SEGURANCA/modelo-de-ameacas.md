# Modelo de ameaças — Autohunt Idle

> Reconciliado com o código em **2026-08-11**, contra 13 migrations e 45+ funções.
> Superfície 10 (passe) acrescentada na 9ª rodada; ameaça 9.8 (bioma) na 10ª; 5.1b e a
> correção de 5.2 na 11ª.
> Ver `docs/11_SEGURANCA/README.md` para os princípios, e `checklist-de-release.md` para o que
> rodar antes de publicar.

## Como ler este documento

Cada ameaça tem um **estado**, e o estado é uma afirmação verificável:

| Estado | Significa |
|---|---|
| **FECHADA** | Existe um teste que reprova o build se a proteção sumir. O nome do teste está na linha. |
| **MITIGADA** | O código protege, mas nada impede alguém de desfazer sem quebrar teste. |
| **ABERTA** | Não está protegida hoje. A linha diz o que falta. |

Nenhuma ameaça é marcada FECHADA por inspeção visual. Se não dá para citar o teste, não está
fechada — e essa regra é o que separa este documento da versão anterior dele.

Os testes citados vivem em três lugares:
- **`src/lib/contratoRpc.test.ts`** — audita o *texto* do SQL de todas as migrations. `npm test`.
- **`src/lib/superficieDoClient.test.ts`** — audita o que vai parar no navegador. `npm test`.
- **`scripts/teste-migrations.sql`** — *executa* contra um Postgres 16 real, via
  `./scripts/pg-local.sh`. Cada rótulo citado é um `checar()` que derruba o script se falhar.

---

## 1. Superfície: cálculo de farm offline

**É a superfície mais valiosa do produto.** Quem forja tempo decorrido ganha progresso infinito, e
a economia inteira do jogo depende dela.

| # | Ameaça | Estado | Prova |
|---|---|---|---|
| 1.1 | Client declara quanto tempo ficou fora | **FECHADA** | `as RPCs que creditam valor não aceitam parâmetro nenhum` — a lista inclui `iniciar_sessao`, `validar_lote`, `encerrar_sessao`, `coletar_farm_offline`, `emitir_ticket_anuncio`, e o teste exige assinatura literalmente vazia |
| 1.2 | Uma RPC futura reabre a brecha com um parâmetro "inofensivo" | **FECHADA** | `nenhuma RPC do jogador aceita parâmetro de tempo ou de recompensa` — bloqueia `timestamp`, `agora`, `now`, `tempo`, `minuto`, `hora`, `duracao`, `_xp`, `moeda`, `recompensa`, `abate`, `nivel`, `saldo` em qualquer função concedida a `authenticated` |
| 1.3 | Relógio do client adiantado muda o resultado | **FECHADA** | `o tempo do cálculo vem sempre de now() do Postgres` — exige `extract(epoch from (now() - v_fs.last_seen_at))` |
| 1.4 | Reconexão rápida credita o mesmo intervalo duas vezes | **FECHADA** | `reconexão imediata não credita o mesmo intervalo de novo` (fumaça) — `last_seen_at` avança na mesma instrução que credita |
| 1.5 | Client chama a função interna de crédito direto | **FECHADA** | `as funções internas de loot são exclusivas do servidor` — `creditar_ciclos`, `resolver_drops`, `conceder_item`, `resolver_uma_dungeon`, `resolver_dungeons` revogadas de `public, anon, authenticated` |
| 1.6 | Sequestro de resolução de nome numa função que roda como dono | **FECHADA** | `as RPCs de sessão e farm são SECURITY DEFINER` — exige também `set search_path` em cada uma |
| 1.7 | Client escreve progressão direto na tabela | **FECHADA** | `o jogador não recebe UPDATE em coluna de progressão` (contrato) + `authenticated não escreve jogador.%s` (fumaça) para `nivel`, `xp_total`, `moeda`, `vitalidade_atual`, `apelido` |

## 2. Superfície: crédito de anúncio recompensado

| # | Ameaça | Estado | Prova |
|---|---|---|---|
| 2.1 | Client alega ter assistido anúncio sem assistir | **MITIGADA** | `creditar_anuncio` e `resgatar_anuncio_do_jogador` são exclusivas de `service_role` (`as funções que aceitam parâmetro são exclusivas do servidor`). Mas **nenhum provedor está plugado** (P2 do backlog): hoje o callback rejeita tudo, então a ameaça não é exercitável — e também não é testável ponta a ponta |
| 2.2 | Client escolhe quantos minutos recebe | **FECHADA** | `emitir_ticket_anuncio()` tem assinatura vazia; o servidor decide os minutos |
| 2.3 | Replay do callback do provedor | **ABERTA** | O ticket existe e é de uso único, mas a validação de assinatura HMAC do callback depende do provedor escolhido. **Fechar junto com P2.** Ver `ADR-004` |
| 2.4 | Estouro do teto diário de 2h | **FECHADA** | `credita exatamente o saldo de anúncio` e `motivo indica o teto do anúncio` (fumaça) |

## 3. Superfície: assinatura e dinheiro real

| # | Ameaça | Estado | Prova |
|---|---|---|---|
| 3.1 | Client se declara assinante | **FECHADA** | `aplicar_evento_assinatura` revogada de `authenticated`, concedida a `service_role` |
| 3.2 | Cancelar corta o benefício já pago | **FECHADA** | `cancelar mantém o benefício até o fim do período pago` (fumaça) |
| 3.3 | Vazamento da referência do jogador no gateway | **FECHADA** *(fechada nesta rodada)* | `a referência do gateway nunca é concedida ao jogador` — o grant de `assinatura` passou a listar colunas, sem `referencia_externa` nem `provedor` |
| 3.4 | Webhook do gateway forjado | **ABERTA** | Depende de gateway contratado (P3). O *seam* existe (`GATEWAY_WEBHOOK_SECRET` documentado em `.env.example`), a verificação real não |
| 3.5 | Dado de cartão passar pelo nosso código | **FECHADA** | `nenhuma tabela guarda dado de cartão` — o processamento é 100% do gateway, e uma coluna dessas mudaria a classificação do produto para PCI-DSS |

## 4. Superfície: economia de diamante e ouro

Superfície nova, criada na 7ª rodada, e a que mais depende de invariante e menos de vigilância.

| # | Ameaça | Estado | Prova |
|---|---|---|---|
| 4.1 | Diamante vira dinheiro de volta, por qualquer rota | **FECHADA** | `nenhuma rota converte diamante, ouro ou item em dinheiro` — varre o SQL executável por `saque`, `sacar`, `reembolso`, `estorno`, `payout`, `withdraw`, `cash_out`, `transferir_para_jogador`. **É o invariante que sustenta o produto inteiro**, ver `specs/mercado-diamante.md`, nota de design |
| 4.2 | Uma rota nova debita diamante sem entregar ouro | **FECHADA** | `o único débito de diamante do schema é a compra de ouro` — conta as ocorrências e confere que o índice cai dentro de `comprar_ouro` |
| 4.3 | A compra vira recompensa aleatória paga (loot box) | **FECHADA** | `a quantidade de ouro do pacote é fixa, nunca sorteada` — proíbe `random(`, `sorteio01`, `escalar_raridade` e `conceder_item` dentro de `comprar_ouro`. Restrição **CRÍTICA permanente** |
| 4.4 | Duas compras simultâneas com saldo para uma só | **FECHADA** | `for update` na linha do jogador; `compra sem diamante é recusada` e `compra com saldo exato zera o diamante` (fumaça) |
| 4.5 | Saldo de diamante negativo | **FECHADA** | `check (diamante >= 0)`; `o saldo de diamante nunca fica negativo` (fumaça) tenta gravar `-1` e espera `check_violation` |
| 4.6 | Pedra de fortificação virar mercadoria | **FECHADA** | `nenhuma rota vende pedra de fortificação` — pedra é loot, e vendê-la reabriria 4.3 |
| 4.7 | O caminho gratuito virar fachada por calibragem de preço | **ABERTA** | **Não é bug, é balanceamento — e é condição de compliance** (P6). Se o custo em ouro forçar a compra, 4.3 volta a valer na prática mesmo com o código intacto. Só dado de jogador real resolve |

## 5. Superfície: loot, dungeon, equipamento e fortificação

| # | Ameaça | Estado | Prova |
|---|---|---|---|
| 5.1 | Client escolhe a raridade do próprio loot | **FECHADA** | `authenticated NÃO alcança public.conceder_item(...)` e `…escalar_raridade(...)` (fumaça, perguntando ao banco — não ao texto da migration) |
| 5.1b | Função nova nascer alcançável por esquecimento de revoke | **FECHADA** *(11ª rodada)* | `EXECUTE não é mais concedido por omissão` — `alter default privileges in schema public revoke execute on functions from public` inverte o padrão do Postgres, que concedia EXECUTE a PUBLIC em toda função nova. **Foi essa ausência de revoke, e não um grant, que abriu 5.2** |
| 5.2 | Sorteio manipulável ou "re-rolável" | **FECHADA** *(reaberta e refechada na 11ª rodada)* | **Estava ERRADA até 2026-08-11.** O determinismo por si só não fecha nada: com `sorteio01` alcançável e `contador_sorteio` legível, a semente era inteiramente conhecida e o loot, calculável — bastava queimar o contador numa ação barata para re-rolar. Fechada agora por três provas: `a superfície do client é exatamente a lista declarada`, `authenticated não lê farm_state.contador_sorteio` e `authenticated não lê o tempero do RNG`. Ver `docs/07_APIS/` §6 |
| 5.3 | Client declara ter vencido a dungeon | **FECHADA** | `resolver_uma_dungeon` é exclusiva do servidor; `iniciar_dungeon()` não tem parâmetro |
| 5.4 | Consumir a mesma chave duas vezes em chamadas simultâneas | **FECHADA** | `for update skip locked` no `delete` da chave |
| 5.5 | Skin cosmética influenciar número | **FECHADA** | `a resolução de recompensa não conhece skin` — o corpo de `resolver_ciclos` não contém `skin`, `equipado` nem `item_jogador` |
| 5.6 | Falha de fortificação rebaixar item | **FECHADA** | `falhar uma fortificação nunca rebaixa o item` — não existe decremento de `fortificacao` em migration nenhuma; `fortificação nunca cai` (fumaça) roda 40 tentativas |
| 5.7 | Equipar item de outro jogador | **FECHADA** | `equipar_item` confere `player_id = auth.uid()` antes de qualquer escrita |

## 6. Superfície: cadastro, idade e identidade

| # | Ameaça | Estado | Prova |
|---|---|---|---|
| 6.1 | Menor de 18 cria conta | **FECHADA** | `o gate de 18+ é enforcado por trigger, não só pelo formulário` (contrato) + `gate de 18+ bloqueia menor` (fumaça). **Requisito do ECA Digital, Lei 15.211/2025 — não é opcional** |
| 6.2 | Corrigir a data de nascimento depois para burlar o gate | **FECHADA** | `a data de nascimento não pode ser reescrita depois de informada` — trigger levanta `DATA_NASCIMENTO_IMUTAVEL` |
| 6.3 | Data de nascimento falsa | **ACEITA, por proporcionalidade** | Um campo de data validado é o controle proporcional ao risco deste produto. Verificação por documento/biometria é paga e foi adiada — ver `memory/restrictions.md`. **Se o público mudar, reabrir** |
| 6.4 | Personificação por apelido duplicado | **FECHADA** | `o apelido é único, sem diferenciar maiúscula de minúscula` + `apelido é único, ignorando maiúscula` (fumaça). A colisão é decidida pelo índice, não por consulta prévia (`unique_violation` → `APELIDO_EM_USO`) |
| 6.5 | Conta anônima ocupar apelido para sempre | **FECHADA** | `entrar no placar exige identidade permanente` — `definir_apelido` exige `identidade_verificada`; `convidado não deveria entrar no placar` (fumaça) |

## 7. Superfície: isolamento entre jogadores

| # | Ameaça | Estado | Prova |
|---|---|---|---|
| 7.1 | Tabela nova nascer sem RLS | **FECHADA** | `toda tabela criada tem RLS habilitada` (contrato) + `RLS ativa em toda tabela do schema public` (fumaça, varre `pg_class`) |
| 7.2 | Tabela sem política de leitura própria | **FECHADA** | `toda tabela tem ao menos uma policy de leitura própria` |
| 7.3 | Vazamento de `player_id` no placar público | **FECHADA** | grant de coluna em `ranking_posicao` limitado a `apelido, nivel, posicao, atualizado_em` |
| 7.4 | Isolamento multi-tenant confundido com isolamento por jogador | **FECHADA** | `não existe tenant_id em nenhuma instrução (ADR-002)` |
| 7.5 | **RLS não é exercitada por um JWT real** | **ABERTA** | O stub reproduz `auth.uid()` a partir de uma variável de sessão, não de um JWT. A política pode estar sintaticamente certa e semanticamente errada sem ninguém notar. **Só fecha num projeto Supabase de verdade** — vira item de release, ver `checklist-de-release.md` §4 |

## 8. Superfície: dados pessoais (LGPD)

| # | Ameaça | Estado | Prova |
|---|---|---|---|
| 8.1 | Exportar dado de outro jogador | **FECHADA** *(nesta rodada)* | `as RPCs de LGPD não alcançam a conta de outro jogador` — a garantia é a **ausência** do parâmetro: `exportar_meus_dados()` não recebe `player_id`, então não existe chamada capaz de pedir conta alheia. `a exportação não vaza dado de outro jogador` (fumaça) confere o JSON |
| 8.2 | Apagar a conta de outro jogador | **FECHADA** *(nesta rodada)* | Mesma prova; `apagar a própria conta não afeta outro jogador` (fumaça) |
| 8.3 | Exclusão deixar dado órfão | **FECHADA** *(nesta rodada)* | `a exclusão não deixa órfão em %s` percorre as 8 tabelas, inclusive `ranking_posicao`, a única com dado visível a terceiros |
| 8.4 | Exportar ter efeito colateral no progresso | **FECHADA** *(nesta rodada)* | `exportar não credita nem coleta nada` |
| 8.5 | Cobrança seguir após a exclusão | **MITIGADA por aviso** | A assinatura vive no gateway, fora do nosso banco. A UI avisa antes de excluir (`dados.excluir.avisoAssinatura`). **Cancelamento automático depende de P3** |
| 8.6 | Log de atividade acumular dado pessoal | **MITIGADA** | `registrarEvento` é fire-and-forget e o `dados` é `jsonb` livre — nada impede um `tipo` novo carregar PII. Convenção documentada, sem teste |

## 9. Superfície: client, portal e armazenamento local

| # | Ameaça | Estado | Prova |
|---|---|---|---|
| 9.1 | `service_role` no bundle | **FECHADA** | `a service_role nunca é referenciada no client` (`superficieDoClient.test.ts`) — varre todo `src/`, ignorando comentário. A chave vive em `supabase secrets` |
| 9.2 | Segredo commitado no repositório | **FECHADA** *(nesta rodada)* | `.github/workflows/ci.yml` roda `gitleaks` com `fetch-depth: 0` — varre o histórico, não só a árvore atual |
| 9.3 | Dado sensível em `localStorage` | **MITIGADA** | Só o token de sessão do Supabase (`autohunt.sessao`) e a preferência de idioma. Nenhum dado pessoal; o token é o mecanismo padrão do SDK |
| 9.4 | `localStorage` inacessível derrubar o jogo | **FECHADA** | `src/lib/armazenamento.ts` cai para memória; testado em `armazenamento.test.ts`. Exigência da Poki (janela anônima + iframe) |
| 9.5 | Dado sensível em log do client | **FECHADA** | `não existe console.* no código de produção` |
| 9.6 | SDK de terceiro injetando código | **MITIGADA** | O build nunca busca script externo; nos portais o SDK é injetado pela página hospedeira (`VITE_CANAL`). Ver `docs/01_ARQUITETURA/publicacao-portais.md` |
| 9.7 | Dependência vulnerável | **FECHADA** *(nesta rodada)* | `npm audit --audit-level=critical` no CI |
| 9.8 | Cenário do client virar entrada de cálculo de recompensa | **FECHADA** | `nenhuma migration menciona bioma` + `nenhum módulo de regra importa biomas`. O mundo aberto é simulação **visual**; no instante em que "estar no bioma 7" mudasse um número creditado, a regra central passaria a depender de um cálculo que roda no navegador do jogador |

## 10. Superfície: passe de recompensas

Superfície nova, criada na 9ª rodada. É a segunda coisa do jogo que se compra com dinheiro, e a
primeira que entrega **conteúdo** em troca — o que a aproxima perigosamente da restrição de
recompensa aleatória paga.

| # | Ameaça | Estado | Prova |
|---|---|---|---|
| 11.1 | O passe virar recompensa aleatória paga | **FECHADA** | `a recompensa do passe nunca é sorteada` — `conceder_recompensa_passe` não pode usar `sorteio01`, `escalar_raridade`, `random(` nem `conceder_item`; a raridade vem escrita da linha da trilha. **A diferença entre este passe e uma loot box é exatamente esta**, e o jogador lê a trilha inteira antes de comprar |
| 11.2 | Prazo/temporada empurrando urgência de compra | **FECHADA** | `nada na trilha do passe expira` — a tabela `passe_recompensa` não pode ter coluna de `expira`, `validade`, `temporada`, `prazo` ou `termina`. Restrição "sem dark pattern de urgência" virando ausência verificada |
| 11.3 | Recompensa destravada ser retirada ao cancelar | **FECHADA** | `recompensa de passe já destravada nunca é retirada` — `desativar_passe` não menciona `item_jogador` nem `delete`; `desativar o passe não retira nenhuma recompensa já destravada` (fumaça) |
| 11.4 | Client se declarar portador do passe | **FECHADA** | `o client nunca informa progresso de passe nem se declara portador` — `ativar_passe` e `desativar_passe` revogadas de `authenticated`, concedidas a `service_role`. Mesmo padrão da assinatura |
| 11.5 | Client informar quantos pontos ganhou | **FECHADA** | Mesmo teste: o progresso entra por `creditar_ciclos`, a rota que já credita tudo e que o client não alcança |
| 11.6 | Ganhar pontos sem ter o passe | **FECHADA** | `progredir_passe` sai cedo quando o passe não está ativo; `sem passe ativo, jogar não acumula ponto` (fumaça) |
| 11.7 | A skin "exclusiva" aparecer por outra rota | **FECHADA** | `só a trilha do passe concede item exclusivo` — existe **um** `insert` no schema inteiro que marca `exclusivo_do_passe`, e ele está dentro de `conceder_recompensa_passe`; `nenhuma rota fora do passe concede item exclusivo` (fumaça) |
| 11.8 | Pular tier numa ausência longa | **FECHADA** | `nenhum tier é pulado — um item por tier cruzado` e `todo tier cruzado entregou a recompensa que publicava` (fumaça) |
| 11.9 | Progresso do passe não entrar na exportação de LGPD | **FECHADA** | `a exportação de dados inclui o progresso do passe` (fumaça). Tabela nova de dado do jogador entra na exportação junto — senão o direito de acesso vira promessa parcial |
| 11.10 | Calibragem tornar a trilha inalcançável sem pagar mais | **ABERTA** | Mesma família de 4.7: os pontos por ciclo e o custo de cada tier são balanceamento (D4), e nenhum teste pode julgar se a curva é honesta. Só dado de jogador real resolve |

## 12. Superfície: console de ajuste

Superfície nova, criada na 11ª rodada (`specs/console-de-ajuste.md`). É a mais perigosa do schema
por natureza: quem alcança este console muda XP, dano e drop de **todo mundo**, de uma vez.

A decisão que molda a defesa inteira: **a proteção mora no banco, nunca na tela.** A rota `/console`
vai no bundle que todo jogador baixa, e é deliberado — esconder rota é obscuridade, e obscuridade
não é controle. Um jogador curioso abre a tela, preenche os campos, clica, e nada nele muda.

| # | Ameaça | Estado | Prova |
|---|---|---|---|
| 12.1 | Jogador comum escrever balanceamento | **FECHADA** | `o console não escreve no banco por caminho nenhum do client` — `ajuste` não tem grant de INSERT/UPDATE/DELETE; `authenticated não escreve em ajuste` (fumaça). Nem o admin escreve direto |
| 12.2 | Alguém se promover a admin | **FECHADA** | `a promoção a admin não tem caminho dentro do jogo` — nenhuma função do schema escreve `jogador.admin`, e a coluna está fora do grant de UPDATE; `authenticated não escreve jogador.admin` (fumaça). Vira admin só por `update` manual no SQL editor, que já exige a chave do projeto |
| 12.3 | Chamada direta à RPC pulando a tela | **FECHADA** | `a escrita de ajuste confere admin dentro do servidor` — `definir_ajuste` é `SECURITY DEFINER`, checa `e_admin()` sobre `auth.uid()`; `não-admin é recusado por definir_ajuste` e `a tentativa do não-admin não mudou o valor` (fumaça) |
| 12.4 | Valor absurdo quebrando o jogo ou a economia | **FECHADA** | `o número de balanceamento sempre tem faixa` — `minimo`/`maximo` são `check` de tabela, por linha; `acima do máximo é recusado` e `abaixo do mínimo é recusado` (fumaça) |
| 12.5 | O client passar a declarar ganho por via do ajuste | **FECHADA** | `nenhum ajuste abre caminho para o client declarar ganho` — as RPCs que creditam continuam com zero parâmetro, e nenhuma outra RPC alcançável aprendeu a receber multiplicador, velocidade, dano ou boost |
| 12.6 | Número econômico vazar para o navegador | **FECHADA** | `nenhum número econômico do console viaja para o client` — `montar_ajustes_visuais` filtra `escopo = 'visual'`; `o snapshot não publica o multiplicador de XP` (fumaça); `nenhum número que credita tem representação no client` (client) |
| 12.7 | Alteração sem rastro de quem fez | **FECHADA** | `o ajuste aplicado registra de-para e autor` e `a recusa do não-admin ficou no log` (fumaça). A recusa é **devolvida** em vez de levantada justamente para o registro sobreviver — `raise` derrubaria a transação e apagaria o log junto |
| 12.8 | Linha apagada mudando o jogo em silêncio | **FECHADA** | `o padrão embutido em resolver_ciclos repete o valor semeado` — o `coalesce` de `ajuste_num` cai exatamente no valor de origem. Jogo que para porque uma linha sumiu é pior que jogo mal balanceado |
| 12.9 | Conta de admin comprometida | **ABERTA** | Nada além do log detecta uso indevido de uma sessão legítima do dono. Não há segunda pessoa para aprovar, nem 2FA no jogo — é conta única de produto single-tenant. Mitigação real é operacional: 2FA no Supabase, item do checklist de release |
| 12.10 | O dono desbalancear o jogo sozinho | **ABERTA** | É o propósito da ferramenta, não um defeito dela. A faixa limita o estrago; o julgamento é humano. Mesma família de 4.7 e 11.10 |
| 12.11 | Admin lendo o log virar vigilância do jogador | **FECHADA** | `o log nunca mostra presença nem progressão` — `tipos_do_log_operacional()` é lista fechada, e `farm.calculado`, `farm.coletado`, `passe.tier` e os de atributo estão proibidos por teste. A recusa do caminho fácil está registrada: nenhuma policy de `evento_jogo` cita admin (`o admin não ganha leitura da tabela de eventos`) |
| 12.12 | Client ampliar o log pedindo um tipo de fora | **FECHADA** | `o filtro do client é intersectado, nunca somado` — `p_tipos` passa por `intersect` com a lista do servidor, e a consulta filtra por `v_filtro`; `pedir tipo de fora da lista não devolve nada` (fumaça) |
| 12.13 | Jogador comum lendo o rastro | **FECHADA** | `jogador comum não lê o log operacional` (fumaça), e a tentativa vira `console.log_recusado` — ler o log de auditoria é justamente o que se quer auditar |
| 12.14 | Evento apagado ou reescrito por dentro do produto | **FECHADA** | `o log é somente leitura — nenhum caminho apaga evento`: nenhuma função faz `delete`/`update` em `evento_jogo`. A única remoção é a cascata de `excluir_minha_conta`, que é direito da LGPD |
| 12.15 | Página gigante virando varredura da tabela | **FECHADA** | `a página do log tem teto no servidor` — limite travado em 200, e paginação por cursor de tempo em vez de `offset`. Mesma família de custo da D10 |
| 12.16 | Carregar a página inflando o log de recusas | **MITIGADA** | A tela não pede o log quando já sabe que não é admin, então abrir a URL não gera linha. Uma chamada direta e repetida à RPC ainda gera — é a mesma ausência de rate limit por jogador da §13, sem controle novo |

## 13. O que este modelo não cobre

Registrado para não virar ponto cego por omissão:

- **Abuso de volume.** Nada limita quantas vezes um jogador chama uma RPC por minuto. `evento_jogo`
  aceita `insert` do client, então um script pode inflar a tabela. Não é vetor de trapaça (não
  credita nada), é vetor de **custo e ruído**. Supabase tem rate limit de plataforma; limite por
  jogador não existe.
- **Disponibilidade.** Nenhum plano de DDoS/WAF — adiado por custo, decisão registrada.
- **Segurança do dono da conta.** 2FA no painel do Supabase e da Vercel é responsabilidade
  operacional, fora do código. Vira item de release.
- **Mercado P2P.** Superfície inteira ainda não construída, e a mais delicada do roadmap — tem
  documento próprio: `plano-mercado-p2p.md`.
- **Dano por espécie de monstro.** Pedido do dono, deixado fora com o motivo registrado: hoje
  inimigo não causa dano econômico (o dano por ciclo é um número só, do servidor), e fazê-lo
  depender de quais espécies apareceram exigiria o client informar quem apareceu — a informação
  que 13 ameaças deste documento dependem de ele nunca enviar.

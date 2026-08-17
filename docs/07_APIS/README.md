# 07 — APIS · Autohunt Idle

> O contrato entre o client e o banco. **Não existe API própria**: o SDK do Supabase fala direto
> com o Postgres, e toda operação que vale alguma coisa é uma RPC `SECURITY DEFINER` (ADR-001).

> ⚠️ Este documento foi escrito auditando o **banco vivo**, não o texto das migrations. A
> diferença não é preciosismo: auditar texto foi exatamente o que escondeu o furo descrito na
> seção 6 durante quatro rodadas.

## 1. A regra que molda todo este contrato

**O client nunca declara tempo nem recompensa** (core, critério 3).

Consequência prática, e é o que explica assinaturas que parecem estranhas: as RPCs que **creditam
valor têm zero parâmetro**. Sem campo, não há como injetar timestamp, duração ou ganho. Onde há
parâmetro, ele é uma *escolha* do jogador — qual item equipar, qual pilha sintetizar — nunca um
*resultado*.

O tempo vem sempre do `now()` do Postgres. O relógio da máquina do jogador não entra em nenhuma
conta.

## 2. Os três papéis

| Papel | Quem é | O que alcança |
|---|---|---|
| `anon` | ninguém autenticado | **nada**. Sem grant de tabela nem de função |
| `authenticated` | o jogador, com JWT do Supabase Auth | os 21 RPCs da seção 3, e leitura das próprias linhas via RLS |
| `service_role` | Edge Functions, com a chave secreta | os 7 RPCs da seção 4. **Nunca entra no bundle do client** |

## 3. A superfície do jogador — 21 RPCs, e só elas

Esta lista é fechada. O teste de fumaça `a superfície do client é exatamente a lista declarada`
pergunta ao banco quais funções `authenticated` alcança e compara com ela — uma função nova que
vaze por omissão reprova.

### Sessão e farm — todas sem parâmetro

| RPC | Devolve | Observação |
|---|---|---|
| `iniciar_sessao()` | snapshot + `retorno` | Cria o jogador na primeira vez. Calcula a ausência e credita |
| `validar_lote()` | snapshot + `lote` | Chamada a cada ciclo pelo motor. **Não transporta recompensa** — só pede a validação |
| `encerrar_sessao()` | snapshot | Marca `last_seen_at` ao sair |
| `coletar_farm_offline()` | snapshot + `coleta` | Move o pendente para o total |
| `emitir_ticket_anuncio()` | `{ emitido, ticketId, minutos }` | Destrava **farm offline**. O servidor decide os minutos |
| `emitir_ticket_auto()` | `{ emitido, ticketId, minutos }` | Destrava **auto na tela**. É uma RPC separada, e não um parâmetro, porque as RPCs que creditam valor têm zero parâmetro |
| `estado_jogador()` | snapshot | Releitura pura, sem bloco `retorno` |

### Atributos e ranking

| RPC | Parâmetros | Por que pode ter parâmetro |
|---|---|---|
| `redistribuir_atributos(forca, destreza, inteligencia, vitalidade, sorte)` | a distribuição desejada | É escolha, e o servidor confere o custo total contra os pontos ganhos |
| `definir_apelido(apelido)` | o apelido | Exige `identidade_verificada`; colisão é decidida pelo índice único |
| `ranking_global()` | — | Devolve o top e a própria linha. **Nunca `player_id` de terceiro** |

> **`redistribuir_atributos` mudou de aridade em 2026-08-14** (4 → 5 parâmetros, com a Destreza).
> A migration **derruba a versão de quatro** antes de criar a de cinco, e isso não é limpeza: no
> Postgres, `create or replace` com aridade diferente cria uma **sobrecarga**, e a antiga
> continuaria concedida a `authenticated`. Daria para alocar Destreza pela RPC nova e em seguida
> chamar a de quatro — que soma o custo de só quatro atributos, aprova, e não zera a Destreza no
> upsert. Pontos de atributo de graça, repetível, por uma chamada REST direta. O `grant` é **por
> assinatura**: sem reconceder a de cinco, salvar atributo pararia de funcionar inteiro.

`canal_historico_da_arma(id)` existe no schema mas **não é alcançável pelo jogador** — é a gêmea em
SQL do hash de `src/game/armas.ts`, usada uma única vez pela migration de reclassificação. O
`revoke` dela é obrigatório: as *default privileges* do Supabase concedem `execute` por omissão, e
a lista fechada de RPCs de `scripts/conferir-supabase.sql` reprova qualquer nome a mais.

### Itens

| RPC | Parâmetros | Observação |
|---|---|---|
| `iniciar_dungeon()` | — | Qual chave é consumida e qual é o resultado são decisões do servidor |
| `sintetizar(tipo, raridade)` | qual pilha combinar | O servidor confere que existem 9 itens livres antes de consumir |
| `equipar_item(item_id)` | qual item | O slot é derivado do tipo, no servidor. Confere posse |
| `fortificar_item(item_id, usar_sorte, usar_garantia)` | item e pedras opcionais | Chance, custo e resultado decididos no servidor |

### Economia e conta

| RPC | Parâmetros | Observação |
|---|---|---|
| `comprar_ouro(pacote)` | qual pacote | Preço e quantidade vêm da tabela. **Único débito de diamante do schema** |
| `exportar_meus_dados()` | — | LGPD. Sem `player_id`: **não existe chamada capaz de pedir conta alheia** |
| `excluir_minha_conta()` | — | LGPD. Irreversível |

### Console de ajuste

As duas RPCs mais recentes, e as únicas que existem para o **dono** e não para o jogador
(`specs/console-de-ajuste.md`). Estão no grant de `authenticated` de propósito: a tela vai no
bundle que todo mundo baixa, porque esconder a rota seria segurança por obscuridade. Quem protege
é o banco.

| RPC | Parâmetros | Observação |
|---|---|---|
| `e_admin()` | — | Responde sobre `auth.uid()`, nunca sobre um uuid digitado. É o que deixa a tela recusar com o motivo escrito em vez de sumir |
| `definir_ajuste(chave, valor)` | qual número, e quanto | **Única porta de escrita da tabela `ajuste`.** Confere admin, valida a faixa da própria linha e registra quem mudou o quê |
| `log_operacional(tipos, limite, antes)` | filtro, tamanho da página e cursor de tempo | Lê o rastro. **O admin não tem grant de leitura em `evento_jogo`** — ver abaixo |

### Por que o log é RPC e não uma policy de RLS

O caminho curto seria `create policy … using (public.e_admin())` em `evento_jogo`. Foi recusado, e a
razão vale mais que a economia de código: `evento_jogo.dados` é `jsonb` sem esquema e o client tem
`grant insert` (dívida D10). "Admin lê a tabela" significaria admin lendo **tudo o que qualquer
jogador já registrou, inclusive tipos que ainda nem foram inventados**. Isso é vigilância, não
auditoria.

A RPC tem **lista fechada de tipos**, declarada no servidor por `tipos_do_log_operacional()`, que
`authenticated` não alcança. A linha que separa os dois lados: **entra o evento que move valor ou
muda a configuração do jogo.** Presença (`farm.calculado`), progressão (`passe.tier`) e escolha
pessoal (`atributo.redistribuido`) ficam de fora — um teste reprova o build se algum deles entrar.

`p_tipos` é filtro de conveniência da tela e é **intersectado** com a lista: pedir um tipo de fora
não amplia nada, só devolve menos. A página tem teto de 200 no servidor, e a paginação é por cursor
de tempo em vez de `offset` — o log só cresce pela ponta nova, e `offset` faria a página 2 repetir
linha toda vez que um evento entrasse no meio da leitura.

Quando o mercado P2P existir, `mercado.listado` e `mercado.comprado` entram nessa lista e aparecem
na mesma tela. **A escrita do rastro nasce dentro da RPC do trade, na mesma transação** — nunca
depois: trade que rodou antes do log existir é trade que ninguém consegue investigar
(`docs/11_SEGURANCA/plano-mercado-p2p.md` §4.6).

`definir_ajuste` é a única RPC do contrato que recebe um número de balanceamento — e pode, porque
**não credita nada**. A regra do core é sobre o client declarar *tempo* e *recompensa*; escrever
balanceamento, depois de conferir que quem chamou é admin, é outra coisa. Um teste vigia
exatamente essa fronteira: nenhuma outra RPC alcançável pelo jogador aprendeu a receber
multiplicador, velocidade, dano ou boost.

Quem **não** é admin chega aqui: a chamada é recusada, nada muda, e a tentativa vira evento. A
recusa é devolvida em vez de levantada justamente para o log sobreviver — `raise` derrubaria a
transação e apagaria o registro junto.

## 4. A superfície do servidor — 7 RPCs

Chamadas por Edge Function com a `service_role`. Todas revogadas de `authenticated`, e é isso que
impede o jogador de se declarar assinante, portador de passe ou espectador de anúncio.

| RPC | Chamada por | Fecha a ameaça |
|---|---|---|
| `creditar_anuncio(ticket_id)` | callback do provedor de anúncio | 2.1 |
| `resgatar_anuncio_do_jogador(ticket_id, player_id)` | `anuncio-resgate` (JWT conferido lá) | 2.1 |
| `aplicar_evento_assinatura(player_id, status, expira_em, provedor, referencia)` | webhook do gateway | 3.1 |
| `creditar_diamante(player_id, quantidade, referencia)` | webhook do gateway | — |
| `ativar_passe(player_id, referencia)` | webhook do gateway | 10.4 |
| `desativar_passe(player_id)` | webhook do gateway | 10.4 |
| `recomputar_ranking()` | `pg_cron` (D6 — ainda não agendado) | — |

## 5. Tudo o mais é interno

As ~41 funções restantes — `sorteio01`, `escalar_raridade`, `conceder_item`, `creditar_ciclos`,
`montar_snapshot`, `progredir_passe`, `ajuste_num`, `montar_ajustes_visuais`, `tipos_do_log_operacional`, as funções de matemática pura — **não são alcançáveis por
ninguém**. Só por outras funções `SECURITY DEFINER`, que rodam como donas do schema.

## 6. O furo que este documento encontrou

Vale registrar em voz alta, porque a lição é maior que o bug.

Escrever esta página exigiu perguntar ao banco *quem alcança o quê*. A resposta não era a que as
migrations sugeriam:

```
sorteio01(text)                        → alcançável por authenticated
escalar_raridade(...)                  → alcançável por authenticated
farm_state.contador_sorteio            → legível pelo client
```

**Nenhuma dessas linhas era um GRANT.** Eram ausências de revoke: o Postgres concede EXECUTE a
PUBLIC em toda função nova, por padrão. As migrations revogavam só as funções que alguém lembrou
de revogar, e o teste de contrato conferia só os revokes que **existiam** — nunca os que faltavam.

Com a fórmula do sorteio (`player_id || marcador || contador`), a função e o contador todos ao
alcance, o resultado do próximo loot era calculável. E daí sai o exploit de verdade: sabendo que o
próximo sorteio é ruim, o jogador **queima o contador** numa ação barata e guarda a dungeon para
quando o número for bom. Re-rolagem, com outro nome — exatamente o que a ameaça 5.2 do modelo
afirmava ser impossível.

Fechado na migration `20260823` em três frentes: um segredo de servidor entra na semente, EXECUTE
deixa de ser concedido por omissão (`alter default privileges` + revoke em bloco), e o contador sai
do grant do client.

**A lição que fica:** auditar o texto de uma migration prova o que ela *diz*; só o banco prova o
que ela *deixou*. Por isso a lista fechada da seção 3 é verificada perguntando ao Postgres, e não
lendo arquivo.

### A mesma lição, de novo — 2026-08-12

O §6 acima terminava com "auditar o texto prova o que a migration diz; só o banco prova o que ela
deixou". No dia em que o projeto Supabase real subiu, essa frase cobrou juros.

`scripts/conferir-supabase.sql` rodou contra o projeto de verdade e acusou duas coisas que **toda a
suíte local aprovava**:

- `public.ajuste` com **ALL** para `anon` e `authenticated`;
- `emitir_ticket_auto()` com **EXECUTE** para `anon`.

A causa é a mesma nas duas: um projeto Supabase nasce com
`alter default privileges in schema public grant all ... to anon, authenticated, service_role`.
**Objeto novo já nasce concedido** — o oposto do Postgres puro. As migrations anteriores sabiam
disso e revogavam logo após criar; a de `ajuste` esqueceu, e `emitir_ticket_auto` foi revogada só
`from public` — que **não alcança `anon`**, porque `PUBLIC` é o pseudo-papel de todo mundo e `anon`
é um papel nomeado que o Supabase alimenta por default privileges.

E o motivo de nenhum teste ter pego: **`scripts/stub-supabase.sql` criava os três papéis mas não
reproduzia as default privileges.** Sem elas, o revoke esquecido era um no-op invisível. Um stub que
simula o Supabase pela metade é um stub que aprova o que o Supabase reprova — e a suíte inteira
herda a cegueira.

O risco real era baixo, e vale ser exato em vez de dramático: a RLS segurava (`ajuste` só tem policy
de `select`, então nenhuma escrita passava mesmo com o grant), e `emitir_ticket_auto()` levanta
`NAO_AUTENTICADO` quando `auth.uid()` é nulo. **Mas a defesa era uma camada, não duas** — e o
desenho do console se apoia em "não existe grant de escrita para o client".

O que saiu daí, e vale mais que a correção:

1. **O stub virou fiel.** Reproduz as default privileges do Supabase, e o teste de fumaça agora
   falha antes da migration 20260827 e passa depois — verificado nos dois sentidos.
2. **A varredura passou a ser por tabela, não por lista.** O teste percorre `pg_tables` e cobra cada
   uma: tabela nova que vaze reprova sem ninguém lembrar de acrescentá-la.
3. **A inversão ficou completa.** `alter default privileges ... revoke all on tables/functions/
   sequences from anon, authenticated` — objeto novo nasce fechado para os dois papéis do client.

## 7. Envelope e erros

Toda função de serviço do client devolve `{ data, error, meta }` (`docs/01_ARQUITETURA/padroes.md`).
O `error.codigo` é o nome da exceção que a RPC levantou — string estável, que vira chave de
tradução:

```
NAO_AUTENTICADO · SEM_CHAVE · ITENS_INSUFICIENTES · TIER_MAXIMO
OURO_INSUFICIENTE · SEM_PEDRA · ITEM_NAO_FORTIFICAVEL · TETO_ATINGIDO
DIAMANTE_INSUFICIENTE · PACOTE_INDISPONIVEL
APELIDO_EM_USO · APELIDO_TAMANHO_INVALIDO · CADASTRO_NECESSARIO
IDADE_MINIMA_NAO_ATINGIDA · DATA_NASCIMENTO_IMUTAVEL
JOGADOR_INEXISTENTE
```

Nenhum deles carrega dado sensível: o corpo da requisição nunca é anexado ao erro.

## Ligações

- `docs/11_SEGURANCA/modelo-de-ameacas.md` — o que cada RPC protege
- `docs/04_MODELAGEM/` — as tabelas por trás
- `src/lib/services/` — a camada que chama estas RPCs
- `supabase/migrations/20260823_fechar_superficie_de_sorteio.sql` — a lista de grants viva

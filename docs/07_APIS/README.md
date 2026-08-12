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
| `authenticated` | o jogador, com JWT do Supabase Auth | os 17 RPCs da seção 3, e leitura das próprias linhas via RLS |
| `service_role` | Edge Functions, com a chave secreta | os 7 RPCs da seção 4. **Nunca entra no bundle do client** |

## 3. A superfície do jogador — 17 RPCs, e só elas

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
| `emitir_ticket_anuncio()` | `{ emitido, ticketId, minutos }` | O servidor decide os minutos |
| `estado_jogador()` | snapshot | Releitura pura, sem bloco `retorno` |

### Atributos e ranking

| RPC | Parâmetros | Por que pode ter parâmetro |
|---|---|---|
| `redistribuir_atributos(forca, inteligencia, vitalidade, sorte)` | a distribuição desejada | É escolha, e o servidor confere o custo total contra os pontos ganhos |
| `reativar_auto_alocacao()` | — | |
| `definir_apelido(apelido)` | o apelido | Exige `identidade_verificada`; colisão é decidida pelo índice único |
| `ranking_global()` | — | Devolve o top e a própria linha. **Nunca `player_id` de terceiro** |

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

As ~37 funções restantes — `sorteio01`, `escalar_raridade`, `conceder_item`, `creditar_ciclos`,
`montar_snapshot`, `progredir_passe`, as funções de matemática pura — **não são alcançáveis por
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

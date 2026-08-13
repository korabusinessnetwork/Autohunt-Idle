# 04 — MODELAGEM · Autohunt Idle

> As 13 tabelas do jogo: o que cada uma guarda, quem consegue ler o quê, e quais invariantes o
> banco enforça sozinho.

> ⚠️ Auditado contra o **banco vivo**, não contra o texto das migrations. A diferença já custou um
> furo de segurança — ver `docs/07_APIS/` §6.

> Este projeto é single-tenant ([ADR-002](../08_DECISOES/adr-002-single-tenant.md)): **não existe
> `tenant_id` em lugar nenhum**, e um teste reprova o build se aparecer. Isolamento é por
> `player_id`.

## 1. O desenho em uma frase

Tudo pendura em `jogador`, que pendura em `auth.users` com `on delete cascade`. Apagar a conta no
Auth apaga o jogo inteiro daquela pessoa, em cascata, sem lista para alguém esquecer de atualizar.

```
auth.users (Supabase)
└── jogador ─────────┬── farm_state          1:1
                     ├── atributo_jogador    1:1
                     ├── assinatura          1:1
                     ├── passe_jogador       1:1
                     ├── ranking_posicao     1:1 (só quem tem apelido)
                     ├── item_jogador        1:N
                     ├── ticket_anuncio      1:N
                     └── evento_jogo         1:N

catálogos sem dono:  pacote_ouro · passe_recompensa · segredo_rng · ajuste
```

## 2. As tabelas

### `jogador` — a linha central

| | |
|---|---|
| **PK** | `id uuid` → `auth.users(id)` |
| **Progressão** | `nivel`, `xp_total`, `moeda`, `diamante`, `vitalidade_atual` |
| **Pessoal** | `data_nascimento`, `idioma`, `apelido` |
| **Operação** | `admin` — abre o console de ajuste |
| **Client lê** | tudo (é a própria linha) |
| **Client escreve** | `data_nascimento` e `idioma`, e **só** |

O grant de UPDATE é a proteção mais importante do schema: **`nivel`, `xp_total`, `moeda`,
`diamante`, `vitalidade_atual` e `admin` não estão nele**. Nem um update legítimo na própria linha os
alcança — quem escreve progressão é RPC `SECURITY DEFINER`.

Dois triggers guardam a idade:
- `jogador_valida_idade` recusa data que implique menos de 18 anos (`IDADE_MINIMA_NAO_ATINGIDA`);
- o mesmo trigger recusa **reescrever** uma data já informada (`DATA_NASCIMENTO_IMUTAVEL`), senão
  o gate viraria formalidade reversível.

`jogador_apelido_unico` é um índice único parcial sobre `lower(apelido)`: "Duda" e "duda" são o
mesmo nome aos olhos do jogador, e nulo não ocupa vaga.

### `farm_state` — o relógio e o RNG

| | |
|---|---|
| **PK** | `player_id` |
| **Tempo** | `last_seen_at`, `minutos_acumulados` |
| **Pendente** | `xp_pendente`, `moeda_pendente` |
| **Anúncio (offline)** | `minutos_anuncio_saldo`, `minutos_anuncio_creditados`, `janela_anuncio_iniciada_em` |
| **Auto (na tela)** | `minutos_auto_saldo`, `minutos_auto_creditados`, `janela_auto_iniciada_em` |
| **Sorteio** | `contador_sorteio`, `ciclos_desde_mini_boss` |

**São dois baldes de propósito**, não um campo com dois usos: auto na tela e farm offline viraram
produtos separados quando o jogo virou manual (`specs/mundo-aberto-e-modo-manual.md`, 3.3). Gastar
um não pode consumir o outro, e dois campos é o que garante isso sem nenhuma regra.

`last_seen_at` é a única fonte de "quanto tempo se passou". Nunca vem do client.

**`contador_sorteio` NÃO está no grant do client.** É metade da semente de todo sorteio, e
publicá-lo permitia prever o loot — ver `docs/07_APIS/` §6.

### `atributo_jogador`

`forca`, `inteligencia`, `vitalidade`, `sorte`, mais `auto_alocar` — este último **morto desde
2026-08-13**, sempre `false`. A auto-alocação saiu do jogo (ver `docs/03_REGRAS_DE_NEGOCIO/` §3), e
a coluna ficou porque `montar_snapshot` e `exportar_meus_dados` a publicam; derrubá-la obrigaria a
reescrever as duas por nada. `auto_alocar_atributos()` continua existindo pelo mesmo tipo de motivo
— três RPCs a chamam com `perform` no level up —, mas o corpo dela hoje só garante que a linha de
atributo existe.

### `item_jogador` — inventário, equipamento e fortificação numa tabela só

| Coluna | Papel |
|---|---|
| `tipo` | `arma`, `capacete`, `armadura`, `luva`, `bota`, `acessorio`, `skin`, `chave`, `pedra_*` |
| `raridade` | 1 (comum) a 10 (cósmico) |
| `slot` | ocupado, ou `null` quando guardado. **O slot é sempre igual ao tipo** |
| `fortificacao` | 0 a 15. **Nunca decresce** — não existe caminho no schema que reduza |
| `tipo_dano`, `afinidade`, `conjunto_id` | sinergia e conjunto |
| `origem` | `mundo`, `mini_boss`, `dungeon`, `sintese`, `passe` |
| `exclusivo_do_passe` | marcado por **um único insert** no schema inteiro |

`item_slot_unico` é o índice único por `(player_id, slot)` — dois itens no mesmo slot nem entram no
banco. É constraint, não checagem em código.

### `assinatura` e `passe_jogador` — o que o dinheiro toca

Ambas seguem o mesmo padrão, e é deliberado:

- **escrita exclusiva de `service_role`**, por webhook assinado do gateway. O client não consegue
  se declarar assinante nem portador de passe;
- **`referencia_externa` e `provedor` fora do grant do client** — são o identificador do jogador
  *dentro do provedor*, e `CLAUDE.md` proíbe `select *` justamente em tabela de assinatura.

`assinatura_ativa_tem_prazo` garante que status ativo sempre tem `expira_em`. Cancelar não corta o
benefício: o status vira `cancelada` e o período pago segue valendo até vencer.

### `ranking_posicao` — a única tabela com dado visível a terceiros

Recomputada por `recomputar_ranking()` (exclusiva de `service_role`; falta agendar — D6).

O grant é o ponto: **`player_id` não está nele.** O placar mostra apelido, nível e posição. Quem
aparece ali escolheu aparecer, e aparece só com o nome que escolheu.

### `ticket_anuncio` e `evento_jogo`

`ticket_anuncio` é de uso único: o crédito acontece contra o ticket, nunca contra um pedido do
client. Ele carrega a `finalidade` (`offline` ou `auto`), **decidida na emissão, pelo servidor** —
o client nunca informa qual produto está destravando.

`evento_jogo` é o log fire-and-forget, e desde 2026-08-12 é também o **rastro operacional** que o
console mostra. A policy continua sendo "cada um lê o seu": **o admin não ganhou leitura da
tabela** — ele alcança `log_operacional()`, que devolve uma lista fechada de tipos. A diferença é
o que separa auditoria de vigilância, e está detalhada em `docs/07_APIS/`.

É a **única tabela em que o client pode inserir**
(`player_id, tipo, dados`), e isso é dívida registrada (D10): `dados` é `jsonb` sem esquema, então
nada impede um `tipo` novo carregar dado pessoal, nem um script inflar a tabela. Não credita nada
— não é vetor de trapaça, é vetor de custo e ruído.

### Catálogos: `pacote_ouro`, `passe_recompensa`

Legíveis por qualquer jogador autenticado, e é o ponto: **preço e recompensa precisam estar na tela
antes da compra.** É o que separa a loja de ouro e o passe de uma caixa de recompensa aleatória.

Nenhuma das duas tem coluna de prazo, validade ou temporada. A ausência é verificada por teste.

### `ajuste` — os números do jogo, editáveis pelo dono

| | |
|---|---|
| **PK** | `chave` |
| **Valor** | `valor`, com `minimo` e `maximo` obrigatórios |
| **Natureza** | `escopo`: `visual` (o client lê e desenha) ou `economico` (só o servidor lê) |
| **Contexto** | `categoria`, `descricao`, `atualizado_em`, `atualizado_por` |

Nasceu para tirar o balanceamento das minhas mãos e colocar nas do dono — quase todo número do
jogo era chute meu (D4). **Não tem grant de INSERT, UPDATE nem DELETE para ninguém do lado do
client**, nem para o admin: a escrita passa por `definir_ajuste`, que confere admin, valida a
faixa e registra o de-para.

A faixa é `check` de tabela, não validação de formulário — é o que impede um zero digitado errado
em "abates por ciclo" de parar o jogo, e um `999999` em "XP por abate" de arruinar a economia num
clique. Vale inclusive para quem escrever por fora da RPC.

A política de leitura é o que mantém a separação de pé: `escopo = 'visual' or e_admin()`. O
jogador comum recebe só o que o client precisa para desenhar; **os números que decidem XP e ouro
nunca saem do servidor.**

### `segredo_rng` — a tabela que ninguém alcança

Uma linha, sem grant nenhum, RLS ligada e **sem policy**. Só função `SECURITY DEFINER` a lê, porque
roda como dona do schema.

O valor tempera toda semente de sorteio. Sem ele, conhecer o algoritmo e o contador não basta para
prever o loot — que é exatamente o furo fechado na migration `20260823`.

## 3. Os invariantes que o banco enforça sozinho

Não dependem de nenhuma linha de código de aplicação:

| Invariante | Como |
|---|---|
| Ninguém menor de 18 tem conta | trigger `jogador_valida_idade` |
| Data de nascimento não é reescrita | mesmo trigger |
| Dois itens não ocupam o mesmo slot | índice único `item_slot_unico` |
| Dois jogadores não têm o mesmo apelido | índice único `jogador_apelido_unico` sobre `lower()` |
| Saldo de diamante nunca negativo | `check (diamante >= 0)` |
| Fortificação entre 0 e 15 | `check` na coluna |
| Raridade entre 1 e 10 | `check` na coluna |
| Assinatura ativa sempre tem prazo | `check` de tabela |
| Apagar a conta não deixa órfão | `on delete cascade` em toda FK |
| Número de balanceamento sempre dentro da faixa | `check (valor between minimo and maximo)` |
| Faixa de balanceamento sempre coerente | `check (minimo <= maximo)` |

## 4. RLS — todas as 13 tabelas

Sem exceção, e dois testes garantem: `toda tabela criada tem RLS habilitada` (contrato) e
`RLS ativa em toda tabela do schema public` (fumaça, varrendo `pg_class`).

O padrão é `using (player_id = auth.uid())`. As três exceções são deliberadas:

- `ranking_posicao` e os dois catálogos de compra: leitura pública para autenticado — nenhum dado
  pessoal;
- `ajuste`: leitura pública **só do escopo visual**; o econômico exige admin;
- `segredo_rng`: RLS ligada e **nenhuma policy**, ou seja, ninguém passa.

**Ressalva que não pode sumir:** o Postgres local reproduz `auth.uid()` a partir de uma variável de
sessão, não de um JWT. **RLS não é exercitada por um token real** em teste nenhum — isso só num
projeto Supabase. É a ameaça 7.5, e virou passo manual no checklist de release.

## 5. O que a modelagem deliberadamente NÃO tem

- **`tenant_id`** — ADR-002. Verificado por teste.
- **Qualquer coluna de cartão** — o gateway processa, nós não guardamos. Verificado por teste.
- **Tabela de classe/build** — a "build" é o que emerge do que está equipado agora.
- **Coluna de bioma** — cenário é do client, e não pode virar entrada de cálculo de recompensa.
- **Estado "conta desativada"** — a exclusão da LGPD é eliminação, não pausa.
- **Papéis de admin** — é um booleano, não uma hierarquia. Produto single-tenant, um dono;
  hierarquia seria complexidade sem demanda (`specs/console-de-ajuste.md`, §6).

## Ligações

- `docs/07_APIS/` — as RPCs que operam sobre estas tabelas
- `docs/11_SEGURANCA/modelo-de-ameacas.md` — o que cada grant protege
- `supabase/migrations/` — a fonte
- `scripts/pg-local.sh` — sobe um Postgres descartável e prova que tudo isto aplica

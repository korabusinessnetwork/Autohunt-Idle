# Spec de execução: plano de segurança estrutural consolidado

- **Fecha:** D9 do backlog; a parte de `docs/11_SEGURANCA/` que D5 listava por engano
- **Destrava:** D8 (mercado P2P) — escrever o plano específico é a condição registrada
- **Rodada do loop:** 8ª

## 1. O problema, dito com precisão

`docs/11_SEGURANCA/README.md` **não está vazio**. São 97 linhas de plano real: modelo de
ameaças por camada, checklist de release, compliance 18+/LGPD com a análise do ECA Digital,
resposta a incidentes e análise de custo.

O problema é a **ordem em que as coisas aconteceram**. O plano foi escrito na fundação, antes de
existir uma migration sequer. Hoje existem 11 migrations, 40+ funções, GRANT por coluna, RNG
determinístico e uma economia de duas moedas. Nada disso está no plano. Consequências concretas,
todas verificadas antes de escrever esta spec:

1. **O checklist não aponta para teste nenhum.** "RLS ativa em todas as tabelas" é um `[ ]` que
   alguém precisa lembrar de conferir à mão — quando existe, desde a Fase 1, um teste chamado
   *"toda tabela criada tem RLS habilitada"* que reprova o build. O plano pede fé onde já há prova.
2. **Controles que o plano cita como obrigatórios não existem.** "Secret scanning ativo" e
   "`npm audit` sem vulnerabilidade crítica" estão marcados como controle de release — e **não há
   `.github/` no repositório**. Nenhum CI roda nada.
3. **Uma regra do `CLAUDE.md` está sendo violada pelo próprio schema.** "Nunca `select *` em
   tabelas sensíveis — sempre campos explícitos" e, na tabela que a regra nomeia:
   `grant select on public.assinatura to authenticated` — sem lista de colunas, incluindo
   `referencia_externa` (o identificador do jogador no gateway).
4. **A promessa de LGPD não tem uma linha de código.** O plano diz que exportar e excluir dados
   "não é feature depois", e o rascunho de termos promete os dois ao usuário. Não existe RPC,
   serviço, botão nem teste.
5. **As ameaças da economia atual não estão no modelo.** Duplicação de crédito, corrida na compra
   de ouro, o débito único de diamante — três coisas que o código já fecha e que o plano não sabe
   que existem, e portanto não protege contra regressão.

## 2. Escopo

Consolidar o plano em documentos que **apontam para prova**, e fechar as duas lacunas que dá para
fechar agora sem depender de decisão do dono nem de serviço pago.

### 2.1 Documentação (o deliverable principal)

| Arquivo | O que é |
|---|---|
| `docs/11_SEGURANCA/README.md` | Índice e princípios. Deixa de ser o plano inteiro e passa a ser a porta de entrada |
| `docs/11_SEGURANCA/modelo-de-ameacas.md` | Modelo por superfície, reconciliado com o schema real — cada ameaça aponta a função e o teste |
| `docs/11_SEGURANCA/checklist-de-release.md` | Cada linha é um comando que roda ou um passo manual explícito. Zero item de fé |
| `docs/11_SEGURANCA/dados-pessoais-lgpd.md` | Inventário do dado pessoal e o desenho de exportar/excluir |
| `docs/11_SEGURANCA/plano-mercado-p2p.md` | O plano específico que `memory/restrictions.md` exige antes de construir |

### 2.2 Código

- **Migration** `20260821_lgpd_exportar_e_excluir.sql`: RPCs `exportar_meus_dados()` e
  `excluir_minha_conta()`; grant de `assinatura` reduzido a colunas explícitas.
- **Serviço** `contaService.ts` e a UI dos dois botões em Configurações.
- **CI** `.github/workflows/ci.yml`: `npm test`, `npm run build`, `npm audit`, e varredura de
  segredo — tudo em tier gratuito (restrição de custo).
- **Testes** dos invariantes novos.

## 3. Fora de escopo — e por quê

- **Construir o mercado P2P.** Esta rodada escreve o plano que o destrava; construir é a rodada
  seguinte, com spec própria.
- **RLS exercitada por JWT real.** O stub reproduz `auth.uid()`, não um JWT. Fechar isso exige um
  projeto Supabase de verdade — o plano registra *como* fechar, e vira item de release.
- **Revisão jurídica.** O próprio plano recomenda advogado antes do lançamento público. Nada aqui
  substitui isso, e o documento diz isso em voz alta.
- **Monitoramento/WAF pago.** Restrição de custo: adiado por padrão até decisão do dono.

## 4. Critérios de aceite

1. `README.md` vira índice: princípios, mapa dos documentos e o registro de que o plano foi
   reconciliado com o código em 2026-08-11.
2. O modelo de ameaças cobre **todas as superfícies que existem hoje**: sessão/farm offline,
   crédito de anúncio, assinatura, loot e dungeon, equipamento e fortificação, economia de
   diamante/ouro, ranking e apelido, cadastro e idade, portal/iframe, armazenamento local.
3. **Toda ameaça já fechada aponta o nome exato do teste que a fecha** — de `contratoRpc.test.ts`
   ou o rótulo do `checar()` em `teste-migrations.sql`. Ameaça sem prova é marcada **ABERTA**, com
   o que falta.
4. O checklist de release não tem item que dependa de alguém lembrar: cada linha é um comando ou
   um passo manual escrito por extenso.
5. **`exportar_meus_dados()`** devolve, num JSON só, todo dado pessoal e de progresso do jogador
   que chamou — e só dele.
6. **`excluir_minha_conta()`** apaga a conta e tudo que pende dela, sem deixar órfão. É
   irreversível, e a UI diz isso antes.
7. As duas RPCs são `SECURITY DEFINER` com `search_path` fixo, operam **exclusivamente** sobre
   `auth.uid()` e não aceitam `player_id` como parâmetro — não existe forma de exportar ou apagar
   a conta de outra pessoa.
8. `assinatura` deixa de ser `grant select` de tabela inteira: colunas explícitas, sem
   `referencia_externa` nem `provedor`.
9. Existe CI que roda `npm test`, `npm run build`, `npm audit` e varredura de segredo — em tier
   gratuito, sem serviço contratado.
10. O plano de mercado P2P cobre, no mínimo: o que é negociável e o que nunca é, a atomicidade da
    troca, o sink de taxa, moderação e denúncia, verificação de idade, o vetor de lavagem entre
    contas, e o que precisa existir **antes** da primeira linha de código.
11. `npm test`, `npm run build` e `./scripts/pg-local.sh` verdes.
12. Backlog atualizado: D9 fechado, D8 com o bloqueio reformulado, e o que ficou aberto registrado.

## 5. Edge cases

- **Exportar conta anônima** — funciona. Não tem e-mail nem data de nascimento, e o JSON reflete
  isso em vez de falhar.
- **Excluir e voltar a jogar** — a sessão morre junto. O jogo abre uma conta anônima nova, do
  zero; não há "desfazer".
- **Excluir com assinatura ativa** — a conta some do nosso lado, mas a cobrança vive no gateway.
  O texto precisa dizer para cancelar lá, senão o jogador continua sendo cobrado por um jogo que
  não existe mais para ele. É prevenção de erro, não mensagem de erro.
- **Exportar durante farm pendente** — o JSON traz o pendente como pendente. Exportar não coleta,
  não credita e não muda nada.

## 6. Definição de "aprovado sem ressalvas"

Os 12 critérios verificados; nenhuma linha de checklist que dependa de memória; nenhuma ameaça
marcada "fechada" sem o nome do teste que a fecha; e as duas RPCs de LGPD provadas contra
Postgres de verdade, inclusive a tentativa de alcançar a conta de outro jogador.

---

# Resultado da review — 2026-08-11

`npm test`: **174 passando** (165 → 174, +9). `npm run build`: **verde**, orçamento em 0,43 MB de 8 MB.
`./scripts/pg-local.sh`: **12 migrations aplicam e o teste de fumaça passa**, com uma seção nova
(`== dados pessoais (LGPD) ==`) que exporta e apaga contra Postgres 16 de verdade.

## Auditoria dos 12 critérios

| # | Veredito | Evidência |
|---|---|---|
| 1 | sim | `README.md` virou índice: princípios, mapa dos 5 documentos, estado em uma tela e o registro do que mudou |
| 2 | sim | 10 superfícies, **53 ameaças** — farm offline, anúncio, assinatura, economia, loot/dungeon/fortificação, cadastro/idade, isolamento, LGPD, client/portal, e §10 com o que o modelo não cobre |
| 3 | sim | **43 FECHADAS**, cada uma com o nome do teste; 5 MITIGADAS; 4 ABERTAS; 1 ACEITA por proporcionalidade. Nenhuma marcada fechada sem prova citável |
| 4 | sim | §1 são comandos; §3 a §6 são passos manuais com o resultado esperado escrito ("*Esperado:* zero linha — não erro de permissão, **zero linha**") |
| 5 | sim | `exportar_meus_dados()` com 7 seções; `a exportação traz o progresso de quem chamou` e `a exportação inclui a seção %s` |
| 6 | sim | `excluir_minha_conta()`; `a exclusão não deixa órfão em %s` percorre as 8 tabelas |
| 7 | sim | `as RPCs de LGPD não alcançam a conta de outro jogador` — a garantia é a **ausência** do parâmetro; `a exportação não vaza dado de outro jogador` confere o JSON |
| 8 | sim | grant com lista explícita, sem `referencia_externa` nem `provedor`; `a referência do gateway nunca é concedida ao jogador` |
| 9 | sim | `.github/workflows/ci.yml` — dois jobs, tudo em tier gratuito |
| 10 | sim | os 7 pontos cobertos, mais o vetor de lavagem com a tabela de controles e seus limites |
| 11 | sim | as três verificações verdes |
| 12 | sim | D9 fechado, D8 reformulado, D10 e D11 abertos |

## O que a reconciliação encontrou — e não era conhecido

O objetivo era documentar. Três coisas apareceram no caminho, e todas viraram correção:

1. **`grant select on public.assinatura to authenticated`, sem lista de colunas.** O `CLAUDE.md`
   proíbe `select *` em tabela sensível e **nomeia a assinatura**. O grant expunha
   `referencia_externa` — o identificador do jogador dentro do gateway. O client nunca leu essas
   colunas (recebe tudo por `montar_snapshot`), então o grant largo não servia a ninguém.
   **Corrigido na migration da fundação**, para banco novo nunca passar pelo estado ruim, e
   repetido em `20260821` para banco já criado convergir.
2. **Não existia `.github/`.** O plano listava "secret scanning ativo" e "`npm audit` sem crítico"
   como controles obrigatórios de release, num repositório onde nada rodava sozinho.
3. **Três ameaças estavam sendo chamadas de "fechadas por desenho"** — sem cartão no schema, sem
   `random()`, sem `service_role` no bundle. Verdadeiras, e nenhuma testada. Como o documento
   proíbe justamente isso, viraram teste em vez de virarem exceção à própria regra.

## Decisões de implementação que valem registro

- **As RPCs de LGPD não recebem `player_id`.** Isolamento por ausência de parâmetro, não por
  checagem: não existe validação que alguém possa esquecer de escrever.
- **Exclusão por cascata, não tabela por tabela.** Tabela criada amanhã já nasce coberta; uma
  lista explícita precisaria ser lembrada — e a lista esquecida é como dado órfão sobrevive.
- **`superficieDoClient.test.ts` ignora comentários.** Os comentários do projeto citam
  `service_role` justamente para dizer que ela não está ali; auditar o texto cru acusaria a
  explicação. Mesma armadilha que o teste de `tenant_id` já tinha encontrado.
- **O plano de P2P proíbe texto livre** (sem nome de listagem, sem descrição). É o que permite
  construir o mercado **sem moderação de conteúdo** — o custo recorrente que a restrição original
  estava tentando evitar. Se texto livre entrar, o documento inteiro reabre.
- **Mercado cego é recomendação, não decisão.** Ataca a lavagem na causa, mas custa liquidez com
  poucos jogadores. Muda o schema, então precisa ser decidido antes de construir.

## Ressalvas que continuam valendo

- **RLS não é exercitada por JWT real.** O stub reproduz `auth.uid()` de uma variável de sessão.
  A política pode estar sintaticamente certa e semanticamente errada. Virou §4 do checklist.
- **Excluir a conta não cancela a assinatura no gateway.** Hoje só há aviso na UI. Fecha com P3.
- **Nada disto é aconselhamento jurídico**, e a revisão por advogado segue sendo o único item pago
  que este projeto recomenda não adiar.

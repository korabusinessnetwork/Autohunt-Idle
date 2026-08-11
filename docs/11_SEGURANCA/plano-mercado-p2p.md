# Plano de segurança — mercado entre jogadores (P2P)

> **Este é o documento que `memory/restrictions.md` exige.** A restrição diz, literalmente, que
> chat e marketplace "entram no roadmap só com **plano de segurança específico escrito primeiro**".
> Enquanto ele não existia, `specs/mercado-diamante.md` (critérios 5 a 7) estava bloqueada — não
> por escopo, por restrição registrada.
>
> **Status:** escrito em 2026-08-11. Destrava a construção **sob as condições da seção 7**, que
> não são recomendações.

---

## 1. Por que um mercado P2P é diferente de tudo que já existe no jogo

Todo sistema construído até aqui tem uma propriedade em comum: **o servidor é a única fonte de
valor, e o jogador só recebe.** Loot, XP, ouro, diamante — tudo nasce numa RPC que o client não
alcança. Não há caminho de um jogador para outro.

O mercado quebra isso. Pela primeira vez, **valor sai de uma conta e entra em outra**. Cinco coisas
mudam de natureza de uma vez:

1. **Surge um canal entre pessoas.** Preço, nome de item e nome de listagem são conteúdo gerado por
   usuário — mesmo sem chat, dá para se comunicar por eles.
2. **Surge um incentivo para invadir contas.** Hoje roubar uma conta rende progresso inútil para o
   ladrão; com mercado, rende item vendável.
3. **Surge o vetor de lavagem.** Duas contas do mesmo dono podem transferir valor de uma para a
   outra. Isso é a rota indireta que reabre a análise regulatória inteira.
4. **Surge assimetria entre jogadores.** Quem entende de economia extrai de quem não entende — e o
   público é 18+, mas "adulto" não é sinônimo de "protegido".
5. **A trapaça passa a ter comprador.** Um exploit que hoje só infla o próprio personagem passa a
   virar item negociável.

Nenhuma dessas cinco existe hoje. Por isso o plano não é "aplicar os mesmos controles a mais uma
tabela".

## 2. O invariante que não se negocia

> **Diamante nunca vira dinheiro de volta, por rota nenhuma.**

É o que sustenta vender diamante como moeda de jogo em vez de disparar a análise de transmissão de
valor entre pessoas (`specs/mercado-diamante.md`, nota de design). Hoje é testado:
`nenhuma rota converte diamante, ouro ou item em dinheiro`.

**O mercado não pode afrouxar isso, e um mercado o pressiona por dois lados:**

- **Direto:** qualquer "vender item por dinheiro" ou "sacar saldo". Nunca existe.
- **Indireto:** venda de conta fora da plataforma. Proibida por termo, e **o código não consegue
  fechar sozinho** — só detecção comportamental. É por isso que a cláusula precisa estar no termo
  de uso antes do lançamento, não depois (`checklist-de-release.md` §5).

Um mercado torna a venda de conta *lucrativa*, o que muda a probabilidade da rota indireta mesmo
sem mudar uma linha do código.

## 3. O que é negociável — e o que nunca é

| Categoria | Negociável? | Por quê |
|---|---|---|
| Arma, capacete, armadura, luva, bota, acessório | **Sim** | São o objeto econômico do jogo |
| **Skin** | **Nunca** | Exclusividade é o valor dela. Vale inclusive para a skin de passe — que fica exclusiva por consequência da regra geral, não por caso especial |
| **Chave de dungeon** | **Nunca** | É bilhete pessoal. Negociável, viraria moeda paralela sem sink |
| **Pedra de fortificação** | **Nunca** | Vender pedra reabre a restrição de recompensa aleatória paga (ameaça 4.6). Já existe teste: `nenhuma rota vende pedra de fortificação`, e ele precisa continuar valendo **depois** do mercado |
| **Ouro e diamante avulsos** | **Nunca** | Transferir moeda pura, sem bem no meio, é transferência de valor sem outra função. É o desenho que os reguladores olham primeiro |

**A regra que resume:** o mercado troca **bens** por diamante. Nunca troca moeda por moeda, nunca
troca bem por dinheiro.

## 4. Controles técnicos obrigatórios

Cada um vira teste, no mesmo padrão do resto do projeto. Ameaça sem teste não conta como fechada.

### 4.1 Atomicidade

A troca move três coisas: diamante do comprador, diamante para o vendedor (menos taxa), e o item.
**Uma transação, uma RPC `SECURITY DEFINER`, ou nada acontece.**

- A listagem é travada com `for update` antes de qualquer escrita — duas compras simultâneas da
  mesma listagem não podem passar as duas.
- A RPC recebe **só o id da listagem**. Nunca preço, nunca quantidade: o preço vem da tabela, do
  lado do servidor. Mesmo princípio de `comprar_ouro`, e pelo mesmo motivo.
- *Teste:* duas compras concorrentes da mesma listagem → uma vence, a outra recebe
  `LISTAGEM_INDISPONIVEL`, e nenhum saldo se move na perdedora.

### 4.2 O item precisa estar mesmo lá

O erro clássico de mercado é duplicação: o item é vendido e continua no inventário do vendedor.

- Listar **move** o item para custódia (`slot = null` e um estado `listado`), não apenas o marca.
- Item listado não pode ser equipado, sintetizado nem fortificado — as três RPCs precisam ignorá-lo
  explicitamente.
- *Teste:* listar → tentar sintetizar → recusa; e a contagem total de itens do jogo não muda em
  nenhum ponto do ciclo listar/comprar/cancelar.

### 4.3 Taxa como sink, cobrada na listagem

Cobrada **ao listar**, não ao vender (critério 7 da spec de origem). Duas razões, e a segunda é de
segurança:

1. Desestimula spam de listagem vazia.
2. **Torna a lavagem cara.** Mover valor entre duas contas do mesmo dono passa a custar uma
   fração a cada salto. Não impede — encarece, e encarecer é o controle proporcional aqui.

- *Teste:* o diamante debitado do comprador é maior que o creditado ao vendedor, e a diferença
  some do sistema (não vai para conta nenhuma).

### 4.4 Preço com piso e teto

Preço livre de verdade é o canal de comunicação mais fácil de um mercado sem chat — e o veículo de
golpe mais simples (item de 1 diamante listado a 100.000 esperando engano).

- Piso e teto por raridade, publicados na tela.
- *Teste:* listagem fora da faixa é recusada.

### 4.5 Sem texto livre

**Nenhum campo de texto escrito pelo jogador entra no mercado.** Sem nome de listagem, sem
descrição, sem recado. A listagem é composta **inteiramente** de dado estruturado: tipo, raridade,
fortificação, conjunto, preço.

É o que permite construir o mercado **sem moderação de conteúdo** — que é o custo real e recorrente
que a restrição original estava tentando evitar. O único texto de jogador visível a terceiros
continua sendo o apelido, que já é único, tem gate de cadastro e tem tamanho limitado.

> **Se algum dia entrar texto livre, este documento inteiro precisa ser reaberto** — e junto com
> ele, a exigência de moderação e as regras do portal (a Poki exige aprovação prévia e uso das
> ferramentas de moderação dela para qualquer conteúdo gerado por usuário).

### 4.6 Rastro completo

Toda listagem, compra, cancelamento e expiração vira linha em `evento_jogo`, com vendedor,
comprador, item, preço e taxa. Sem isso, investigar lavagem ou golpe é impossível depois do fato.

- *Teste:* uma compra bem-sucedida deixa exatamente um evento com os dois `player_id`.

### 4.7 Limite de volume

O primeiro controle contra lavagem industrial e contra bot.

- Teto de listagens ativas por jogador, e teto de transações por janela de tempo.
- *Teste:* passar do teto é recusado com código próprio, sem consumir nada.

## 5. Vetor de lavagem entre contas — o mais difícil

**Não tem solução técnica completa, e fingir que tem seria pior do que registrar o limite.**

Duas contas do mesmo dono, uma listando barato e a outra comprando, movem valor de A para B. É
inerente a qualquer mercado P2P. O que dá para fazer:

| Controle | Efeito | Limite |
|---|---|---|
| Taxa na listagem | Encarece cada salto | Não impede, só reduz margem |
| Piso/teto de preço | Impede o salto de valor arbitrário numa transação só | Contornável em várias transações |
| Rastro completo | Torna o padrão detectável **depois** | Não é prevenção |
| Mercado cego (sem escolher o vendedor) | Impede combinar a ponta | Só funciona se houver liquidez real |
| Limite de volume | Limita escala | Contornável com mais contas |

**Recomendação:** começar com **mercado cego** — o comprador vê o item mais barato daquela
categoria, não escolhe de quem compra. Duas contas do mesmo dono não conseguem se encontrar de
propósito. Custa liquidez no começo (com poucos jogadores, o mercado cego é raso), e por isso a
decisão é do dono, não minha. Mas é o controle que ataca a causa em vez do sintoma.

## 6. Idade e capacidade

O produto já é 18+ com gate no banco (ameaça 6.1), e um mercado **não muda o público** — muda o
**risco de um menor que passou pelo gate mentindo**, porque agora há valor econômico envolvido.

- Listar ou comprar exige `identidade_verificada` — mesmo gate do ranking. **Conta anônima não
  participa**, e isso já é natural: sem cadastro, a conta é irrecuperável, e um mercado atado a
  uma conta que some é armadilha.
- A verificação por documento continua adiada por custo e por proporcionalidade. **Se o mercado
  movimentar valor relevante, essa proporcionalidade muda** — e a decisão volta à mesa.

## 7. Condições de entrada — o que precisa existir ANTES da primeira linha de código

Não são recomendações. São o que faz este plano valer como o "plano específico escrito primeiro".

1. **Termo de uso revisado por advogado, publicado, em pt e en**, com a cláusula de diamante sem
   valor monetário e a proibição de venda/transferência de conta. Hoje é rascunho
   (`termos-de-uso-rascunho.md`). **É o único bloqueio pago da lista, e não tem alternativa
   gratuita** — mercado sem termo publicado é exposição direta, e a análise regulatória inteira
   depende de uma cláusula que ainda não foi validada por ninguém com formação jurídica.
2. **Canal de denúncia e um caminho de suporte que funcione.** Mercado sem "reportar" é mercado sem
   correção. Não precisa ser sofisticado — precisa existir e ser lido.
3. **Decisão do dono sobre mercado cego × mercado aberto** (seção 5). Muda o schema, não é
   ajustável depois sem migração.
4. **Decisão sobre piso e teto de preço por raridade** (4.4). Depende de dado de economia que só
   existe com jogador real — **é o item que mais argumenta por rodar a Fase 2 antes**.
5. **P4 respondido**, se o canal for Poki: se ela bloqueia chamada ao Supabase, nada disso roda lá;
   e conteúdo gerado por usuário exige aprovação prévia dela.
6. **Spec de execução própria**, com critérios de aceite, no mesmo formato das outras rodadas.

## 8. O que este plano deliberadamente NÃO autoriza

- **Chat.** Continua bloqueado, e não é escopo deste documento. Um mercado sem texto livre (4.5)
  existe sem moderação de conteúdo; chat não.
- **Negociação direta entre jogadores** (proposta, contraproposta, troca de item por item). Cada
  uma reabre o canal de comunicação que 4.5 fecha.
- **Presentear item.** Transferência sem contrapartida é o vetor de lavagem em estado puro, sem
  nem a taxa para encarecer.
- **Mercado de moeda.** Ouro por diamante já existe na loja do operador, com quantidade fixa
  (`comprar_ouro`). Entre jogadores, nunca.

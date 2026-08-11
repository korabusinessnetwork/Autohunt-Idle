# Spec: Fortificação de item por RNG, com pedras (estilo DDTank)

*(estende `specs/dungeons-loot-skins.md` e `specs/equipamento-e-poder.md`)*

**Status: DECIDIDA — buildável assim que `specs/equipamento-e-poder.md` existir.**
Pedido registrado por Matheus em 2026-08-11: "sistema de fortificação de item por RNG, com
pedras específicas que nem DDTank".

**Decisões do dono (2026-08-11):**

1. Fortificação **custa ouro**, nunca diamante; existe uma loja que **vende ouro por diamante**.
   Ver seção 2.1 — resolve o conflito de compliance, sob três condições, e uma delas é de
   balanceamento, não de código.
2. **Falhar só gasta o material** — o item nunca é rebaixado nem destruído. Adotada a Opção A da
   seção 3, e o princípio "progresso nunca é punido" (`memory/identity.md`) segue valendo sem
   exceção.

## 1. Escopo pretendido

Fortificar um item equipável (arma, acessório) subindo um nível de fortificação — `+1`, `+2`,
`+3`… — com **chance de sucesso decrescente** a cada nível, gastando **pedras** de tipos
distintos, no espírito do DDTank:

- **Pedra de Fortificação** — o material base de cada tentativa
- **Pedra da Sorte** — aumenta a chance de sucesso da tentativa
- **Pedra de Proteção** — protege contra a consequência da falha

Fortificação é **poder**, não cosmético: soma stat ao item, e por isso interage com
`specs/equipamento-e-poder.md` (que ainda não foi construído).

## 2. Os dois conflitos que travam esta spec

### 2.1 Pagamento — RESOLVIDO com ouro, sob três condições

`memory/restrictions.md` traz uma restrição **CRÍTICA e permanente**:

> **Sem loot box / recompensa aleatória paga** — único item de jogo eletrônico vedado
> explicitamente pelo ECA Digital (Lei 15.211/2025) para menores; mantido fora do produto inteiro
> mesmo sendo 18+, para não reabrir a questão se o público mudar.

**Decisão do dono:** fortificação custa **ouro** (a moeda ganha jogando, `jogador.moeda`), e
existe uma loja que **vende ouro por diamante**.

Vale ser preciso sobre por que isso resolve, porque **não é o degrau a mais que resolve.** Uma
cadeia dinheiro → diamante → pedra-aleatória continuaria sendo recompensa aleatória paga com um
passo no meio, e órgãos reguladores já olham através desse tipo de degrau. O que muda a natureza
da coisa é outra: **a compra em si deixa de ser o sorteio.**

- Comprar uma caixa: você paga e **não sabe o que vem**. A compra É a aposta.
- Comprar ouro: você paga e recebe **uma quantidade exata e publicada**. Não há aleatoriedade
  nenhuma na transação.
- Gastar ouro numa fortificação: é uma ação de jogo, com chance publicada, usando uma moeda que
  se ganha jogando.

É a mesma estrutura de comprar ouro num MMO e depois pagar um NPC por um encantamento que pode
falhar — que não é tratado como caixa aleatória. E encaixa direto no critério 4 de
`specs/mercado-diamante.md`: ouro é "item específico e conhecido".

**As três condições que sustentam isso** (se qualquer uma cair, o argumento cai junto):

1. **A compra entrega quantidade fixa e publicada.** X diamantes = Y ouro, sempre, sem faixa,
   sem bônus aleatório, sem "pacote surpresa".
2. **Ouro precisa ser genuinamente ganhável jogando**, em ritmo que torne a fortificação viável
   sem comprar nada. Se o preço em ouro for calibrado para forçar a compra, o caminho gratuito
   vira fachada e a estrutura volta a ser paga. **Isto é balanceamento, não código** — e é a
   condição mais fácil de furar sem perceber.
3. **A chance de sucesso aparece em número antes da tentativa** (restrição ética de transparência
   já registrada em `memory/restrictions.md`).

**Efeito colateral bom:** hoje o ouro não tem *nenhum* uso no jogo — ele se acumula em
`jogador.moeda` e nunca é gasto. A fortificação passa a ser o primeiro sink de ouro do produto,
que é exatamente o que faltava para a moeda de farm significar alguma coisa.

### 2.2 Punição da falha — RESOLVIDO: falha só gasta o material

`memory/identity.md`, Princípios do Produto:

> Progresso nunca é punido — só multiplicado pela presença

Esse princípio já custou uma mecânica ao projeto: foi exatamente por causa dele que
`specs/dungeons-loot-skins.md` **excluiu o permadeath**, apesar de ele ser a identidade do jogo
que inspirou o combate. E é o mesmo princípio que fez o critério 16 do core garantir que zerar a
Vitalidade custa só o ciclo em andamento.

No DDTank, falhar pode derrubar o nível de fortificação — e é justamente essa perda que dá
sentido à Pedra de Proteção. Trazer a mecânica inteira significa reverter o princípio; trazer só
metade dela deixa a Pedra de Proteção sem função.

**Decisão do dono: falha só gasta o material.** O princípio segue intacto, e a Pedra de Proteção
é substituída pela Pedra de Garantia — que, em vez de proteger de uma perda que não existe, torna
a próxima tentativa certa.

## 3. As duas opções *(A foi a escolhida)*

### Opção A — falha só gasta o material *(recomendada, e assumida nos critérios abaixo)*

- Falhar **consome o ouro e as pedras e não mexe no item**: o nível de fortificação nunca cai, o
  item nunca quebra.
- As três pedras viram: **Fortificação** (material da tentativa), **Sorte** (melhora a chance) e
  **Garantia** (torna a tentativa certa) — a terceira substitui a de Proteção, que perde função
  quando não há punição da qual proteger.

A tensão do RNG continua existindo — você perdeu ouro e pedra, e pedra boa é rara —, mas o que
você já conquistou não regride.

### Opção B — DDTank fiel

- Falhar pode **derrubar o nível de fortificação**; a Pedra de Proteção evita isso.

**Exige ADR revertendo "progresso nunca é punido"**, o mesmo princípio que já custou o permadeath
ao projeto. Não é impossível; é decisão de princípio de produto, e das grandes.

## 4. Pergunta que ainda destrava esta spec

**Falhar pode rebaixar o item, ou só gasta o material?**
Recomendo: só gasta. Rebaixar contradiz um princípio registrado e já usado para cortar outra
mecânica.

## 5. Critérios de aceite (redigidos para a Opção A — reescrever se você escolher a B)

### Economia

1. Fortificar custa **ouro** (`jogador.moeda`) — nunca diamante, nunca dinheiro real, em nenhuma
   etapa.
2. Existe uma loja que **vende ouro por diamante**, em **quantidade fixa e publicada**: X
   diamantes entregam sempre exatamente Y ouro. Sem faixa, sem bônus aleatório, sem pacote
   surpresa.
3. Ouro continua sendo **ganho jogando**, como já é hoje, e o preço da fortificação é calibrado
   para o caminho gratuito ser viável sem comprar nada. *(Balanceamento — a condição mais fácil
   de furar sem perceber, e a que sustenta o argumento de compliance da seção 2.1.)*
4. As **pedras só caem jogando** (dungeon, mini boss, síntese). Nunca vendidas por diamante nem
   por ouro comprado — pedra é loot, não mercadoria.

### Mecânica

5. Fortificação vai de `+0` a um teto definido, com **chance de sucesso decrescente** por nível.
6. Cada tentativa consome **ouro + 1 Pedra de Fortificação**, com ou sem sucesso.
7. **Falhar não rebaixa nem destrói o item** — o nível de fortificação nunca cai.
8. A **Pedra da Sorte** é opcional na tentativa e aumenta a chance de sucesso; consumida junto.
9. A **Pedra de Garantia** torna a tentativa **certa**, e é a mais rara das três.
10. O sorteio é **determinístico e semeado no servidor**, como todo o resto do loot — o client
    nunca informa resultado, custo ou material gasto além do pedido.
11. O nível de fortificação **soma stat ao item** conforme `specs/equipamento-e-poder.md`.

### Transparência

12. A UI mostra a **chance de sucesso em número, antes** da tentativa, e o custo exato em ouro —
    sem esconder a probabilidade (restrição ética já registrada em `memory/restrictions.md`).
13. A loja de ouro mostra **quanto ouro por quantos diamantes**, sem letra miúda e sem contagem
    regressiva artificial (restrição contra dark pattern de urgência).

## 6. Dependências

1. **`specs/equipamento-e-poder.md` construído** — sem stat de item, não há o que fortificar.
2. **Diamante existindo** (`specs/mercado-diamante.md`) — a loja de ouro depende dele, e ele
   depende de gateway de pagamento contratado, que segue pendente (P3 do backlog).

A ordem natural é: equipamento → fortificação (parte de ouro e pedras) → loja de ouro, quando o
diamante existir. As duas primeiras não dependem de nenhuma decisão de negócio pendente.

## 7. Definição de "aprovado sem ressalvas"

Os 13 critérios verificados; teste provando que **nenhuma rota vende pedra por diamante**; teste
provando que **uma falha deixa o item exatamente como estava**; teste provando que a **conversão
diamante → ouro é de quantidade fixa**, sem aleatoriedade; e a chance exibida na UI batendo com a
que o servidor aplica.

# Spec: Fortificação de item por RNG, com pedras (estilo DDTank)

*(estende `specs/dungeons-loot-skins.md` e `specs/equipamento-e-poder.md`)*

**Status: BLOQUEADO — precisa de duas decisões do dono antes de virar buildável.**
Pedido registrado por Matheus em 2026-08-11: "sistema de fortificação de item por RNG, com
pedras específicas que nem DDTank".

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

### 2.1 Se a pedra for comprável com diamante, isso é recompensa aleatória paga

`memory/restrictions.md` traz uma restrição **CRÍTICA e permanente**:

> **Sem loot box / recompensa aleatória paga** — único item de jogo eletrônico vedado
> explicitamente pelo ECA Digital (Lei 15.211/2025) para menores; mantido fora do produto inteiro
> mesmo sendo 18+, para não reabrir a questão se o público mudar.

E `specs/mercado-diamante.md`, critério 4, reforça: a loja "vende item específico e conhecido por
diamante — **nunca** caixa aleatória/sorteio".

Pagar dinheiro real por uma tentativa que pode falhar é, funcionalmente, comprar um resultado
aleatório. O nome no botão muda; a mecânica, não.

**Isso não é uma preferência de design — é a restrição de compliance de maior prioridade do
projeto**, e furá-la exige um ADR explícito do dono assumindo o risco legal, não uma decisão de
implementação.

### 2.2 Se a falha rebaixar o item, isso contradiz um princípio registrado

`memory/identity.md`, Princípios do Produto:

> Progresso nunca é punido — só multiplicado pela presença

Esse princípio já custou uma mecânica ao projeto: foi exatamente por causa dele que
`specs/dungeons-loot-skins.md` **excluiu o permadeath**, apesar de ele ser a identidade do jogo
que inspirou o combate. E é o mesmo princípio que fez o critério 16 do core garantir que zerar a
Vitalidade custa só o ciclo em andamento.

No DDTank, falhar pode derrubar o nível de fortificação — e é justamente essa perda que dá
sentido à Pedra de Proteção. Trazer a mecânica inteira significa reverter o princípio; trazer só
metade dela deixa a Pedra de Proteção sem função.

## 3. As duas opções

### Opção A — RNG sem punição *(recomendada)*

- Pedras **só caem jogando** (dungeon, mini boss, síntese). Nunca compráveis com diamante.
- Falhar **consome a pedra e não mexe no item**: o nível de fortificação nunca cai, o item nunca
  quebra.
- As três pedras viram: **Fortificação** (a tentativa), **Sorte** (melhora a chance da tentativa),
  **Garantia** (torna a próxima tentativa certa) — a terceira substitui a de Proteção, que perde
  função sem punição.

**Respeita as duas restrições.** A tensão do RNG continua existindo (você perde a pedra, e pedra
boa é rara), mas o que você já conquistou não regride.

### Opção B — DDTank fiel

- Falhar pode **derrubar o nível de fortificação**; a Pedra de Proteção evita isso.
- Se as pedras forem compráveis com diamante, some também com a restrição de recompensa aleatória
  paga.

**Exige ADR revertendo "progresso nunca é punido"** — e, se envolver compra, um segundo ADR
assumindo o risco de compliance do ECA Digital. Não é impossível; é uma decisão de princípio de
produto, e das grandes.

## 4. Perguntas que destravam esta spec

1. **As pedras podem ser compradas com diamante, ou caem só jogando?**
   Recomendo: só jogando. Comprar transforma o sistema em recompensa aleatória paga.
2. **Falhar pode rebaixar o item, ou só gasta a pedra?**
   Recomendo: só gasta a pedra. Rebaixar contradiz um princípio já registrado e já usado para
   cortar outra mecânica.

## 5. Critérios de aceite (redigidos para a Opção A — reescrever se você escolher a B)

1. Existem três tipos de pedra: **Fortificação**, **Sorte** e **Garantia**, todas como itens de
   inventário com raridade, como qualquer outro loot.
2. Pedra **nunca** é vendida por diamante nem por dinheiro real, em nenhuma loja, em nenhum
   pacote, sob nenhum nome.
3. Fortificação vai de `+0` a um teto definido, com **chance de sucesso decrescente** por nível.
4. Cada tentativa consome **1 Pedra de Fortificação**, com ou sem sucesso.
5. **Falhar não rebaixa nem destrói o item** — o nível de fortificação nunca cai.
6. A **Pedra da Sorte** é opcional na tentativa e aumenta a chance de sucesso; consumida junto.
7. A **Pedra de Garantia** torna a tentativa **certa**, e é a mais rara das três.
8. O sorteio é **determinístico e semeado no servidor**, como todo o resto do loot — o client
   nunca informa resultado, nível ou pedra gasta além do pedido.
9. O nível de fortificação **soma stat ao item** conforme `specs/equipamento-e-poder.md`.
10. A UI mostra a chance de sucesso **antes** da tentativa, em número — sem esconder a
    probabilidade (restrição ética de transparência, `memory/restrictions.md`).

## 6. Dependência

Esta spec **pressupõe `specs/equipamento-e-poder.md` construído**: sem stat de item, não há o que
fortificar. A ordem natural é equipamento primeiro, fortificação depois.

## 7. Definição de "aprovado sem ressalvas"

Os 10 critérios verificados; teste provando que **nenhuma rota vende pedra por diamante**; teste
provando que **uma falha deixa o item exatamente como estava**; e a chance exibida na UI batendo
com a que o servidor aplica.

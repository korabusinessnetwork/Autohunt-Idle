# ADR-005 — Três canais de dano, Destreza, e a arma que decide qual atributo conta

**Status**: Aceito
**Data**: 2026-08-14
**Decisores**: Matheus Bonato
**Supersede**: — (emenda `specs/build-fase-3c-equipamento.md` §17 e `specs/equipamento-e-poder.md`)
**Supersedido por**: —

---

## Contexto

Até esta data o jogo tinha **dois** canais de dano (`fisico`, `magico`) e quatro atributos. O poder
de ataque somava o atributo do canal da arma **inteiro** e o do outro canal **pela metade**
(`+ (v_secundario / 2)` em `poder_de_ataque`, `Math.floor(secundario / 2)` no espelho em
TypeScript).

O dono reportou isso como defeito, nestas palavras:

> *"o sistema de atributos tem que estar vinculado com a arma que o personagem usa por exemplo, se
> ele usa cajado tem que dar dano mágico, logo se ele upar força não pode aumentar o dano"*

E, na mesma conversa, pediu um quinto atributo:

> *"temos que criar o atributo destreza também"* — *"pra arqueiro"*

Os dois pedidos são o mesmo problema visto de dois lados. A meia-contribuição tornava a escolha de
atributo **morna**: errar custava pouco e acertar rendia pouco, então a tela de atributos não tinha
uma decisão de verdade dentro. E "Destreza para arqueiro" só significa alguma coisa se existir um
canal onde o arco cobre — senão Destreza seria um quinto atributo que não faz nada.

## Decisão

**Três canais, um atributo cada, duas famílias de arma cada. O atributo que casa conta inteiro; os
outros contam zero.**

| Canal | Atributo | Famílias |
|---|---|---|
| `fisico` | Força | espada, martelo |
| `destreza` | **Destreza** (novo) | arco, adaga |
| `magico` | Inteligência | cajado, varinha |

Decisões subordinadas, todas registradas aqui porque cada uma tinha um caminho mais fácil e errado:

1. **A identidade visual de toda arma já concedida é preservada.** A família sai de
   `embaralhar(id) % familias.length`. Com o canal físico caindo de 4 famílias para 2, o índice
   passa de `h % 4` para `h % 2` — e como `h % 2 = (h % 4) % 2`, existe **uma** ordem de lista que
   preserva tudo:

   ```
   h%4 = 0  espada   → h%2 = 0 → ARMAS_FISICAS[0]  = espada
   h%4 = 3  martelo  → h%2 = 1 → ARMAS_FISICAS[1]  = martelo
   h%4 = 1  adaga    → h%2 = 1 → ARMAS_DESTREZA[1] = adaga
   h%4 = 2  arco     → h%2 = 0 → ARMAS_DESTREZA[0] = arco
   ```

   Por isso `ARMAS_DESTREZA = ['arco', 'adaga']` — **invertido** em relação à ordem que qualquer
   um escreveria. Escrever `['adaga','arco']` trocaria a arma de metade dos jogadores em silêncio,
   com ícone, nome e jeito de atirar mudando juntos, **e a suíte inteira verde**. Medido:
   200 mil ids, 0 divergências. A migration reclassifica para `destreza` exatamente as armas com
   `h % 4 ∈ {1, 2}`.

2. **O SQL não reimplementa o FNV-1a de 32 bits.** Só os dois bits baixos importam, e eles
   sobrevivem sozinhos ao XOR e à multiplicação: `2166136261 mod 4 = 1` e `16777619 mod 4 = 3`.
   A recorrência `h := ((h # (ascii(c) & 3)) * 3) % 4`, começando em 1, reproduz
   `embaralhar(id) % 4` exatamente — medido em 250 mil ids, 0 divergências, incluindo ids que não
   são uuid. São quatro linhas de plpgsql em vez de um port de aritmética de 32 bits com três
   armadilhas conhecidas (o wrap do `Math.imul`, `charCodeAt` ser code unit e não byte, o `>>> 0`).

3. **Arma de conjunto fica fora da reclassificação.** O `tipo_dano` dela é ditado pelo tema
   (`tipo_dano_do_conjunto`). Reclassificá-la descasaria a arma das peças do próprio conjunto, que
   têm `afinidade` do tema, e mataria o +20% de todas de uma vez. O preço aceito: uma adaga de
   `cavaleiro-biscoito` passa a se desenhar como espada ou martelo — o que é **mais** temático.

4. **Dois conjuntos novos de destreza**, `arqueira-avela` e `ladina-amora`, espelhando as duas
   mágicas e as duas físicas. Conjunto neste projeto é puramente nominal (nome, canal e chave de
   i18n), então custa zero arte. Sem eles, a build de arqueiro nunca alcançaria o degrau de seis
   peças (×1,45) e nasceria estruturalmente mais fraca que as outras duas.

5. **A alocação de todo mundo é zerada e os pontos devolvidos**, com o precedente e o motivo de
   `20260829`. Sem isso, quem tem arco perderia a contribuição **inteira** de atributo na próxima
   abertura do jogo, sem aviso e sem explicação na tela. Respec é livre, então zerar não tira nada.

6. **O canal passa a se chamar pelo nome do atributo na tela** ("Tipo de dano: Destreza", não
   "Mágico"). Havia dois vocabulários para a mesma coisa — canal como adjetivo, atributo como
   substantivo. Com dois canais dava para tolerar; com três vira armadilha. Agora o item responde
   sozinho qual atributo upar, sem tutorial (Princípio nº1).

## Alternativas consideradas

### 1. Manter dois canais e só acrescentar Destreza como atributo de utilidade

- **Prós**: nenhuma migration de dado, nenhum risco de reclassificação, escopo minúsculo
- **Contras**: "Destreza para arqueiro" não teria onde aparecer — o arco continuaria pagando por
  Força, e o quinto atributo seria decoração
- **Descartado porque**: não atende o pedido. O dono não pediu um atributo, pediu uma build.

### 2. Manter a meia-contribuição do atributo fora do canal

- **Prós**: nenhuma perda de poder para ninguém, nenhuma necessidade de zerar alocação
- **Contras**: é exatamente o comportamento que o dono mandou derrubar, com nome e sobrenome
- **Descartado porque**: foi o pedido literal. E há uma razão de produto por trás dele: com meia
  contribuição, a decisão de atributo é morna dos dois lados.

### 3. Reclassificar as armas **sem** preservar a família (deixar o hash cair onde cair)

- **Prós**: migration de três linhas, sem helper, sem prova de paridade
- **Contras**: toda adaga e todo arco do jogo mudariam de desenho, nome e comportamento de combate
  da noite para o dia — e o jogador leria como bug de banco, porque os três mudam juntos
- **Descartado porque**: o hash existe justamente para o ícone não mudar quando a lista reordena
  (`src/game/armas.ts`). Quebrar isso na rodada que amplia o sistema seria trair a própria razão
  de ele existir.

### 4. Redistribuir também a `afinidade` das peças já existentes

- **Prós**: o acervo ficaria equilibrado nos três canais imediatamente, e o arqueiro teria peça de
  sinergia no dia 1
- **Contras**: afinidade é dado **sorteado**, não derivado — não há identidade a preservar, então
  qualquer redistribuição é arbitrária, e ela tiraria sinergia de quem não pediu nada
- **Adiado (não descartado)**: o sorteio de drop novo já é de três vias e o acervo se equilibra
  sozinho. Fica registrado como decisão do dono, caso ele prefira o acerto imediato.

## Consequências

### Positivas

- A escolha de arma passou a significar alguma coisa: ela decide qual atributo rende.
- Existe uma terceira build completa, com armas, atributo, conjuntos e sinergia próprios.
- O espelho de regra ganhou alarme onde não tinha: `espelhoDeRegra.test.ts` agora reprova o build
  se o TS e o SQL discordarem sobre qual atributo casa com qual canal, e se a divisão do secundário
  voltar por qualquer caminho — inclusive por um `rename` da variável.

### Negativas / trade-offs

- **Todo jogador perde a alocação atual** e precisa redistribuir. É devolução, não confisco, mas é
  atrito real na primeira abertura depois da migration.
- Peça de afinidade certa ficou **1/3** mais rara em vez de 1/2, e o acervo antigo fica
  temporariamente escasso em destreza (as mágicas não se dividiram). Só o drop novo é 1/3 cada.
- Uma minoria de armas de conjunto muda de silhueta (ver decisão 3).
- O schema passou a ter uma função (`canal_historico_da_arma`) que só serviu uma vez. Ela fica
  porque a migration precisa ser re-executável num projeto novo.

## Referências

- `supabase/migrations/20260830_destreza_e_canais_de_dano.sql` — a migration
- `src/game/armas.ts` — as três listas, e o comentário que explica que a ordem é carga
- `src/game/regrasEquipamento.ts` — `ATRIBUTO_DO_DANO`, o espelho da regra
- `src/game/espelhoDeRegra.test.ts` — as asserções que amarram os dois lados
- `docs/03_REGRAS_DE_NEGOCIO/` §3 e §5
- `specs/destreza-canais-de-dano-e-heroi-animado.md` — a spec desta rodada

## Notas de implementação

- `redistribuir_atributos` mudou de aridade (4 → 5). A versão de quatro **precisa** ser derrubada
  com `drop function`: `create or replace` com aridade diferente cria uma sobrecarga, e a antiga
  continuaria concedida — abrindo um caminho de ponto de atributo grátis. Ver `docs/07_APIS/`.
- `resolver_uma_dungeon` compara o poder do boss com a soma **crua** dos atributos. Sem incluir
  Destreza ali, uma build inteira de arqueiro somaria zero e nunca venceria uma dungeon — punição
  silenciosa criada pela própria rodada que promete a build.
- O `revoke` de `canal_historico_da_arma` é obrigatório: as *default privileges* do Supabase
  concedem `execute` por omissão.

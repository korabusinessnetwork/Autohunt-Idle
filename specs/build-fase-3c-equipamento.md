# Spec de execução: Fase 3 rodada 3 — equipamento, sinergia e conjunto

*(spec de **build**. Traduz `specs/equipamento-e-poder.md` em algo implementável e auditável.)*

- **Spec de origem:** `specs/equipamento-e-poder.md` (17 critérios)
- **Depende de:** rodadas 3a (atributos) e 3b (itens com raridade)
- **Destrava:** `specs/fortificacao-de-item.md`, que sem stat de item não tem o que fortificar
- **Rodada do loop:** 5ª

## 1. Escopo

Dar corpo mecânico à raridade que a rodada anterior criou: **3 slots** de equipamento
(1 arma + 2 acessórios), stat que escala com raridade, **tipo de dano** na arma,
**afinidade** no acessório com bônus quando ela bate, e **conjuntos** nomeados com bônus de 2 e
de 3 peças. Sem tela de classe, em lugar nenhum.

## 2. Fora de escopo

- **Fortificação** — é `specs/fortificacao-de-item.md`, a rodada seguinte, já decidida
- **Balanceamento numérico fino** — a spec de origem exclui explicitamente
- **Mais de 4 tipos de item** — escopo mínimo por design (critério 2 da origem)
- **Arte dos conjuntos** — nomes existem, sprite não

## 3. Decisões de execução

| # | Assunto | Decisão |
|---|---|---|
| D1 | **Stat do item** | **Derivado da raridade por função**, não gravado em coluna. Um número guardado poderia divergir da regra depois de um rebalanceamento; derivado, a regra é uma só. A spec de origem pede "stat que escala com raridade" — nada além disso. |
| D2 | **Slot** | Coluna `slot` (`arma`, `acessorio1`, `acessorio2`, `skin`, ou nulo) com índice único por jogador. Substitui o booleano `equipado` da rodada anterior: um booleano não sabe distinguir dois acessórios nem impedir três. |
| D3 | **Efeito especial da arma** | Traduzido em **modificador mensurável** do poder de ataque, não em animação. O critério 6 pede efeito auto-disparado sem botão; num combate resolvido por stat-tick, o efeito honesto é numérico e observável no rendimento. |
| D4 | **Conjunto** | Identificado por `conjunto_id` textual, sorteado no drop apenas para itens **épico ou superior** (critério 14 da origem). |

## 4. Critérios de aceite

### Sem classe, com loadout

1. **Não existe seleção de classe** em lugar nenhum do jogo — nem tela, nem RPC, nem coluna.
2. Todo item tem exatamente um de 4 tipos: **arma**, **acessório**, **skin**, **chave**.
3. O personagem tem **3 slots**: 1 arma + 2 acessórios. Um quarto item equipado é recusado pelo
   servidor.
4. O personagem **sempre começa com uma arma inicial** comum e gratuita — nunca fica sem nada
   equipado.
5. Trocar de arma **muda o efeito junto, automaticamente** — sem confirmação, sem cooldown, sem
   custo.

### Poder

6. Arma e acessório têm **stat que escala com a raridade**: comum rende pouco, cósmico rende
   muito.
7. **Skin nunca tem stat, em nenhuma raridade.** Verificação estrutural: a função que calcula
   poder não recebe nem consulta skin.
8. Arma carrega **tipo de dano**: ~~`fisico` ou `magico`~~ → **`fisico`, `destreza` ou `magico`**
   (2026-08-14, ADR-005).
9. **Força escala dano físico e Inteligência escala dano mágico** — o atributo que casa com a arma
   conta inteiro, ~~o outro conta pela metade~~ → **os outros contam ZERO**, e há um terceiro canal
   (Destreza, para arco e adaga).

   > **Revertido pelo dono em 2026-08-14:** *"se ele usa cajado tem que dar dano mágico, logo se ele
   > upar força não pode aumentar o dano"*. A meia-contribuição tornava a escolha de atributo morna
   > — errar custava pouco, acertar rendia pouco. Ver `docs/08_DECISOES/adr-005-canais-de-dano-e-destreza.md`
   > e `specs/destreza-canais-de-dano-e-heroi-animado.md`.
10. Acessório pode ter **afinidade** com um tipo de dano; quando ela bate com a arma equipada,
    aquele acessório rende um **bônus mensurável**.
11. O poder resultante entra no **mesmo cálculo de ciclo** que já credita XP e moeda — não existe
    caminho paralelo de recompensa.

### Conjunto

12. Itens **épico ou superior** podem pertencer a um **conjunto nomeado**.
13. **2 peças** do mesmo conjunto, em qualquer combinação dos 3 slots, dão o **bônus de 2 peças**.
14. **3 peças** dão o **bônus de conjunto completo**, **mais forte que a soma** dos parciais.
15. Bônus de conjunto **nunca substitui** o stat normal dos itens — soma.
16. **2 peças de um conjunto e 1 de outro** ativam só o bônus de 2 do primeiro; bônus parcial não
    empilha entre conjuntos diferentes.
17. Trocar uma peça por item mais forte em stat bruto e perder o bônus de conjunto é **escolha do
    jogador** — o jogo não trava, só deixa visível o que muda.

### Segurança e qualidade

18. Equipar é escolha do jogador (recebe id de item), mas o servidor confere **posse e tipo**
    antes de qualquer coisa.
19. Nenhuma RPC exposta recebe stat, poder ou raridade — só identificadores.
20. `npm test` e `npm run build` verdes; o cálculo de poder nasce com teste; nenhum
    `console.log`, hex solto ou `TODO` sem justificativa.

## 5. Edge cases

- **Slot de acessório vazio** — funciona normalmente, só sem a contribuição daquele slot.
- **Duas armas iguais em raridades diferentes** — troca livre, sem penalidade nem cooldown.
- **Item equipado consumido numa síntese** — precisa desequipar sozinho, sem referência órfã.
- **Jogador sem nenhuma arma** — não deve acontecer (critério 4), mas o cálculo precisa aguentar.
- **Acessório com afinidade que não bate** — contribui o stat normal, sem o bônus.

## 6. Definição de "aprovado sem ressalvas"

Os 20 critérios verificados; `npm test` e `npm run build` verdes; e as três provas centrais
por teste: **skin não entra no cálculo de poder em nenhum caso**, **o bônus de 3 peças é maior
que a soma dos de 2**, e **bônus parcial não empilha entre conjuntos diferentes**.

---

# Resultado da review — 2026-08-11

`npm test`: **141 passando** (125 → 141). `npm run build`: **verde**, orçamento em 0,42 MB de 8 MB.

## Auditoria dos 20 critérios

| # | Veredito | Evidência |
|---|---|---|
| 1 | sim | `grep` por "classe" no SQL executável não retorna nada; não há coluna, parâmetro nem enum |
| 2 | sim | `check (tipo in ('arma','acessorio','skin','chave'))` |
| 3 | sim | índice único `item_slot_unico` por `(player_id, slot)` — um quarto equipado nem entra no banco |
| 4 | sim | `garantir_arma_inicial`, chamada de `creditar_ciclos` (idempotente) e depois de cada síntese |
| 5 | sim | `equipar_item` só troca `slot`, sem custo, cooldown ou confirmação; teste "trocar de arma muda o resultado sozinho" |
| 6 | sim | `poder_do_item` cresce mais que linear; teste confirma o salto do topo maior que o da base |
| 7 | sim | `Loadout` não tem campo de skin — teste estrutural; e `poder_de_ataque` filtra `slot in ('arma','acessorio1','acessorio2')` |
| 8 | sim | coluna `tipo_dano` na arma, sorteada em `conceder_item` |
| 9 | sim | atributo que casa conta inteiro, ~~o outro pela metade~~ → **os outros zero** (2026-08-14); os dois testes que mediam a metade foram reescritos, e entraram os três canais |
| 10 | sim | `+20%` no acessório cuja afinidade bate; teste comparando com e sem |
| 11 | sim | o poder entra em `resolver_ciclos`, que já é o único caminho de crédito |
| 12 | sim | conjunto sorteado só a partir de raridade 4 (épico) |
| 13 | sim | 2 peças → `+10%`; teste com `pecasDoMaiorConjunto` |
| 14 | sim | 3 peças → `+35%`, e o teste exige explicitamente `bonusDeTres > bonusDeDuas * 2` |
| 15 | sim | o multiplicador incide sobre um total que já inclui o stat dos itens; teste confirma que `arma` e `acessorios` não mudam |
| 16 | sim | só o conjunto mais representado conta; teste "bônus parcial não empilha entre conjuntos diferentes" |
| 17 | sim | nada trava a troca; a UI mostra afinidade e conjunto para a perda ficar visível |
| 18 | sim | `equipar_item` confere posse (`player_id = auth.uid()`) e se o tipo cabe no slot antes de qualquer escrita |
| 19 | sim | as RPCs recebem id e slot; o teste de contrato reprova parâmetro de tempo ou recompensa |
| 20 | sim | 141 testes verdes, build verde, nenhum `console.log`, hex solto ou `TODO` |

## Decisões de implementação que valem registro

- **Stat derivado da raridade por função**, não gravado em coluna (D1). Um número guardado
  poderia divergir da regra depois de um rebalanceamento; derivado, existe uma regra só.
- **`slot` substituiu o booleano `equipado`** da rodada anterior. Um booleano não sabe distinguir
  dois acessórios nem impedir um terceiro — o índice único por `(player_id, slot)` sabe.
- **`resolver_ciclos` deixou de receber atributos e passou a receber um número**: o poder já
  pronto. Consequência boa: a função que decide recompensa não sabe o que é item, arma ou skin.
- **A síntese gasta os guardados antes dos equipados** (`order by slot nulls first`) e chama
  `garantir_arma_inicial` no fim — assim consumir a arma equipada não deixa o personagem sem nada.

## Ressalva que continua valendo

São agora **6 migrations auditadas estruturalmente e nunca executadas** (D1 do backlog). Esta
rodada mexeu na assinatura de `resolver_ciclos` e trocou uma coluna por outra em
`item_jogador` — as duas coisas que mais precisam de um Postgres real antes de qualquer deploy.

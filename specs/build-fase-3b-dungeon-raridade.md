# Spec de execução: Fase 3 rodada 2 — dungeon, raridade, síntese e skin

*(spec de **build**. Traduz `specs/dungeons-loot-skins.md` em algo implementável e auditável.)*

- **Spec de origem:** `specs/dungeons-loot-skins.md` (13 critérios + raridade estendida)
- **Depende de:** `specs/build-fase-3a-atributos-ranking.md` (Sorte já existe e é alocável)
- **Data:** 2026-08-11
- **Rodada do loop:** 4ª

## 1. Escopo

Sistema de loot com **10 tiers de raridade**, chave de dungeon dropada no mundo aberto,
**mini boss** periódico, **dungeon** instanciada resolvida inteiramente no servidor (tanto ao
vivo quanto durante a ausência), **skin** puramente cosmética e **síntese** de 9 itens iguais em
1 de raridade superior.

Esta rodada dá a Sorte o consumidor que faltava: ela passa a aumentar a chance de subir de tier
no drop.

## 2. Fora de escopo

- **Stat de arma e acessório, tipo de dano, afinidade e conjunto** — é
  `specs/equipamento-e-poder.md`, a próxima rodada. Aqui os itens nascem com **tipo e raridade**;
  o efeito mecânico deles chega depois. Declarado, não esquecido
- **Inimigo exclusivo de dungeon** — o critério 1a manda reaproveitar o pool do mundo aberto
- **Bioma / cenário de dungeon** — é `specs/mapa-mundo-e-dungeon.md`
- **Mercado, diamante e trade de item** — é `specs/mercado-diamante.md`
- **Skin exclusiva de passe** — é `specs/passe-de-recompensas.md`
- **Arte** — a dungeon, o mini boss e os tiers continuam com placeholder geométrico

## 3. Decisões de execução

| # | Assunto | Decisão |
|---|---|---|
| D1 | **Aleatoriedade** | Todo sorteio é **determinístico e semeado** por `(player_id, contador)`, via `md5`. O jogador não consegue re-rolar (não controla nem o id nem o contador), e o resultado continua auditável e reproduzível — a mesma propriedade que já vale para o cálculo de farm. Nada de `random()`. |
| D2 | **Espelho em TypeScript** | O client **nunca** calcula drop, então não há espelho do sorteio. O que é espelhado e testado é a parte pura: a escalada de raridade a partir de uma lista de sorteios já feitos. |
| D3 | **Modelo de item** | Uma linha por item (não pilha), porque `specs/equipamento-e-poder.md` vai acrescentar stat e conjunto por item — empilhar agora obrigaria a desempilhar depois. |
| D4 | **Teto de dungeons por retorno** | 10 por sessão de retorno (edge case da spec de origem). Chave não usada **não expira** — a spec deixa em aberto e "não expira" é o que respeita "progresso nunca é punido". |
| D5 | **Derrota no boss** | Resolvida por comparação de poder do jogador contra o poder do boss, sem aleatoriedade: perder é sinal de que falta nível, não azar. A chave é consumida de qualquer jeito (edge case explícito da spec). |

## 4. Critérios de aceite

### Raridade

1. Existem exatamente **10 tiers**, na ordem: comum, incomum, raro, épico, lendário,
   caramelizado, glaceado, dourado, cristalizado, cósmico.
2. O tier de um item é **decidido no servidor** e gravado junto com ele — o client nunca informa
   raridade.
3. **Sorte aumenta a chance de subir de tier** no drop, com teto: investir em Sorte melhora as
   probabilidades sem tornar tier alto trivial.
4. Cada tier tem nome nas duas línguas, com versão em inglês **pensada**, não literal
   (core, critério 14).

### Chave, mini boss e dungeon

5. Inimigo do mundo aberto tem **chance de dropar chave**, resolvida no mesmo ciclo que já credita
   XP — sem caminho paralelo.
6. **Mini boss spawna periodicamente**, sem exigir chave nem gatilho manual, e dropa **chave** mais
   item na faixa **incomum a raro**.
7. O spawn de mini boss é resolvido **também durante a ausência**, na mesma RPC — o servidor
   decide quantos apareceram, o client nunca declara.
8. Jogador com **pelo menos 1 chave** pode iniciar uma dungeon.
9. A dungeon é resolvida pela **mesma mecânica de stat-tick** do mundo aberto — não exige presença
   nem habilidade.
10. A dungeon tem **fim definido** (boss), ao contrário do farm contínuo.
11. Derrotar o boss **garante piso de raridade raro** — certeza, não chance —, com chance de subir
    acima. Perder para o boss **consome a chave** e rende loot sem o piso garantido.
12. O jogador **nunca perde progresso nem personagem** numa dungeon — sem permadeath, em nenhum
    resultado.
13. Dungeons acumuladas durante a ausência são resolvidas **no servidor**, com `now()` do Postgres,
    respeitando o teto de 10 por retorno (D4).

### Skin

14. Skin tem raridade como qualquer item e é **adquirida por drop**, sem compra separada.
15. Skin equipada muda **só a aparência**: o cálculo de recompensa é **bit a bit idêntico** com
    qualquer skin equipada, ou nenhuma. Verificação: a função que resolve ciclos não recebe nem
    consulta skin.

### Síntese

16. Combinar **9 itens do mesmo tipo e da mesma raridade** produz **1 item do tipo igual e da
    raridade seguinte**.
17. Há **chance pequena de pular um nível** na síntese, decidida no servidor.
18. A síntese **não custa diamante nem dinheiro real** — é caminho de progressão só-por-jogar.
19. Síntese com menos de 9 itens, ou no tier máximo, é **recusada pelo servidor** com erro claro.
20. Os 9 itens consumidos **desaparecem atomicamente** junto com a criação do novo — nunca some
    item sem gerar, nem gera sem consumir.

### Segurança e qualidade

21. Toda tabela nova tem **RLS por `player_id`**; o inventário é escrito só por RPC
    `SECURITY DEFINER`.
22. Nenhuma RPC exposta ao jogador recebe raridade, quantidade de loot, tempo ou recompensa — só
    identificadores de item e escolhas dele.
23. `npm test` e `npm run build` verdes; a escalada de raridade e a síntese nascem com teste;
    nenhum `console.log`, hex solto ou `TODO` sem justificativa.

## 5. Edge cases

- **Ausência longa acumula muitas chaves** — o teto de 10 dungeons por retorno vale, e as chaves
  restantes ficam guardadas.
- **Síntese no tier cósmico** — recusada, é o topo.
- **Dois pedidos de síntese ao mesmo tempo** com os mesmos itens — o consumo trava as linhas, e o
  segundo pedido não acha 9 itens livres.
- **Skin equipada é consumida numa síntese** — precisa desequipar sozinha, não deixar referência
  órfã.
- **Jogador sem nenhuma chave pede dungeon** — recusado com motivo, sem gastar nada.
- **Boss derrotado com o jogador em nível muito baixo** — perder não pode custar nada além da
  chave (critério 12).

## 6. Definição de "aprovado sem ressalvas"

Os 23 critérios marcados como **sim**, com evidência; `npm test` e `npm run build` verdes; e as
três provas centrais desta rodada verificáveis por teste: **skin não altera recompensa em nenhum
caso**, **a síntese conserva a conta** (9 entram, 1 sai, nunca some nem duplica) e **o piso de
raridade do boss é garantido, não sorteado**.

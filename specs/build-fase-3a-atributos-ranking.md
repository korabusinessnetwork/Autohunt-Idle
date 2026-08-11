# Spec de execução: Fase 3 rodada 1 — atributos e ranking global

*(spec de **build**. Traduz `specs/ranking-global.md` em algo implementável e auditável.)*

- **Spec de origem:** `specs/ranking-global.md` (12 critérios)
- **Depende de:** `specs/build-fase-1-mvp.md`, `specs/build-fase-2-portal.md`
- **Data:** 2026-08-11
- **Rodada do loop:** 3ª

## 0. Por que esta rodada vem primeiro na Fase 3

O roadmap (`memory/identity.md`) diz que a Fase 3 é "guiada pelo que a Fase 2 mostrar — não
necessariamente todas, nem nessa ordem". Como a Fase 2 ainda não gerou dado, a ordem escolhida é
por **dependência**, não por aposta de produto:

- `specs/equipamento-e-poder.md`, critério 12, faz Força e Inteligência escalarem dano físico e
  mágico — precisa dos atributos existirem
- `specs/dungeons-loot-skins.md` liga Sorte à chance de raridade melhor no drop
- Nível infinito e formatação de número grande (critérios 1, 2 e 3 da spec de origem) **já foram
  entregues na Fase 1**

Construir os atributos primeiro é o que mantém as outras rodadas possíveis em qualquer ordem que
o dado da Fase 2 vier a justificar.

## 1. Escopo

Quatro atributos (Força, Inteligência, Vitalidade, Sorte) ganhos por level up, auto-alocados por
padrão e realocáveis de graça a qualquer momento; apelido de exibição; e ranking global por
nível, recomputado periodicamente dentro do Postgres, com a posição do próprio jogador visível
mesmo fora do top.

## 2. Fora de escopo

- **Ranking por outra métrica** que não nível — a spec de origem restringe a nível
- **Atualização em tempo real** do ranking (push/WebSocket) — a spec de origem exclui
- **Filtro por região ou amigos** — a spec de origem exclui
- **Efeito de Sorte no drop** — não há sistema de loot ainda; entra com
  `specs/dungeons-loot-skins.md`. O atributo é gravado e alocável agora, mas seu consumidor
  chega na rodada seguinte
- **Separação entre dano físico e mágico** — só existe quando houver tipo de dano de arma
  (`specs/equipamento-e-poder.md`). Por ora Força e Inteligência somam no mesmo cálculo

## 3. Conflitos entre specs que esta rodada resolve

### 3.1 Apelido no primeiro acesso × abrir direto no mundo

`specs/ranking-global.md`, critério 4, diz que o apelido é "definido obrigatoriamente no primeiro
acesso". Isso colide de frente com:

- `specs/game-idle-farm-core.md`, critério 17: "o jogo abre direto no mundo aberto (…) sem tela
  de boas-vindas, **sem escolha inicial**"
- o Princípio nº1 do `CLAUDE.md`
- e com a **própria** spec de ranking, cujos edge cases dizem: "Jogador que ainda não definiu
  nickname não aparece no ranking até definir" — o que só faz sentido se der para jogar sem um

**Resolução adotada:** o apelido é pedido quando o jogador **abre o ranking**, não na primeira
sessão. Quem nunca abriu o ranking joga normalmente e simplesmente não aparece nele. Isso
satisfaz a intenção do critério 4 (ninguém entra no ranking anônimo), respeita o critério 17 e é
coerente com o edge case da própria spec de origem.

Efeito colateral bom: **não ter apelido é o opt-out do ranking**, e defini-lo é um opt-in
explícito — o que resolve, sem regra extra, a questão de expor apelido e nível publicamente.

### 3.2 Custo de atributo — prosa × fórmula

A spec de origem diz "níveis 10–19 custam 2 pontos cada" e, na mesma frase, dá a fórmula
`custo = 1 + nível_atual ÷ 10 (arredondado pra baixo)`. As duas discordam em uma unidade.

O critério 12 desempata com um exemplo: *"se subir de 10 pra 11 em Força custou 2 pontos"*.
Logo vale a **fórmula**: subir do nível `a` para `a+1` custa `1 + floor(a / 10)`.

## 4. Arquivos afetados

```
supabase/migrations/20260813_atributos_e_ranking.sql
src/game/regrasAtributos.ts          # espelho puro: custo, auto-alocação, respec
src/game/regrasFarm.ts               # atributos entram no cálculo de ciclo
src/lib/services/rankingService.ts
src/lib/services/atributoService.ts
src/features/ranking/{TelaRanking.tsx,TelaRanking.css}
src/features/atributos/{PainelAtributos.tsx,PainelAtributos.css}
src/lib/{tipos.ts,i18n/pt.ts,i18n/en.ts}
src/pages/Jogo.tsx
src/lib/contratoRpc.test.ts          # regra de parâmetro evolui (ver critério 18)
```

## 5. Critérios de aceite

### Atributos

1. Cada level up concede pontos de atributo, creditados pelo servidor — nunca pelo client.
2. Os quatro atributos existem e são persistidos: **Força**, **Inteligência**, **Vitalidade**,
   **Sorte**.
3. Subir um atributo do nível `a` para `a+1` custa `1 + floor(a / 10)` pontos. Verificação: subir
   de 10 para 11 custa 2; de 9 para 10 custa 1.
4. Pontos são **auto-alocados por padrão**, em distribuição balanceada, sem exigir nenhum toque
   do jogador (Princípio nº1) — quem nunca abrir a tela de atributos joga com uma build coerente.
5. O jogador pode **realocar livremente**: sempre grátis, sem penalidade e sem limite de vezes.
6. O respec devolve o **custo real gasto**, não 1 por nível — desalocar o nível 11 de Força
   devolve os 2 pontos que ele custou.
7. Uma realocação que gastaria mais pontos do que o jogador tem é **rejeitada pelo servidor**,
   com erro claro — a validação do client é conveniência, não a garantia.
8. **Vitalidade aumenta a Vitalidade máxima** usada no ciclo de farm, e Força e Inteligência
   aumentam o rendimento por ciclo. O efeito é aplicado no SQL, dentro da mesma
   `resolver_ciclos` que já credita — não existe caminho paralelo.
9. **Sorte é gravada e alocável, e ainda não tem efeito** — seu consumidor é o sistema de loot
   (`specs/dungeons-loot-skins.md`). Isso está declarado no código, não é esquecimento.

### Apelido e ranking

10. Existe um apelido de exibição por jogador, definido pelo próprio jogador.
11. O apelido é pedido ao **abrir o ranking**, nunca na primeira sessão (seção 3.1).
12. Jogador sem apelido **não aparece** no ranking, e isso é o mecanismo de opt-in.
13. O ranking mostra os **top 100** por nível.
14. O jogador **sempre vê a própria posição**, inclusive fora do top 100.
15. O ranking é **recomputado periodicamente** (não a cada leitura, não em tempo real), dentro do
    Postgres — sem worker, sem processo persistente (ADR-001, `memory/restrictions.md`).
16. Nenhum dado pessoal aparece no ranking: apenas apelido, nível e posição. Nunca e-mail,
    nunca data de nascimento, nunca `user_id` de terceiro.

### Segurança e qualidade

17. Todas as tabelas novas têm RLS. A tabela de ranking é **legível por qualquer autenticado**
    por ser placar público — e essa exceção ao isolamento por `player_id` está declarada e
    justificada no SQL, não implícita.
18. A auditoria estrutural das migrations evolui de "nenhuma RPC do jogador tem parâmetro" para
    a regra que ela sempre quis dizer: **as RPCs que creditam continuam sem parâmetro nenhum**, e
    qualquer outra RPC exposta ao jogador não pode ter parâmetro de tempo nem de recompensa.
    Alocar atributo é escolha do jogador, não declaração de ganho.
19. Nenhum apelido é aceito sem validação de tamanho e conteúdo, no servidor.
20. `npm test` e `npm run build` verdes; funções puras novas (custo, auto-alocação, respec)
    nascem com teste; nenhum `console.log`, segredo hardcodado ou `TODO` sem justificativa.

## 6. Edge cases conhecidos

- **Empate de nível** — a spec de origem deixa o desempate "a definir". Adotado: maior `xp_total`,
  e persistindo o empate, quem chegou primeiro (`criado_em`). Registrado como decisão reversível.
- **Apelido duplicado** — a spec de origem deixa "a decidir". Adotado: **permitido**, porque
  exigir unicidade cria exatamente a fricção de "esse nome já existe" que o Princípio nº1 evita.
  Fica registrado como decisão do dono, com o risco de personificação anotado.
- **Jogador sobe de nível durante um farm offline longo** — os pontos de todos os níveis ganhos
  precisam ser creditados, não só do último.
- **Respec com valores negativos ou absurdos** vindos do client — rejeitado no servidor.
- **Ranking ainda não recomputado** desde o primeiro acesso — a tela precisa do estado vazio, sem
  parecer erro.
- **Jogador define apelido e consulta o ranking antes do próximo recompute** — precisa ver a
  própria posição mesmo assim, senão parece que não funcionou.

## 7. Definição de "aprovado sem ressalvas"

Os 20 critérios marcados como **sim**, com evidência; `npm test` e `npm run build` verdes; e as
duas provas centrais desta rodada verificáveis por teste: **o respec devolve exatamente o que
cobrou** (nunca gera nem destrói ponto) e **o servidor rejeita uma alocação que o jogador não
pode pagar**.

---

# Resultado da review — 2026-08-11

`npm test`: **104 passando** (82 → 104). `npm run build`: **verde**, orçamento de portal em
0,40 MB de 8 MB.

## Auditoria dos 20 critérios

| # | Veredito | Evidência |
|---|---|---|
| 1 | sim | `auto_alocar_atributos` é chamada de dentro das RPCs `SECURITY DEFINER`; os pontos saem de `pontos_ganhos_ate(nivel)`, calculado no servidor |
| 2 | sim | tabela `atributo_jogador` com as quatro colunas |
| 3 | sim | `custo_proximo_nivel_atributo` = `1 + (a/10)`; teste cobre 9→1, 10→2, 19→2, 20→3 |
| 4 | sim | auto-alocação sempre no atributo de menor nível; teste prova que a diferença entre o maior e o menor nunca passa de 1 |
| 5 | sim | `redistribuir_atributos` não cobra nada e não tem limite de uso |
| 6 | sim | a validação compara **custo acumulado** com pontos ganhos, então descer do nível 11 devolve os 2 que ele custou — teste explícito |
| 7 | sim | `raise exception 'PONTOS_INSUFICIENTES'` no SQL, além da checagem de UI |
| 8 | sim | atributos entram em `resolver_ciclos` dentro do SQL; 6 testes novos em `regrasFarm.test.ts` |
| 9 | sim | Sorte é gravada e alocável; teste prova que hoje ela não muda nada, e o comentário aponta o consumidor futuro |
| 10 | sim | `definir_apelido` valida tamanho e caractere de controle no servidor |
| 11 | sim | o apelido é pedido dentro de `TelaRanking`, nunca na primeira sessão |
| 12 | sim | `recomputar_ranking` filtra `where apelido is not null` |
| 13 | sim | `ranking_global()` com `limit 100` |
| 14 | sim | o bloco `eu` sai de `ranking_posicao` independentemente do top, e a UI o mostra quando o jogador está fora da lista |
| 15 | sim | `recomputar_ranking` é revogada de `authenticated` e concedida só a `service_role` (pg_cron); a leitura só lê tabela pronta |
| 16 | sim | o payload do ranking tem posição, apelido e nível — nada mais |
| 17 | sim | RLS nas duas tabelas novas; a exceção de leitura pública do placar está declarada e justificada no SQL |
| 18 | sim | o teste de contrato foi reescrito (ver abaixo) |
| 19 | sim | 3 a 20 caracteres, sem caractere de controle, com `btrim` |
| 20 | sim | 104 testes verdes, build verde, nenhum `console.log`, hex solto ou `TODO` |

## Corrigido durante a review (3 achados)

1. **A auto-alocação desfazia a escolha do jogador.** Ela rodava a cada level up sem olhar se o
   jogador tinha assumido o controle — então quem redistribuísse à mão veria tudo redistribuído
   sozinho no lote seguinte, 15 segundos depois. Entrou a coluna `auto_alocar`, que vira `false`
   no primeiro respec manual, mais a RPC `reativar_auto_alocacao()` como porta de volta (sem ela,
   quem redistribuísse uma vez ficaria manual para sempre).
2. **O placar expunha `player_id`.** O `grant select` incluía a coluna, o que deixaria qualquer
   jogador mapear apelido → id de conta alheia. Removida do grant, junto com `xp_total`, que é só
   critério de desempate.
3. **Faltava teste para o critério 8.** O efeito dos atributos no farm estava implementado nos
   dois lados, mas nada garantia que continuasse valendo. Seis testes novos, incluindo um que
   prova que quem não alocou nada rende exatamente o que rendia na Fase 1.

## Regra de contrato que mudou de propósito

O teste de auditoria das migrations dizia "nenhuma RPC concedida a `authenticated` aceita
parâmetro". Isso funcionou nas Fases 1 e 2, mas alocar atributo e definir apelido são escolhas
legítimas do jogador — e a regra, do jeito que estava, proibiria qualquer uma delas.

Foi reescrita para o que ela sempre quis dizer, e ficou mais forte:

- as RPCs que **creditam valor** continuam obrigadas a ter zero parâmetro, e agora o teste também
  falha se alguma delas sumir da lista de grants;
- **qualquer** RPC exposta ao jogador é proibida de ter parâmetro de tempo ou de recompensa
  (`timestamp`, `tempo`, `minuto`, `xp`, `moeda`, `abate`, `nivel`, `saldo`…).

Escolher onde gastar um ponto é decisão do jogador. Dizer quanto ganhou, não.

## Decisões que tomei e você pode reverter

Ambas estavam marcadas como "a definir" em `specs/ranking-global.md`:

1. **Desempate no ranking**: maior XP total e, persistindo o empate, quem chegou primeiro.
2. **Apelido duplicado**: permitido. Exigir unicidade criaria a fricção de "esse nome já existe",
   que é exatamente o que o Princípio nº1 evita — mas o risco de personificação num placar
   público é real, e reverter é uma constraint de uma linha.

## Ressalva que continua

As três migrations seguem **auditadas estruturalmente, nunca executadas** — não há Postgres neste
ambiente (D1 do backlog). O SQL desta rodada é o mais complexo até agora (laço de auto-alocação,
`row_number()` de ranking, forma fechada do custo), e por isso é também o que mais precisa rodar
de verdade antes de qualquer deploy.

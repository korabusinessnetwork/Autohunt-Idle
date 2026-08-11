# Spec: Sistema de Dungeon + Raridade de Item + Skin

*(estende `specs/game-idle-farm-core.md` — pressupõe o core loop já definido lá)*

## 1. Escopo
Sistema de dungeon instanciada — mesma mecânica de auto-attack do mundo aberto, mas em área fechada com fim definido (boss) — destravada por chave (drop do mundo aberto). Sistema de raridade de item (comum → lendário) aplicado a loot e skin. Sistema de skin cosmético (não afeta stat/dano), adquirido via drop de loot seguindo o mesmo tier de raridade.

## 2. Fora de escopo
- Combate manual/skill-based dentro da dungeon — usa a mesma resolução por stat/tick do mundo aberto (decisão confirmada, não é bullet-hell de verdade)
- Monetização de skin via "passe"/compra avulsa — por ora, skin só vem de loot, mesma economia do resto do jogo. O "🔒 DOBRAR GANHOS — PASSE" que apareceu num mockup de arte não foi decidido nem especificado — não faz parte desta spec
- Trade de item/skin entre jogadores (mercado) — já fora de escopo do core, continua fora aqui
- Dungeon com múltiplos jogadores simultâneos — instanciada por jogador, como todo o resto (ADR-002)
- Cor exata do tier Épico — ficou pendente do brief de arte, não bloqueia esta spec

## 3. Arquivos afetados
- `supabase/migrations/` — tabela/coluna de chaves de dungeon no inventário do jogador; coluna de raridade em itens; tabela de skins possuídas por jogador
- RPC `calcularFarmOffline` — **expandida**: além de resolver o farm normal, agora também resolve tentativas de dungeon durante o período offline, consumindo chaves disponíveis do jogador
- `src/lib/services/farmService.ts` (já esboçado na fundação) — ganha responsabilidade de dungeon
- `src/game/` — lógica de dungeon como "sessão com fim", diferente do mundo aberto (contínuo)

## 4. Critérios de aceite
1. Inimigo do mundo aberto tem chance de dropar chave de dungeon (taxa exata é balanceamento, não bloqueia esta spec)
1a. **(Amendado)** Dungeon reaproveita o **mesmo pool de inimigos** do mundo aberto (Casquinha, Minhoca Azeda, Rosquinha Brutamontes, Pirulito Valentão, Pudim Conformado) com stat escalado pra cima — sem inimigo exclusivo de dungeon nesta fase, fica pra Fase 4 (mais conteúdo)
1b. **(Amendado)** Mini boss no mundo aberto: mesmo pool de inimigo, escala visual entre o normal e o boss de dungeon, spawna periodicamente **sem precisar de chave nem gatilho manual** — degrau do meio entre farm comum e dungeon completa. Dropa **chave de dungeon** (fecha o ciclo: mini boss → chave → dungeon → boss de dungeon) e itens numa **faixa de raridade intermediária: incomum a raro** (mais alta que o farm comum, mais baixa que o piso raro+ garantido do boss de dungeon, critério 4a) — frequência de spawn e taxa exata de drop são balanceamento
1c. **(Amendado)** Spawn de mini boss entra na mesma RPC de cálculo (farm + dungeon já cobertos) — período offline também resolve quantos mini boss "apareceriam" durante a ausência, mesma regra de nunca confiar no client
2. Jogador com pelo menos 1 chave pode iniciar uma dungeon
3. Dungeon é resolvida pela mesma mecânica de auto-attack/stat-tick do mundo aberto — não exige presença nem skill do jogador
4. Dungeon tem fim definido (boss) — ao contrário do farm de mundo aberto, que é contínuo
4a. **(Amendado)** Boss é o **mesmo pool de inimigo** do mundo aberto/dungeon, sem mecânica de combate nova — diferencia por **escala visual maior** e por ser o único ponto que **garante piso de raridade** no drop (mínimo raro, certeza, não só chance). Só derrotar o boss fecha a dungeon com o loot completo — perder pra ele ainda usa a chave (critério 3), mas sem o prêmio garantido
5. Ao concluir uma dungeon, o jogador **nunca perde progresso ou personagem**, mesmo em resultado desfavorável — sem permadeath (ver "Nota de design" abaixo)
6. Loot de dungeon tem piso de raridade melhor que loot de mundo aberto (mínimo raro, chance de épico/lendário)
7. Todo item (loot ou skin) carrega um tier de raridade — **10 níveis, ver seção "Raridade estendida" abaixo** (amendado — inspirado no sistema de TBH: Task Bar Hero)
8. Skin equipada muda **só a aparência** — dano, hitbox e stat do personagem são idênticos com qualquer skin equipada
9. Skin é adquirida por drop de loot, seguindo o mesmo tier de raridade dos itens — sem mecanismo de compra separado por ora
10. Cálculo de dungeon durante o período offline segue a mesma regra de segurança do farm: RPC `SECURITY DEFINER`, o servidor decide quantas chaves existiam e quantas dungeons foram resolvidas — o client nunca declara o resultado
11. Existem 10 níveis de raridade (comum → cósmico) — ver "Raridade estendida" abaixo
12. Combinar 9 itens da mesma raridade cria 1 item da raridade seguinte (Síntese), com chance pequena de pular um nível
13. Síntese funciona sem gastar diamante nem dinheiro real — é caminho de progressão só-por-jogar

## 5. Edge cases conhecidos
- Jogador acumula muitas chaves offline (dias sem jogar) — definir teto de dungeons resolvidas por sessão de retorno, mesma lógica de cap que já existe pro farm normal (8h/24h por tier)
- Chave não usada expira? — a decidir; pode ficar sem expiração por enquanto, sem bloquear a spec
- Chave é consumida mesmo se o resultado for ruim? — sim, por design: chave é o "ingresso", não uma garantia de loot bom

## Raridade estendida — 10 níveis + Síntese

*(amendado — inspirado no sistema de [TBH: Task Bar Hero](https://store.steampowered.com/app/3678970/TBH_Task_Bar_Hero/), adaptado pro tema chiclete)*

Os 5 níveis originais desta spec (comum, incomum, raro, épico, lendário) continuam valendo como a faixa "alcançável por jogo normal". Estendendo mais 5 no topo, tema doce, escalando raridade real:

6. **Caramelizado**
7. **Glaceado**
8. **Dourado**
9. **Cristalizado**
10. **Cósmico** — praticamente inatingível por jogo legítimo, é troféu de longuíssimo prazo (mesmo espírito de Divine/Cosmic do TBH)

### Síntese

Combinar **9 itens da mesma raridade** cria **1 item da raridade seguinte** — com chance pequena de pular um nível, se a sorte ajudar. Aplica-se a arma, acessório e skin (skin sobe de raridade por síntese também, mesmo sem ganhar stat — é puramente cosmético subir).

Isso dá um caminho **determinístico** de progressão pra quem farma muito, independente de sorte de drop — reforça o princípio já registrado em `memory/identity.md` ("progresso nunca é punido"). É também uma segunda via de progressão que não depende de diamante nem de dinheiro real: quem só joga (sem pagar nada) ainda sobe de raridade, só que via volume de farm em vez de sorte ou compra.

RotMG original é famoso por permadeath — é praticamente a identidade do jogo original. Deixei de propósito **fora** daqui: `memory/identity.md` (seção Princípios do Produto) já registra "progresso nunca é punido — só multiplicado pela presença", e permadeath contradiz isso diretamente. Se a intenção for ficar mais fiel ao RotMG mesmo com esse risco, é uma reversão simples de se fazer — mas muda a promessa central do produto, por isso não assumi sozinho.

## 6. Definição de "aprovado sem ressalvas"

Os 13 critérios de aceite verificados como sim; nenhuma skin comprovadamente altera stat (teste manual: trocar skin, comparar dano/hitbox antes/depois — tem que ser idêntico); cálculo de dungeon offline resistente a manipulação de client, com o mesmo teste manual que já vale pro farm normal (mudar hora do sistema local não muda o resultado); Síntese testada manualmente em pelo menos uma combinação de 9 itens, confirmando geração de 1 item de raridade superior.

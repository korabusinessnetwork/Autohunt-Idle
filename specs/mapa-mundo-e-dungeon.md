# Spec: Mapa de Mundo Aberto e Dungeon (Level 1 a 1000)

*(estende `specs/dungeons-loot-skins.md` e `specs/ranking-global.md`)*

## 1. Escopo

Progressão de cenário do mundo aberto até level 1000, em blocos de 25 níveis (40 blocos), agrupados em **8 biomas temáticos** (125 níveis cada) pra manter produção de arte viável — reaproveitamento de tileset dentro do bioma, com escalada visual entre os 5 blocos de 25 níveis de cada um. Dungeon herda o tema do bioma onde a chave foi encontrada, sem precisar de progressão própria separada.

## 2. Fora de escopo

- 40 tilesets/cenários totalmente únicos — decisão deliberada, ver "Nota de design"
- Level acima de 1000 — nível continua infinito (`specs/ranking-global.md`), mas o planejamento de conteúdo visual para depois de 1000 fica pra quando o jogo tiver essa demanda real
- Mecânica de transição entre biomas (cutscene, requisito de progressão) — só ordem visual, não bloqueia esta spec

## 3. Os 8 biomas

| # | Bioma | Levels | Tom |
|---|---|---|---|
| 1 | Floresta de Algodão-Doce | 1–125 | Zona inicial, acolhedora, pastel |
| 2 | Vale das Geleias | 126–250 | Gelatina/goma, mais viscoso e colorido |
| 3 | Deserto de Açúcar Queimado | 251–375 | Caramelo/toffee, tom mais quente e intenso |
| 4 | Recife de Pirulito | 376–500 | Aquático-doce, cores vibrantes, ritmo diferente |
| 5 | Montanhas de Chocolate | 501–625 | Mais denso/rico, ponto médio "mais sério" sem sair do chiclete |
| 6 | Geleira de Menta | 626–750 | Tom frio, contraste com o resto |
| 7 | Vulcão de Goma | 751–875 | Perigoso, molten-gummy, mais escala de ameaça |
| 8 | Céu de Confete Cósmico | 876–1000 | Endgame, liga com o tier de raridade Cósmico (`specs/dungeons-loot-skins.md`) |

## 4. Critérios de aceite

1. Existem 8 biomas cobrindo level 1 a 1000, cada um com tema e paleta próprios (dentro da paleta principal do jogo, `docs/02_DESIGN_SYSTEM/`)
2. Cada bioma tem 5 blocos internos de 25 níveis — blocos escalam intensidade visual (saturação, tamanho de inimigo, densidade de elemento de cenário) reaproveitando o mesmo tileset base do bioma, sem exigir arte nova por bloco
3. Transição de bioma (a cada 125 níveis) é o único ponto que exige tileset/arte genuinamente nova
4. Dungeon herda o tema visual do bioma onde a chave que a abriu foi encontrada — não tem progressão de cenário própria separada
5. Boss de dungeon e mini boss (`specs/dungeons-loot-skins.md`) mantêm o mesmo pool de inimigo em todos os biomas — só a ambientação muda, não o personagem/inimigo em si
6. **(Amendado)** Cada bioma tem o **pool base de 5 inimigos** já desenhados (recoloridos pra combinar com o tema do bioma — barato, reaproveita a arte existente) **mais 1-2 inimigo assinatura, exclusivo daquele bioma** — dá identidade própria sem exigir roster novo inteiro por zona (8-16 desenhos novos no total, não 40)
7. **(Amendado)** Inimigo assinatura de bioma **não substitui** o pool base — aparece como variedade adicional dentro da mesma zona, mesma regra de auto-attack/stat-tick de todo o resto

## 5. Edge cases conhecidos

- Jogador de nível muito alto revisitando bioma inicial pra farm (por algum motivo de balanceamento) — cenário permanece o do bioma daquele nível, não escala pra cima artificialmente
- Nomeação em inglês (`specs/game-idle-farm-core.md`, critério 14) precisa de versão própria pra cada nome de bioma, não tradução literal — ex.: "Floresta de Algodão-Doce" pode virar algo com trocadilho em inglês, não obrigatoriamente "Cotton Candy Forest"

## Nota de design — por que 8 biomas, não 40 cenários

40 tilesets únicos é escopo de estúdio grande, não de time pequeno em fase bootstrap (`memory/restrictions.md`, fase de custo). Reaproveitar tileset dentro do bioma com escalada de intensidade entrega a mesma sensação de "sempre tem algo novo a cada 25 níveis" — muda cor, densidade, tamanho de inimigo — sem multiplicar o trabalho de arte por 5x. Se a validação mostrar que vale investir em mais variedade visual dentro de um bioma, isso é expansão de conteúdo pós-lançamento (Fase 4 do roadmap, `memory/identity.md`), não requisito do MVP.

## 6. Definição de "aprovado sem ressalvas"

Os 5 critérios de aceite verificados; teste visual confirma que os 5 blocos dentro de um bioma são perceptivelmente diferentes entre si (não é o mesmo cenário sem nenhuma mudança); os 8 biomas são visualmente distintos entre si mesmo em captura de tela pequena.

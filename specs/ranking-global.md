# Spec: Nível Infinito + Atributos + Ranking Global

*(estende `specs/game-idle-farm-core.md`)*

## 1. Escopo

Nível de personagem sem teto (cresce indefinidamente). Cada level up concede pontos de atributo (Força, Inteligência, Vitalidade, Sorte), auto-alocados por padrão, realocáveis livremente. Ranking global de jogadores por nível, computado periodicamente — não é simulação em tempo real, não reabre a decisão de mundo instanciado do ADR-002.

## 2. Fora de escopo

- Ranking por métricas além de nível (riqueza, raridade de item, dungeons completadas) — só nível por enquanto
- Atualização em tempo real via push/WebSocket — é recomputado periodicamente
- Filtro por região/amigos — só ranking global por enquanto

## 3. Arquivos afetados

- `specs/game-idle-farm-core.md` — amendado: critério 12, nível sem teto
- `supabase/migrations/` — campo de nickname/nome de exibição no perfil do jogador (não existia até agora); view ou tabela materializada de ranking, recomputada periodicamente
- `src/lib/services/` — novo `rankingService.ts`
- `src/pages/` — nova tela de ranking

## 4. Critérios de aceite

1. Nível do personagem não tem teto — cresce indefinidamente
2. Curva de XP necessária por nível cresce (não é linear pra sempre) — fórmula exata é balanceamento, não bloqueia esta spec
3. UI trata número grande com formatação legível (ex.: 1.2K, 3.4M) em vez de dígito cru indefinido
4. Existe campo de nickname/nome de exibição por jogador — definido obrigatoriamente no primeiro acesso
5. Ranking mostra os top N jogadores por nível (N exato é UI/balanceamento — sugestão: top 100)
6. Jogador sempre vê a própria posição no ranking, mesmo fora do top N
7. Ranking é recomputado periodicamente, não em tempo real — não reabre a decisão de mundo instanciado/sem servidor dedicado do ADR-002
8. **(Amendado)** Cada level up concede pontos de atributo pra distribuir entre 4 status: **Força** (dano físico — sinergiza com arma de tipo físico, `specs/equipamento-e-poder.md`), **Inteligência** (dano mágico — sinergiza com arma de tipo mágico), **Vitalidade** (HP/sobrevivência em dungeon), **Sorte** (chance de raridade melhor no drop — sinergiza com Síntese, `specs/dungeons-loot-skins.md`)
9. **(Amendado)** Pontos de atributo são **auto-alocados por padrão** (distribuição balanceada, sem exigir touch do jogador) — compatível com o Princípio nº1 (zero esforço). Jogador pode realocar manualmente a qualquer momento
10. **(Amendado)** Realocar atributo é **sempre grátis, sem penalidade, sem limite de vezes** — respec livre, consistente com "progresso nunca é punido" (`memory/identity.md`)
11. **(Amendado)** Custo pra subir 1 nível de atributo escala por patamar de 10: níveis 1–9 do atributo custam 1 ponto cada, níveis 10–19 custam 2 pontos cada, níveis 20–29 custam 3, e assim por diante (fórmula: custo = 1 + nível_atual_do_atributo ÷ 10, arredondado pra baixo) — valores exatos são balanceamento, a progressão em si não bloqueia esta spec
12. **(Amendado)** Respec devolve o custo real gasto naquele nível — se subir de 10 pra 11 em Força custou 2 pontos, desalocar aquele nível devolve os 2 pontos, não 1

## 5. Edge cases conhecidos

- Empate de nível entre dois jogadores — critério de desempate (ex.: quem chegou primeiro) a definir, não bloqueia
- Nickname duplicado entre jogadores — permitir ou exigir único? a decidir
- Jogador que ainda não definiu nickname não aparece no ranking até definir

## Nota de arquitetura

Ranking global não contradiz ADR-002 (single-tenant) nem reabre mundo compartilhado (fora de escopo desde o core spec). É leitura agregada e recomputada, não simulação de jogadores interagindo em tempo real — cabe em Supabase (query periódica ou view materializada), sem servidor de jogo dedicado.

## 6. Definição de "aprovado sem ressalvas"

Os 7 critérios de aceite verificados; nickname obrigatório antes de aparecer no ranking; formatação de número grande testada em pelo menos um valor na casa dos milhões.

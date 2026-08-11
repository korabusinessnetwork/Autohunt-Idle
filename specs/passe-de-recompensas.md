# Spec: Sistema de Passe (trilha de recompensas)

*(estende `specs/game-idle-farm-core.md` e `specs/dungeons-loot-skins.md` — pressupõe raridade/skin já definidos lá)*

## 1. Escopo

Dois produtos de monetização distintos, cada um com seu motivo de compra:

- **Assinatura geral** (já existente, amendada aqui): utilidade de jogo — farm automático até 24h/dia + **multiplicador de 2x XP** em toda atividade (farm e dungeon)
- **Passe** (novo): compra independente, dá acesso a uma trilha de recompensas exclusivas — pelo menos 1 skin que só existe pra quem tem o passe, mais prêmios específicos a definir — destravada progressivamente por atividade normal de jogo, não instantaneamente na compra

## 2. Fora de escopo

- Estrutura de temporada com expiração de recompensa — decisão deliberada, ver "Nota de design" abaixo
- Preço do passe e da assinatura — não decidido, fica pra fase de negócio/build
- Lista completa dos "prêmios específicos" do passe — só a skin exclusiva está confirmada; resto é placeholder até haver mais conteúdo definido
- Passe "grátis vs. pago" em duas trilhas paralelas (padrão comum em outros jogos) — não mencionado, não assumido; é uma trilha só, paga

## 3. Arquivos afetados

- `specs/game-idle-farm-core.md` — **amendado**: critério 4a, assinatura geral ganha 2x XP
- `supabase/migrations/` — tabela de progresso de passe por jogador (pontos acumulados, tier atual); tabela de recompensas de passe (skin exclusiva + prêmios), reaproveitando o sistema de raridade já modelado em `specs/dungeons-loot-skins.md`
- `src/lib/services/subscriptionService.ts` (já esboçado na fundação) — ganha lógica de passe como produto separado da assinatura geral

## 4. Critérios de aceite

1. Passe é comprado independente da assinatura geral — jogador pode ter um, o outro, os dois, ou nenhum
2. Progresso no passe é ganho por atividade normal de jogo (farm, dungeon) — não é "compra e recebe tudo instantâneo"
3. Passe tem pelo menos 1 recompensa exclusiva confirmada: skin que só existe pra quem tem o passe
4. Recompensa de passe, uma vez destravada, **nunca expira nem é retirada** do jogador — mesmo que o passe seja cancelado depois
5. Assinatura geral passa a incluir: farm automático até 24h/dia (já especificado) **+ multiplicador de 2x XP** em toda atividade
6. Prêmios específicos do passe além da skin ficam como placeholder — não bloqueia esta spec

## 5. Edge cases conhecidos

- Jogador cancela o passe no meio da trilha — mantém o que já destravou, mas para de progredir/ganhar pontos novos até reativar (mesma lógica de "mantém o que já foi pago" já usada na assinatura geral)
- Jogador tem passe mas não tem assinatura geral (ou vice-versa) — funciona normalmente, são compras independentes
- Progresso de passe conta durante farm offline? — a decidir; por consistência com o resto do sistema, a leitura natural é que sim (mesma RPC resolve), mas não foi confirmado explicitamente

## Nota de design — por que sem expiração de recompensa

Passe de jogo tradicionalmente usa "temporada" com prazo — a recompensa some se você não terminar a tempo, o que empurra urgência de compra. Isso contradiz a restrição já registrada em `memory/restrictions.md` (Fase 3): "sem dark pattern de urgência". Por isso a trilha aqui não expira — o progresso não some e uma recompensa destravada é do jogador pra sempre. Reverter pra modelo de temporada com prazo é uma mudança de princípio de produto, não só de mecânica — vale decisão explícita se for essa a intenção.

## 6. Definição de "aprovado sem ressalvas"

Os 6 critérios de aceite verificados; teste manual confirma que cancelar a assinatura geral não afeta o passe e vice-versa; teste manual confirma que recompensa de passe já destravada continua acessível após cancelamento do passe.

# Visão de Produto — Autohunt Idle

## Visão de produto

Um idle game web de ação leve: o jogador ataca sozinho (auto-attack) enquanto explora, e o progresso continua mesmo com o jogo fechado. Estética candy/chiclete, deliberadamente longe da fantasia medieval séria do gênero de origem (Realm of the Mad God).

## Problema

Não é dor de usuário no sentido clássico de SaaS. Do lado do fundador: gerar receita recorrente de baixo overhead pra reinvestir nos outros projetos Kora. Do lado do jogador: a maioria dos idle games ou não tem "jogo" nenhum (só menu) ou exige atenção total (RotMG de verdade) — Autohunt Idle fica no meio, com ação real quando o jogador quer jogar e progresso justo quando ele não quer.

## Proposta de valor

Combina ação em tempo real (auto-attack, não precisa mirar) com farm offline calculado honestamente no servidor — nunca uma simulação falsa, sempre matemática real contra o relógio do banco. Assinatura ou anúncio recompensado destravam mais tempo automático; o jogo em si é divertido sem pagar nada.

## North Star

**Retenção D7**: % de jogadores que voltam pra ver a tela de "enquanto você tava fora" pelo menos uma vez nos primeiros 7 dias. Esse retorno é o momento central do produto — se ele não engancha, nenhuma métrica de monetização importa.

Métricas de apoio: % de jogadores free que assistem pelo menos 1 anúncio/dia, % que convertem pra assinatura, tempo médio de sessão manual.

## Público-alvo

Ver `memory/identity.md` (seção Público-Alvo e Personas) para o detalhe — resumo: jogador casual de portal web (Poki/CrazyGames), 18+, e fã do gênero de ação top-down que quer sentir jogo de verdade, não só menu.

## Situação atual vs. futuro

- **Hoje**: fundação documental criada, spec do core loop escrito (`specs/game-idle-farm-core.md`), direção de arte encomendada. Zero código.
- **Próximo (Fase 1/MVP)**: combate + farm offline + assinatura + anúncio, conforme spec.
- **Futuro (Fase 2+)**: portal de distribuição escolhido e integrado; chat e marketplace avaliados só depois de plano de segurança específico (exigem verificação de idade mais forte que o resto do jogo).

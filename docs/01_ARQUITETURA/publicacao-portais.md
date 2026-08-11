# Publicação em portais — processo e riscos técnicos

> Cobre CrazyGames e Poki. Ver também `memory/restrictions.md` (restrição de gateway de pagamento, já registrada) e `docs/00_VISAO/proposta-valor.md` (canal ainda em aberto).

## ⚠️ Risco técnico não resolvido — Poki bloqueia requisição externa por padrão

A Poki bloqueia por padrão qualquer chamada de rede saindo do jogo para serviço de terceiro — fontes externas, CDN, e por extensão, muito provavelmente chamadas ao Supabase (auth, banco, RPC). Existe exceção documentada para jogos multiplayer com servidor externo (mediante política de privacidade) e revisão caso a caso para analytics — **mas não há confirmação de que uma arquitetura BaaS tipo Supabase se qualifica**.

Isso ameaça diretamente a arquitetura decidida em ADR-001 **se o canal for Poki**. Antes de investir em build:
1. Contatar o suporte da Poki perguntando explicitamente se chamada a um BaaS (Supabase: auth + banco + RPC) se enquadra na exceção de "serviço externo necessário para o jogo funcionar", nos mesmos moldes da exceção de multiplayer
2. Se a resposta for não: CrazyGames não tem essa restrição documentada — pode virar o canal primário por eliminação técnica, não só por causa do bloqueio de pagamento já registrado

## CrazyGames — processo

1. Submissão em [developer.crazygames.com/games](https://developer.crazygames.com/games) — sem custo, sem exclusividade exigida (dá pra publicar o mesmo jogo em outro lugar também)
2. **Basic Launch**: sem SDK obrigatório, sem monetização, teste com audiência limitada (~2 semanas) — download inicial ≤50MB, total ≤250MB, ≤1500 arquivos
3. Se performar bem: convite pra **Full Launch** — aí sim SDK completo obrigatório (ads pelo SDK deles, integração de conta se aplicável)
4. **Compra dentro do jogo**: só por convite adicional, depois de provar performance em anúncio — Xsolla exclusivo, sem alternativa (ver `memory/restrictions.md`)
5. Conteúdo precisa aderir a **PEGI12** — mild violence, encaixa bem com a direção "chiclete" já decidida, não é uma restrição nova pra nós
6. Payout via Tipalti — onboarding de endereço/dado fiscal/pagamento, aceita pessoa física ou empresa (Kora já tem CNPJ, não deve ser bloqueio)

## Poki — processo

Processo em 5 níveis: Requisitos → Feedback/Playtesting → Player Fit Test → Web Fit Test → Revisão Final. Mais curado/competitivo que a CrazyGames.

- Alvo de download inicial: **8MB** (bem mais agressivo que os 50MB da CrazyGames)
- 16:9, funciona em modo incógnito (cuidado com uso direto de `localStorage`, precisa de try/catch)
- Eventos de SDK obrigatórios (`gameplayStart`, `gameplayStop`, `commercialBreak`) com regras específicas de quando disparar
- Zero elemento de compra dentro do jogo, sob nenhuma circunstância (já registrado como bloqueio de assinatura em `memory/restrictions.md`)
- Bloqueio de requisição externa por padrão — ver risco no topo deste documento

## Em comum

- Nenhuma das duas cobra pra publicar
- Nenhuma exige exclusividade — o mesmo jogo pode rodar nas duas, ou em domínio próprio, ao mesmo tempo
- Ambas fazem curadoria de qualidade — não é upload-e-pronto, tem QA e teste com jogador real antes do lançamento completo
- Nenhuma parece exigir CNPJ/empresa formal só pra **submeter** — o onboarding fiscal/pagamento entra na hora de **receber**, e aceita pessoa física ou jurídica

## O que o build da Fase 2 já resolveu (2026-08-11)

Implementado em `specs/build-fase-2-portal.md`, com testes que guardam cada item:

- **Camada de portal isolada** (`src/lib/portal/`): CrazyGames, Poki e domínio próprio atrás da
  mesma interface. Trocar de canal é `VITE_CANAL`, não reescrita — e como nenhum dos dois
  portais exige exclusividade, dá pra publicar nos três ao mesmo tempo
- **Nenhum adapter carrega SDK por conta própria.** O script vem da página que hospeda o jogo;
  se não estiver lá, o adapter degrada para "sem anúncio" em vez de quebrar. Isso é
  consequência direta do bloqueio de request externo da Poki
- **Caminhos relativos no build** (`base: './'`) — os portais servem de subdiretório e a
  CrazyGames recebe zip
- **Orçamento de tamanho verificado a cada build** (`scripts/verificar-orcamento.mjs`): falha se
  o download inicial passar de 8 MB (teto da Poki) ou o total de 250 MB / 1500 arquivos (teto da
  CrazyGames). Hoje o artefato está em **0,39 MB**
- **Modo incógnito coberto** (`src/lib/armazenamento.ts`): todo acesso a `localStorage` está em
  `try/catch`, e sem armazenamento persistente o jogo cai para memória em vez de abrir em branco.
  Vale também para o iframe de terceiro, que é a situação normal em portal
- **`gameplayStart` / `gameplayStop`** disparados só na transição, e nunca durante carregamento,
  painel aberto ou quebra comercial
- **Zero elemento de compra onde o canal proíbe**: com `VITE_CANAL=poki`, nem a menção à
  assinatura aparece na interface

### Ressalva aberta — crédito de anúncio

Os SDKs de anúncio recompensado dos dois portais são **client-side**: não existe callback
servidor-a-servidor, que é o que o critério 7 de `specs/game-idle-farm-core.md` pede. A
mitigação implementada (ticket emitido pelo servidor + JWT + tetos reaplicados no banco) está em
**ADR-004, com status Proposto** — precisa de decisão antes de virar oficial.

## Decisão pendente

Este documento não resolve qual canal usar primeiro — só mapeia o caminho técnico de cada um. Combinado com a restrição de pagamento já registrada, a leitura atual é: **CrazyGames tem menos fricção pro nosso modelo** (sem bloqueio de request externo documentado, PEGI12 já bate com a direção de arte), mas com IAP só depois de provar tração em anúncio. Poki tem alcance maior mas dois bloqueios técnicos/de negócio a resolver antes.

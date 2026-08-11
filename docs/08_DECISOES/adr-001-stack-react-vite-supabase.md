# ADR-001 — Stack: React + Vite + Supabase + Vercel, sem VPS

**Status**: Aceito
**Data**: 2026-08-10
**Decisores**: Matheus Bonato
**Supersede**: —
**Supersedido por**: —

---

## Contexto

Projeto novo (Autohunt Idle), bootstrap/pré-receita, time pequeno. Precisa: subir rápido, custar próximo de zero até validar, e suportar um loop de combate auto-attack em tempo real no client mais um cálculo de progresso offline confiável no servidor. Não há mundo compartilhado em tempo real (ver ADR-002 e `specs/game-idle-farm-core.md`) — cada jogador está no próprio mapa.

## Decisão

Vamos usar **React + Vite** no frontend, **Supabase** (Postgres, Auth, RLS, Edge Functions) como backend-as-a-service, e **Vercel** para deploy do frontend. Modelo de arquitetura A (SPA + BaaS) do padrão Kora. **Sem VPS e sem servidor de jogo dedicado.**

## Alternativas Consideradas

### 1. API própria contract-first (Modelo B: Node/Express + Drizzle/Prisma + Postgres)

- **Prós**: controle total, contrato de API explícito, menos lock-in de fornecedor
- **Contras**: mais infra, mais tempo de setup, exige gerenciar servidor
- **Descartado porque**: não há justificativa de escala/equipe pra pagar esse custo agora; camada de serviços isolada (regra transversal do padrão Kora) deixa a migração A→B viável depois, se necessário

### 2. Engine de jogo dedicada (Godot/Unity, export WebGL)

- **Prós**: ferramentas de jogo "de verdade" (física, animação, editor visual)
- **Contras**: curva de aprendizado nova, bundle maior pra portal web, não reaproveita nada do stack já dominado nos outros projetos Kora
- **Descartado porque**: o jogo é simples o bastante (auto-attack, sem física complexa) pra não justificar trocar de stack inteiro

### 3. Servidor de jogo dedicado desde já (Colyseus, tick loop próprio)

- **Prós**: prepara terreno caso o jogo vire multiplayer de verdade
- **Contras**: custo de infra recorrente, complexidade que não tem uso nenhum no modelo atual (instanciado, sem estado compartilhado)
- **Descartado porque**: over-engineering pro escopo decidido — ver restrição técnica em `memory/restrictions.md`

## Consequências

### Positivas

- Reaproveita 100% do conhecimento e do stack já dominado nos outros projetos Kora (GASTROMUNDI, Kora AI)
- Tier gratuito do Supabase + Vercel cobre o MVP inteiro
- RLS resolve isolamento por jogador sem escrever backend próprio
- Deploy trivial, sem gestão de servidor

### Negativas / Trade-offs

- O loop de renderização do jogo (combate, movimento) precisa rodar fora do ciclo de render do React — `requestAnimationFrame` + canvas/PixiJS, não componentes React re-renderizando a 60fps
- Supabase Realtime não é suficiente para sincronizar posição/combate de múltiplos jogadores em alta frequência — limite conhecido, aceitável porque o jogo é instanciado (ver ADR-002), não compartilhado
- Acoplamento ao Supabase como BaaS — mitigado pela camada de serviços obrigatória (`src/lib/`), que isola todo acesso e permite trocar de provedor depois sem reescrever a UI

## Referências

- `specs/game-idle-farm-core.md` — spec do core loop que motivou essas restrições
- `references/arquiteturas.md` (skill `fundacao-de-projeto`) — árvore de decisão completa
- `memory/restrictions.md` — restrição técnica "sem VPS / servidor dedicado"

## Notas de Implementação

- Migrations em `supabase/migrations/`
- Toda tabela assume RLS por `player_id`/`user_id` (não `tenant_id` — ver ADR-002)
- Camada de serviços obrigatória em `src/lib/` — nenhum componente chama o SDK do Supabase direto
- Cálculo de farm offline via RPC `SECURITY DEFINER`, nunca timestamp vindo do client

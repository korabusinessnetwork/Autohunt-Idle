# Tech stack — justificativa · Autohunt Idle

| Tecnologia | Papel | Por quê |
|---|---|---|
| React + Vite | Frontend SPA | Reaproveita 100% do conhecimento já dominado nos outros projetos Kora; build rápido |
| **TypeScript** | Linguagem | Padrão em todos os outros projetos Kora (GASTROMUNDI, Kora AI). **Confirmado no build da Fase 1 — ver ADR-003.** |
| Supabase (Postgres) | Banco + Auth + RLS + Edge Functions | BaaS gerenciado, tier gratuito cobre o MVP, RLS resolve isolamento por jogador sem backend próprio |
| Vercel | Deploy do frontend | Padrão Kora, deploy trivial, tier gratuito |
| **Canvas 2D nativo** | Renderização do jogo | React puro não é feito pra loop de 60fps, então o jogo roda em `requestAnimationFrame` fora do ciclo do React. **PixiJS foi avaliado e não entrou no MVP** (ADR-003): o jogo desenha ~10 sprites chapados, sem shader, e a `interface Renderizador` deixa a troca barata quando a Fase 3 justificar |
| **Módulo de i18n próprio (tipado)** | Internacionalização | Lançamento bilíngue PT+EN, todo texto com chave desde o dia 1. **i18next foi avaliado e não entrou** (ADR-003): com dicionário tipado, tradução faltando quebra o build em vez de virar fallback em runtime |
| **Vitest** | Testes (`npm test`) | Fecha o `TEST_CMD` que estava pendente no intake. Já vem no ecossistema Vite, custo zero (ADR-003) |
| SDK de anúncio recompensado | Monetização do tier grátis | Provedor específico (AdSense for Games, portais já vêm com SDK próprio) — a decidir junto com a escolha de portal |
| Gateway de pagamento | Assinatura, passe, compra de diamante | **Dois gateways, roteados por idioma do jogador**: Stripe pro público internacional (idioma EN), Asaas pro público brasileiro (idioma PT, ganha Pix/boleto). Escolha do gateway é invisível pro jogador — ele só vê "pagar", o roteamento é automático. Split de pagamentos do Asaas segue disponível pro que precisar (`specs/mercado-diamante.md`), mas o mercado P2P em si não toca gateway nenhum |

## Não escolhido (e por quê)

- **API própria (Node/Express)** — sem justificativa de escala pra pagar o custo de infra agora (ver ADR-001)
- **Servidor de jogo dedicado (Colyseus)** — só faria sentido com mundo compartilhado em tempo real, que não faz parte do escopo (ver ADR-002 e `specs/game-idle-farm-core.md`)
- **Engine de jogo dedicada (Godot/Unity)** — não reaproveita o stack já dominado, sem ganho claro pro escopo simples do jogo

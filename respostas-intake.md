# Respostas do Intake — Autohunt Idle

> Fonte de verdade das respostas da entrevista de fundação. O `scaffold.sh` lê
> este arquivo para substituir os placeholders. Preenchido durante a Fase 1.
> Data do intake: 2026-08-10 · Conduzido por: Matheus Bonato (intake com Claude)

## Bloco 1 — Produto e identidade
- **PRODUTO (nome + essência):** Sem nome definitivo — slug de trabalho `game-idle-farm-core`. Idle game web, ação leve estilo Realm of the Mad God (top-down, auto-attack).
- **ESSENCIA (1 frase):** Jogo idle "chiclete" onde o personagem farma sozinho — ao vivo por auto-attack, offline por cálculo — com assinatura destravando até 24h/dia automático e anúncio recompensado destravando até 2h/dia pra quem não assina.
- **PROBLEMA que resolve:** Não é dor no sentido SaaS — objetivo declarado é gerar receita pra reinvestir em outros projetos Kora. Pro jogador: progresso constante com fricção mínima.
- **PROPOSTA de valor / diferencial:** Estética/ação RotMG combinada com auto-farm monetizado — combinação pouco comum no mercado de jogo web hoje (leitura pessoal, não validada com dado de mercado).
- **Existe código ou é do zero?** Do zero. Nenhum código escrito ainda; spec do core já existe (`specs/game-idle-farm-core.md`).

## Bloco 2 — Público e escopo
- **PUBLICO_ALVO primário:** Casual amplo, distribuição via portais tipo Poki/CrazyGames.
- **PERSONAS (1-3):** Jogador casual de navegador, sessão curta, quer ver progresso sem exigir skill ou dedicação alta.
- **B2B / B2C / B2B2C:** B2C.
- **"Aha moment":** Tela de retorno mostrando quanto rendeu (ou deixou de render, por falta de assinatura/anúncio) no tempo em que ficou offline — é o hook central de conversão/retenção.

## Bloco 3 — Multi-tenant e white-label
- **MULTI_TENANT:** single-tenant definitivo. **Desvio explícito do padrão Kora** (que é multi-tenant por padrão) — confirmado por Matheus, registrar como exceção em ADR.
- **WHITE_LABEL:** não — marca única, é o próprio jogo, não ferramenta vendida a clientes B2B.
- **PLANOS (free/pro/enterprise):** Sim, mas por **jogador**, não por tenant — free (0h base, até 2h/dia via anúncio) e assinante (24h/dia, sem anúncio).

## Bloco 4 — Stack e arquitetura
- **STACK:** React + Vite + Supabase + Vercel — sem VPS.
- **MODELO_ARQUITETURA:** A — SPA + BaaS (Supabase direto).
- **TEM_UI:** Sim.
- **DEPLOY:** Vercel (front) + Supabase (dados/RPC/Edge Functions).
- **SCHEMA_PATH:** `supabase/migrations/`
- **ENV_PREFIX:** `import.meta.env.VITE_*` (padrão Kora)
- **TEST_CMD:** *pendente — não discutido ainda, definir na Fase 2/3*

## Bloco 5 — Segurança e compliance
- **Trata dado pessoal/financeiro/de menores?** Pessoal (conta/auth) e financeiro (assinatura). **Sem dado de menor** — produto restrito a 18+.
- **COMPLIANCE específico:** LGPD (padrão, todo dado pessoal no Brasil). ECA Digital não se aplica diretamente (produto 18+), mas exige gate de idade real no cadastro (data de nascimento, bloqueia <18) — política sem enforcement não vale nada na prática. PCI delegado ao gateway (nunca tocamos dado de cartão).
- **Nível de isolamento:** Entre jogadores (RLS por `player_id`/`user_id`), não entre tenants.

## Bloco 6 — Custo
- **FASE_CUSTO:** Bootstrap/pré-receita — tudo em tier gratuito por padrão.
- **Serviços pagos já aprovados:** Nenhum. Gateway de pagamento e SDK de ad cobram por transação/revenue-share (não é custo fixo antecipado) — tratar como adiado até decisão explícita.

## Bloco 7 — Design (tem UI)
- **Identidade visual definida?** Não ainda.
- **Referências / tom visual:** Pixel art / top-down estilo RotMG, "chiclete" (leve, acessível). A refinar.
- **Contexto de uso crítico:** Navegador, majoritariamente desktop (portais tipo Poki/CrazyGames exigem responsivo, mas uso real tende a desktop).
- **PRINCIPIO_N1:** Intuitividade (default).

## Roadmap inicial
- **FASE_ATUAL:** Fundação (este intake) + spec do core já escrito.
- **Próximas fases:** Fundação → build do core loop (combate + farm) → integração assinatura/anúncio → avaliação de portal de distribuição → chat/marketplace (fora do escopo inicial, feature futura).

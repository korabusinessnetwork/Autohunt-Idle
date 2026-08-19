# Identidade do Produto — Autohunt Idle

## Objetivo
- Documentar a identidade, visão e diferencial do produto
- Guiar decisões de produto, design e comunicação
- Manter coerência em todos os pontos de contato com o jogador

## Contexto
- Mercado/vertical: jogo web idle/casual, distribuído via portais (Poki, CrazyGames)
- Estágio: ideação → fundação (spec do core loop escrito, fundação documental criada, zero código ainda)
- Competidores diretos: nenhum identificado combinando ação real-time estilo RotMG (auto-attack) com farm offline monetizado em tom candy/casual — leitura própria, não validada com pesquisa de mercado

## Regras Gerais
- Identidade é fonte de verdade para mensagens, tom de voz, visual
- Personas e público-alvo devem guiar todo novo recurso
- Posicionamento não muda sem revisão de mercado

## Validações
- Cada mensagem/tela alinha com a fórmula de posicionamento?
- Personas refletem o público real assim que houver dado de jogadores de verdade?

## Permissões
- Dono do produto: Matheus Bonato (ajusta propósito, persona, roadmap)
- Design/arte: aplica tom e identidade visual (ver brief em `docs/02_DESIGN_SYSTEM/`)

## Exceções
- Decisões de posicionamento overnight exigem ADR

## Auditoria
- Revisar identidade a cada marco (MVP, lançamento em portal, primeira métrica real de retenção)

## Eventos
- `product.identity_defined`, `product.positioning_updated`, `persona.identified`

## Configurações Futuras
- Validar personas com dado real de jogadores após lançamento em portal
- Testar posicionamento contra retenção D1/D7 real

## Casos de Uso
- Briefar quem for trabalhar no projeto (incluindo Claude Design/Claude Code)
- Validar novo recurso contra identidade antes de construir
- Decidir se algo entra ou sai do roadmap

## Critérios de Aceite
- [x] Propósito central claro
- [x] Personas documentadas com dores plausíveis (a validar com jogador real pós-lançamento)
- [x] Tom de voz com exemplos ✅ e ❌
- [x] Roadmap definido até Fase 2

---

## Propósito Central

### Visão
Autohunt Idle se torna uma fonte de receita recorrente e de baixa manutenção dentro do ecossistema Kora — um produto que roda praticamente sozinho, com uma base fiel de jogadores casuais, sem exigir atenção operacional constante. O objetivo declarado é gerar receita para reinvestir em GASTROMUNDI, Kora AI e Casa Coffee Colab, não construir um estúdio de jogos.

### Propósito
O que Autohunt Idle faz e por quê
- Problema que resolve: para o fundador, é uma fonte de receita de baixo overhead; para o jogador, entrega uma dose curta de progresso satisfatório sem exigir tempo de tela dedicado
- Como resolvemos: combate auto-attack em tempo real quando o jogador está presente + cálculo honesto de farm offline (servidor, não simulação) quando ele não está
- Impacto esperado: receita recorrente modesta e estável via assinatura + anúncio recompensado, com custo operacional próximo de zero (bootstrap, sem VPS)

## Público-Alvo

| Segmento | Perfil | Contexto | Necessidade |
|---|---|---|---|
| Jogador casual de portal web | 18+, qualquer nível de dedicação, sem instalar nada | Navegador, sessões de 1-5 min, várias vezes ao dia | Ver progresso sem precisar ficar "plantado" jogando |
| Fã do gênero RotMG/ação-idle | 18+, já conhece o gênero de ação top-down | Quer sentir que existe jogo de verdade, não só menu | Combate manual que dá satisfação real quando ele está presente |

## Valores
- **Simplicidade**: qualquer decisão que adicione complexidade sem adicionar diversão é cortada
- **Honestidade de monetização**: nunca esconder o que é grátis vs. pago, nunca fingir urgência artificial
- **Leveza**: tom sempre "chiclete" — nunca sério, punitivo ou corporativo

## Posicionamento

**Para** jogador casual de portal web / **que** quer ver progresso sem precisar ficar preso jogando / **Autohunt Idle** é um idle game de ação leve / **que** transforma tempo ausente em recompensa visível e honesta / **Diferente de** idle games genéricos de puro menu / **entrega** ação de verdade (auto-attack estilo RotMG) quando você está presente, e cálculo transparente de recompensa quando não está.

## Tom de Voz

**Princípios**: Direto, bobo (chiclete), nunca punitivo

**Exemplos**:
- ✅ "Enquanto você tava fora: +2.450 XP"
- ❌ "Notificação: seu período de ausência gerou acúmulo de recursos conforme política vigente do sistema."

**Tom**: Leve, engraçadinho, nunca corporativo. Nunca dá bronca por ter ficado offline — o jogo comemora o retorno, não cobra ausência.

## Manifesto (versão 1.0)
1. O jogo é bom sozinho, sem trava — a assinatura vende tempo de volta, nunca vende a diversão em si
2. Nunca esconder o teto nem fingir urgência que não existe
3. O jogador e o progresso dele são dele — sem lock-in artificial

## Personas

### Duda, jogador de intervalo
- **Contexto**: abre o navegador durante um intervalo do trabalho/estudo, via portal tipo Poki/CrazyGames
- **Dores**: cansado de jogo que exige atenção total; quer sensação de progresso em pouco tempo
- **Objetivos**: checar rápido, ver o número subir, voltar pro que tava fazendo
- **Sucesso**: joga 2-3 min, vê uma tela de retorno satisfatória, volta no dia seguinte

### Rafa, farmer dedicado
- **Contexto**: curte o gênero de ação top-down de verdade, não só idle de menu
- **Dores**: a maioria dos idle games não tem "jogo" nenhum, só clique em menu
- **Objetivos**: sentir que existe skill/ação real quando está presente
- **Sucesso**: gosta do combate manual, considera assinar pra não perder progresso nos dias que não consegue jogar

## Princípios do Produto
- Intuitividade acima de tudo — sem tutorial obrigatório
- Progresso nunca é punido — só multiplicado pela presença (assinatura/anúncio)
- Dados são do jogador — sem lock-in artificial

## Identidade Visual (marca)
- **Cores primárias**: `#FF5FA2` (rosa chiclete), `#3FE0D0` (ciano) — paleta completa em `docs/02_DESIGN_SYSTEM/`
- **Tom visual**: candy/chiclete, criaturas tipo doce/geleia — deliberadamente longe da fantasia medieval séria que o gênero de origem (RotMG) sugere
- **Logo/símbolo**: a definir — nome decidido: **Autohunt Idle**

## Roadmap

- **Fase 0 (Ideação/Fundação)** — *[ATUAL]*: spec do core loop, dungeon/raridade/skin, passe, nível+ranking+atributos, equipamento/poder, mercado/diamante e mapa de mundo/dungeon escritas (`specs/`), fundação documental criada, direção de arte encomendada ao Claude Design, gateway de pagamento decidido (Stripe + Asaas), termos de uso rascunhados
- **Fase 1 (MVP validável)**: **só `specs/game-idle-farm-core.md`** — combate auto-attack, farm offline, assinatura (24h + 2x XP), anúncio recompensado (2h/dia), tela de retorno, nível infinito (contador simples, sem sistema de atributo ainda). Objetivo: validar se o loop prende e se gera receita antes de investir nos outros 6 sistemas
- **Fase 2 (Distribuição)**: publicar o MVP num portal (Poki e/ou CrazyGames, `docs/01_ARQUITETURA/publicacao-portais.md`) — validação com jogador real, não hipótese
- **Fase 3 (Expansão, guiada pelo que a Fase 2 mostrar)**: dungeon/raridade/skin, passe, atributo completo + ranking global, equipamento/poder com conjunto, diamante + mercado P2P, biomas (entregues 16, não os 8 planejados — ver `specs/fabrica-morta-biomas-9-a-16.md`) — não necessariamente todas, nem nessa ordem; entram conforme o que os dados de jogador real justificarem
- **Fase 4**: chat e marketplace social — fora do escopo inicial; exige verificação de idade e moderação antes de existir (ver `memory/restrictions.md`)

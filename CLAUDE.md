# Diretrizes de Desenvolvimento — Autohunt Idle

> Constituição do projeto.

## Princípio nº 1 — INTUITIVIDADE (inegociável)

O foco principal do sistema é **ser um jogo casual que qualquer pessoa entende sem tutorial**. Em qualquer decisão, priorize este princípio acima de conveniência técnica. Regras práticas:

- Zero fricção pra jogar manual: sem tela de tutorial obrigatória, a ação principal (andar/atirar) é auto-explicativa em 5 segundos
- A tela de retorno ("enquanto você tava fora") é o momento mais importante do produto — precisa ser instantaneamente legível, sem exigir leitura
- Estados sempre visíveis: carregando, erro, vazio e sucesso com feedback humano
- Prevenção de erro > mensagem de erro
- Consistência total com o design system (`docs/02_DESIGN_SYSTEM/`)

## Fonte de verdade (leia antes de qualquer mudança relevante)

- **`memory/`** — identidade, decisões, padrões, aprendizados e restrições. Consultar antes de decisões de produto/arquitetura.
- **`docs/`** — regras de negócio (`03_REGRAS_DE_NEGOCIO/`), design system (`02_DESIGN_SYSTEM/`), fluxos, modelagem, ADRs (`08_DECISOES/`) e o plano de segurança (`11_SEGURANCA/`).
- **ADR-001** define a stack vigente; **ADR-002** define o desvio single-tenant do padrão Kora. ADRs em `docs/08_DECISOES/` registram as decisões de arquitetura.
- Schema do banco: `supabase/migrations/`.
- Se doc e código conflitarem, a documentação prevalece — e deve ser corrigida quando estiver errada.
- **Produto = single-tenant.** Este projeto é o próprio jogo (produto B2C), não uma ferramenta vendida a múltiplos clientes/estabelecimentos. **Ao contrário dos outros projetos Kora, NÃO modele `tenant_id` nem lógica de white-label aqui** — ver ADR-002. Isolamento é por `player_id`/`user_id`, não por tenant.

## Processo de trabalho

1. **Planejar TUDO antes de executar** — escopo fechado, sem retrabalho. Spec já existe em `specs/game-idle-farm-core.md` para o core loop.
2. Builds multi-parte → fan-out paralelo com **dono exclusivo por arquivo** (dois agentes nunca tocam o mesmo arquivo).
3. **Sintetizar e VALIDAR no fim** — revisar cada entrega, rodar testes e build.
4. Tarefa de peça única não ganha fan-out.

## Custo — priorizar o gratuito (bootstrap, pré-receita)

Enquanto o projeto está em construção/pré-receita, **use sempre meios gratuitos**. Toda implementação que exija investimento é **adiada por padrão**, salvo decisão explícita do dono. Ao esbarrar em algo pago, apresente: custo aproximado, alternativa gratuita, impacto, e recomendação (agora × depois) — o dono decide. Detalhes em `memory/restrictions.md`.

## Segurança e compliance (obrigatório em todo código novo)

- **Nunca** hardcodar chaves, URLs de API, secrets ou senhas — usar `import.meta.env.VITE_*`.
- **Nunca** `select *` em tabelas sensíveis — sempre campos explícitos.
- **Sempre** validar inputs do usuário antes de qualquer operação no banco.
- **Nunca** logar dados sensíveis (senhas, tokens, dados financeiros).
- **Sempre** verificar autenticação antes de renderizar rota protegida.
- Ao criar tabela/função nova, lembrar que **RLS** precisa ser configurada (por `player_id`, não por `tenant_id` — ver ADR-002).
- **Produto é 18+.** Cadastro exige data de nascimento real (não checkbox de autodeclaração) e bloqueia conta <18 — requisito do ECA Digital (Lei 15.211/2025), não opcional. Ver `memory/restrictions.md`.
- **Nunca** implementar recompensa aleatória paga (loot box) — restrição permanente, ver `memory/restrictions.md`.
- Cálculo de farm offline **sempre** via RPC `SECURITY DEFINER` usando `now()` do Postgres — nunca aceitar timestamp vindo do client.
- Plano de segurança completo em `docs/11_SEGURANCA/` (a preencher na Fase 3).

## Padrões de código

- Componentes React em arquivos separados; lógica de jogo (loop, cálculo) isolada de componentes de UI.
- Variáveis/funções em português para nomes de domínio (`calcularFarmOffline`), inglês para padrões técnicos (`handleSubmit`).
- Sempre tratar erros de chamadas ao backend com `try/catch` ou checagem de `.error`.
- Logs de atividade fire-and-forget — nunca bloquear a operação principal.
- Rodar `npm test` antes de commitar; funções puras (cálculo de farm, etc.) nascem com teste.
- **Separar CSS do JSX** — estilo desacoplado da marcação.

## Stack

- React + Vite
- Supabase (Auth, Postgres, RLS, Edge Functions) — SDK direto, sem API própria
- Vercel (deploy do frontend)
- Sem VPS, sem servidor de jogo dedicado (mundo instanciado, não compartilhado)
- Renderização do jogo: canvas/PixiJS com loop próprio via `requestAnimationFrame`, fora do ciclo de render do React

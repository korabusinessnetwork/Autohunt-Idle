# 11 — SEGURANÇA · Autohunt Idle

> Plano de segurança versionado: ameaças, secrets, RLS, compliance, resposta a incidentes.

**Nota**: Esta é a pasta de PLANO DE SEGURANÇA — design decisions, policies, checklists. Código de segurança (autenticação, validação, sanitização) vive em `src/`.

> ⚠️ Este projeto é single-tenant ([ADR-002](../08_DECISOES/adr-002-single-tenant.md)) — isolamento é por `player_id`/`user_id`, não por `tenant_id`.

## Princípio

Prevenir o erro é melhor que reportar o erro. Desabilite, valide e isole antes de deixar a falha acontecer — no código e nos dados.

## Modelo de ameaças por camada

| Camada | Ameaça principal | Controle obrigatório |
|---|---|---|
| Cliente/UI | Vazamento de segredo, XSS, dado sensível em `localStorage` | Só chave pública (`anon`) no front; nunca `service_role`; nada sensível em `localStorage` |
| Rede/API | Requisição forjada, dado fora de contrato | Validação por schema (Zod) na fronteira; envelope `{data,error,meta}`; HTTPS sempre |
| Autorização | Um jogador lê/edita dado de outro | **RLS** em TODA tabela, política por `player_id`/`user_id`; testar isolamento |
| **Cálculo de farm offline** | Client forja tempo decorrido pra ganhar recompensa de graça | RPC `SECURITY DEFINER` usa exclusivamente `now()` do Postgres — nenhuma rota aceita timestamp do client |
| **Chaves e dungeon** | Client alega ter mais chaves do que tem, ou declara resultado de dungeon direto | Mesma RPC resolve: servidor decide quantas chaves existem e quantas dungeons foram completadas — client nunca declara resultado |
| **Crédito de anúncio** | Client alega ter assistido anúncio sem ter assistido | Crédito só é aplicado via callback validado do SDK no servidor, nunca uma chamada direta do client |
| Dados | Query vazando colunas sensíveis | Nunca `select *` em tabelas sensíveis (conta, assinatura, pagamento) — campos explícitos |
| Lógica de negócio | Regra sensível burlável no cliente | Farm, assinatura e crédito de anúncio sempre em Edge Function/RPC, nunca resolvidos no front |
| Observabilidade | PII/segredo em log | Log sem dado pessoal/financeiro em texto claro |
| Segredos | Chave commitada no repo | Só `import.meta.env.VITE_*`; `.env` no `.gitignore`; secret scanning no CI |

## Controles obrigatórios (checklist de release)

### Segredos e configuração
- [ ] Nenhuma chave/URL/secret hardcodada — tudo via `import.meta.env.VITE_*`
- [ ] `.env*` no `.gitignore`
- [ ] `service_role` jamais exposta ao cliente
- [ ] Secret scanning ativo (GitHub secret scanning / `gitleaks`, gratuito)

### Autenticação e autorização
- [ ] Cadastro exige data de nascimento real (campo de data, não checkbox de "sou maior de idade") — **bloqueia conta <18 no momento do cadastro**
- [ ] Auth verificada antes de renderizar rota protegida
- [ ] RLS ativa em **todas** as tabelas por `player_id`/`user_id` antes de produção
- [ ] Isolamento entre jogadores testado (jogador A não acessa/edita dado do jogador B)

### Entrada e dados
- [ ] Todo input validado antes de qualquer operação no banco
- [ ] Sem `select *` em tabelas sensíveis
- [ ] RPC de farm offline: teste manual obrigatório — alterar hora do sistema local no client não pode mudar o resultado
- [ ] Callback de anúncio: teste manual obrigatório — chamar a rota de crédito direto (sem o callback real do SDK) tem que falhar

### Logging e observabilidade
- [ ] Nenhum log de senha, token ou dado financeiro
- [ ] Log de atividade fire-and-forget — nunca bloqueia a operação principal

### Ciclo e dependências
- [ ] Dependências críticas com versão fixada
- [ ] `npm audit` sem vulnerabilidade crítica aberta

## Compliance

### Idade e conteúdo — 18+

Produto restrito a maiores de 18 anos. Decisão registrada em `respostas-intake.md` (Bloco 5) e `memory/restrictions.md`.

- Gate de idade real no cadastro (data de nascimento), não autodeclaração isolada tipo checkbox — proporcional ao risco do serviço (não é conteúdo "proibido" tipo aposta/pornô, então **não** exige verificação por biometria/documento; um campo de data de nascimento validado é suficiente nesse nível de risco)
- **Nunca implementar recompensa aleatória paga (loot box)** — é o único item de jogo eletrônico explicitamente vedado pelo ECA Digital (Lei 15.211/2025) para menores. Mantido como restrição permanente mesmo com produto 18+, pra não precisar reabrir essa análise se o público mudar um dia
- Publicidade comportamental/direcionada a menor é proibida por lei — não se aplica hoje (produto 18+), mas documentar aqui se algum dia o público mudar

### LGPD

- Dado pessoal (conta) e financeiro (assinatura) só tratado com base legal válida
- Direito de exportar e excluir dados previsto desde a fundação (não é feature "depois")
- Nenhum dado de cartão passa pelo nosso código — delegado 100% ao gateway de pagamento

### Autoridade fiscalizadora

A ANPD (mesma autoridade da LGPD) fiscaliza também o ECA Digital, com poder de aplicar advertência, multa, e em casos graves suspender a atividade da plataforma. A regulamentação está vigente desde março de 2026 mas ainda tem normas técnicas sendo publicadas — **recomendação: revisar com um advogado antes do lançamento público**, este documento não é aconselhamento jurídico.

### Se chat ou marketplace entrarem no roadmap (Fase 3+ do produto, não da fundação)

Fora de escopo do MVP (ver `memory/identity.md`, roadmap). Quando entrarem:
- Se o portal de distribuição for a Poki: qualquer chat/conteúdo gerado por usuário exige aprovação prévia deles e uso das ferramentas de moderação que a própria Poki fornece — não é opcional
- Reabrir esta seção de compliance por completo antes de construir — verificação de idade mais forte, moderação, e revisão legal específica

## Resposta a incidentes (mínimo viável)

1. **Detectar** — de onde veio (log, report, scanning). Registrar em `memory/bugs.md` com severidade.
2. **Conter** — revogar chave vazada, desabilitar rota, bloquear conta afetada.
3. **Corrigir** — patch + teste que prova a correção.
4. **Registrar** — post-mortem curto em `memory/learnings.md`; se muda arquitetura/política, abrir ADR.
5. **Prevenir** — o aprendizado vira restrição (`memory/restrictions.md`) ou padrão (`memory/patterns.md`).

Cenários prováveis pra esse produto especificamente:
- RPC de farm offline explorada (alguém descobre como forjar tempo decorrido) — severidade alta, afeta economia do jogo inteiro
- Callback de anúncio burlado (crédito sem assistir) — severidade média, afeta receita do tier grátis
- Vazamento de dado de assinatura/pagamento — severidade crítica, aciona LGPD/ANPD

## Custo (fase bootstrap)

Todos os controles acima usam tiers gratuitos (Supabase RLS, GitHub secret scanning/Dependabot, `npm audit`, `gitleaks`, Zod). O gate de idade por data de nascimento é gratuito (validação simples); verificação mais forte (biometria/documento) não é necessária no nível de risco deste produto — ver `memory/restrictions.md`. Monitoramento pago, WAF pago e consultoria jurídica formal são os únicos itens desta lista com custo real — jurídico é o único que recomendo não adiar antes do lançamento público, dado o risco de multa/suspensão.

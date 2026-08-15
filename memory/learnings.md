# Aprendizados — Autohunt Idle

## Objetivo
- Manter memória viva do que aprendemos construindo o produto
- Documentar raciocínios antes de viraem padrão ou decisão
- Evitar repetir mesmo erro 6 meses depois

## Contexto
- Aprendizados vêm de: uso em produção, feedback de usuário, post-mortems, code review
- Aprendizado que consolida = migra para `memory/patterns.md` ou `memory/decisions.md`

## Regras Gerais
- Aprendizado é **observação real**, não especulação
- Data + contexto são obrigatórios
- Ação recomendada (implementar, pesquisar, descartar) sempre presente

## Validações
- Aprendizado veio de situação real (não teoria)?
- Tem recomendação de ação concreta?

## Permissões
- Qualquer um documenta aprendizado (PR adiciona linha)
- Tech lead: promove para padrão/decisão

## Exceções
- Aprendizado crítico (segurança/compliance): entra imediatamente mesmo in-progress

## Auditoria
- Revisar aprendizados mensais, promover consolidados
- Descartar aprendizados superados sem remorso

## Eventos
- `learning.documented`, `learning.promoted_to_pattern`, `learning.archived`

## Casos de Uso
- "Por que {{CAUSA}}?"
- "Já fizemos isso antes? Como?"
- Pesquisa de causa-raiz pós-incidente

## Critérios de Aceite
- [ ] Mínimo 1 linha por tabela de área preenchida
- [ ] Cada aprendizado linkado a issue ou PR quando aplicável
- [ ] Ação clara (implementar agora / pesquisar / descartar)

---

## Aprendizados Técnicos

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| 2024-01-20 | Supabase realtime lento com >500 subscriptions ativas | Implementar connection pooling (ADR-XX), pesquisar alternativa se escalar |
| (exemplo preenchido) | Validação server-side é obrigatória mesmo com client-side | Criar padrão de schema Zod em toda API (promover para patterns.md) |
| 2026-08-15 | `scripts/pg-local.sh` **nunca** saiu com código 0: rodava `teste-migrations.sql` duas vezes contra o mesmo banco (as fixtures inserem UUID fixo em `auth.users`, então a segunda morria em chave duplicada) e terminava em `$MANTER && echo`, que devolve 1 quando `MANTER=false`. O job de Postgres do CI estava vermelho desde que nasceu | Script de verificação precisa ter o **caminho de falha testado** — rodar uma vez de propósito quebrado e conferir que o código de saída muda. Verde/vermelho que nunca foi visto verde não é sinal |
| 2026-08-15 | Com o CI cronicamente vermelho, ninguém repara quando ele fica vermelho por um motivo NOVO: a regra de atributo mudou em 2026-08-13 e o teste de fumaça do banco continuou afirmando a regra velha por dois dias, sem chamar atenção | CI vermelho não é ruído a tolerar — enquanto houver um vermelho conhecido, todo vermelho novo entra de graça. Zerar antes de seguir |

## Aprendizados de Produto

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| {{DATA}} | {{O_QUE_DESCOBRIMOS}} | {{ACAO_RECOMENDADA}} |
| 2024-02-10 (exemplo) | Usuários finais não leem tooltips | Redesign onboarding para guided walkthrough em vez de hover hints |

## Aprendizados de Processo

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| {{DATA}} | {{O_QUE_DESCOBRIMOS}} | {{ACAO_RECOMENDADA}} |
| 2024-01-25 (exemplo) | PRs sem testes demoram 2x mais tempo em review | Exigir `npm test` antes de abrir PR (adicionar husky hook) |

## Aprendizados de Negócio

| Data | Aprendizado | Lição/Ação |
|---|---|---|
| {{DATA}} | {{O_QUE_DESCOBRIMOS}} | {{ACAO_RECOMENDADA}} |
| 2024-02-15 (exemplo) | Usuário-alvo não quer white-label, quer SaaS robusto | Pivô roadmap: focar robustez antes de customização (ADR-XX, Fase 2) |

---

## Aprendizados Promovidos → Padrão

| Aprendizado Original | Data Promo | Padrão Resultado | Status |
|---|---|---|---|
| "Validação server obrigatória" | 2024-02-20 | `pattern: Validação com Zod` | ✅ Ativo |
| {{APRENDIZADO}} | {{DATA}} | {{PADRAO_CRIADO}} | {{STATUS}} |

## Aprendizados Promovidos → Decisão

| Aprendizado Original | Data Promo | ADR Resultado | Status |
|---|---|---|---|
| {{APRENDIZADO}} | {{DATA}} | ADR-NNN | {{STATUS}} |

## Limpeza Periódica

**Última revisão**: {{DATA_ULTIMA_REVISAO}}

Aprendizados obsoletos (superados por realidade nova):
- {{APRENDIZADO_VELHO}} (descarte, razão: {{RAZAO}})

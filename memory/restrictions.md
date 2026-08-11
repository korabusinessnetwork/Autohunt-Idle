# Restrições Permanentes — Autohunt Idle

## Objetivo
- Documentar limites e restrições que guiam decisões
- Evitar caminhos bloqueados (custo, legal, ético, técnico)
- Força atualizações de restrições vencidas

## Contexto
- Restrição = barreira de entrada; exceção exige ADR
- Revisão: trimestral

## Regras Gerais
- Nenhuma restrição ignorada sem ADR formal de exceção
- Restrições legais/compliance têm prioridade máxima
- Restrição vencida é removida; não acumula dívida técnica

## Validações
- Restrição tem justificativa concreta?
- Data de revisão planejada está clara?

## Permissões
- Dono (Matheus Bonato): aprova exceção de restrição legal ou de produto
- Tech lead: aprova exceção técnica

## Exceções
- Restrição legal pode ser violada por decisão explícita do dono com ADR (raro)

## Auditoria
- Revisar todas as restrições contra realidade trimestralmente
- Exceções aprovadas viram ADR público

## Eventos
- `restriction.added`, `restriction.excepted`, `restriction.lifted`

## Casos de Uso
- "Posso adicionar loot box?"
- "Posso deixar menor de idade se cadastrar?"
- "Posso usar servidor dedicado?"

## Critérios de Aceite
- [x] Cada categoria tem mínimo 1 restrição preenchida
- [x] Restrições com data de revisão clara
- [ ] Exceções aprovadas linkadas a ADR (nenhuma exceção aberta ainda)

---

## Restrições Técnicas

| Restrição | Detalhes | Revisão | Exceção |
|---|---|---|---|
| Sem VPS / servidor de jogo dedicado | Mundo instanciado (não compartilhado em tempo real); Supabase cobre tudo | 2026-11-10 | Só se mundo compartilhado/PvP entrar no roadmap — exige ADR |
| Sem processo persistente 24/7 | Farm offline é calculado sob demanda (RPC no reconnect), nunca um worker rodando contínuo | 2026-11-10 | — |
| Cálculo de farm offline nunca confia no client | RPC `SECURITY DEFINER` usa `now()` do Postgres; timestamp do client é ignorado | 2026-11-10 | Nunca. Prioridade máxima |
| **Poki pode bloquear chamada ao Supabase** | Poki bloqueia requisição externa por padrão; não confirmado se BaaS se qualifica pra exceção (que hoje só cobre multiplayer com servidor externo) | 2026-08-10 | **Confirmar com a Poki antes do build** — ver `docs/01_ARQUITETURA/publicacao-portais.md` |

## Restrições Legais / Compliance

| Restrição | Detalhes | Prioridade | Revisão |
|---|---|---|---|
| Produto restrito a 18+ | Cadastro exige data de nascimento real, bloqueia conta <18 — não é só um aviso no rodapé | CRÍTICA | 2026-11-10 (trimestral) |
| Sem loot box / recompensa aleatória paga | Único item de jogo eletrônico vedado explicitamente pelo ECA Digital (Lei 15.211/2025) para menores; mantido fora do produto inteiro mesmo sendo 18+, para não reabrir a questão se o público mudar | CRÍTICA | 2026-11-10 (trimestral) |
| Anúncio não pode ser comportamental/direcionado a menor | Não se aplica hoje (produto 18+), mas documentado — se o público mudar, revisar junto com a restrição de idade acima | MÉDIA | 2026-11-10 |
| LGPD padrão | Dado pessoal (conta) e financeiro (assinatura) só tratado com base legal válida; direito de exportar/excluir previsto desde o início | CRÍTICA | 2026-11-10 (anual) |

## Restrições de Custo (Fase Bootstrap)

**Diretriz Geral**: Priorizar meios **gratuitos**. Toda implementação com custo relevante é **ADIADA por padrão**, salvo decisão explícita do dono.

### Itens Pagos Identificados

| Item | Custo Aprox | Alt Grátis | Impacto | Status |
|---|---|---|---|---|
| Gateway de pagamento | Cobra por transação (%), não é custo fixo | Nenhuma — assinatura exige gateway | CRÍTICA | [**DECIDIDO: dois gateways — Stripe (EN/internacional) + Asaas (PT/Brasil), roteados por idioma do jogador**] |
| Cliente internacional no Asaas | Exige liberação manual com gerente de conta; depois só cartão internacional, sem Pix/boleto, sem parcelamento | Nenhuma — resolvido roteando esse público pro Stripe em vez de pedir liberação | BAIXA | [Não bloqueia mais — público EN vai pro Stripe direto] |
| Diamante — saque pra dinheiro real | Não pode existir, por nenhuma rota, nunca — inclui venda/transferência de conta | N/A — regra permanente | CRÍTICA | [BLOQUEADO permanentemente, ver `specs/mercado-diamante.md`] |
| Asaas/Stripe dentro da Poki | Poki proíbe qualquer compra/assinatura dentro do jogo — não é questão de qual gateway, é zero IAP permitido | Modelo 100% anúncio nesse canal | CRÍTICA | [BLOQUEADO — sem exceção; decisão de canal em aberto] |
| Asaas/Stripe dentro da CrazyGames | CrazyGames exige Xsolla exclusivo pra IAP, vinculado à conta do jogador lá — sem opção de outro gateway nesse fluxo, e acesso é por convite (só depois de provar ads) | Nenhuma dentro da plataforma deles | CRÍTICA | [BLOQUEADO nesse canal — Asaas só viável fora do embed, em domínio próprio] |
| SDK de anúncio recompensado | Revenue-share, não é custo direto | Nenhuma — é a própria fonte de receita do tier grátis | — | [OK usar desde já] |
| Servidor de jogo dedicado (Colyseus etc.) | Custo de infra recorrente | Não precisa — mundo é instanciado | ALTA se algum dia precisar | [ADIADO permanentemente, ver Restrições Técnicas] |
| Verificação de idade robusta (biometria/documento) | Serviço de terceiro pago | Gate simples de data de nascimento no cadastro (proporcional ao risco, ver ADR-002 e docs/11_SEGURANCA) | MÉDIA | [ADIADO — não necessário nesse nível de risco] |

**Processo**: Dono revisa lista trimestralmente, aprova investimentos conforme receita cresce.

## Restrições de Produto

| Restrição | Detalhes | Por quê | Exceção |
|---|---|---|---|
| Single-tenant | Este projeto é o próprio jogo (B2C), não uma ferramenta multi-cliente — ver ADR-002. **Não copiar o padrão multi-tenant/white-label dos outros projetos Kora aqui.** | Produto é B2C direto, não SaaS vendido a estabelecimentos | Só se o modelo de negócio mudar para B2B — exige novo ADR |
| Sem chat/marketplace no MVP | Funcionalidades futuras, fora do escopo inicial | Exigem verificação de idade mais forte e moderação antes de existir com segurança | Entram no roadmap só com plano de segurança específico escrito primeiro |

## Restrições Éticas

| Restrição | Detalhes | Revisão |
|---|---|---|
| Sem dark pattern de urgência | Teto de farm offline é claro e visível; nunca simular contagem regressiva artificial pra pressionar assinatura | Contínuo |
| Transparência de monetização | Jogador sempre vê claramente o que é grátis vs. pago, sem letra miúda | Contínuo |
| Sem dark pattern de cancelamento | Cancelar assinatura tem que ser tão fácil quanto assinar | Contínuo |

---

## Plano de Revisão

- **Próxima revisão legal/compliance**: 2026-11-10
- **Próxima revisão técnica**: 2026-11-10
- **Próxima revisão de custo**: 2026-11-10
- **Proprietário de cada seção**: Matheus Bonato

## Exceções Aprovadas (ADRs)

| Restrição | ADR | Data Exceção | Contexto |
|---|---|---|---|
| Multi-tenant (padrão Kora) | ADR-002 | 2026-08-10 | Autohunt Idle é deliberadamente single-tenant — ver ADR-002 para o raciocínio completo |

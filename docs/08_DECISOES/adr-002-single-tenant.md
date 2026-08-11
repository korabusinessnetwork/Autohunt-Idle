# ADR-002 — Single-tenant: desvio do padrão multi-tenant/white-label da Kora

**Status**: Aceito
**Data**: 2026-08-10
**Decisores**: Matheus Bonato
**Supersede**: —
**Supersedido por**: —

---

## Contexto

O padrão `fundacao-de-projeto` da Kora assume multi-tenant white-label desde a linha 1 por padrão (`tenant_id` em toda tabela, tema/marca/config vindo do tenant) — faz sentido para GASTROMUNDI e Kora AI, que são produtos B2B/B2B2C vendidos a múltiplos estabelecimentos/clientes. Autohunt Idle é diferente: é um jogo vendido diretamente ao jogador (B2C), não uma ferramenta licenciada a outras empresas.

## Decisão

Autohunt Idle é **single-tenant definitivo**. Não modelamos `tenant_id`, não construímos camada de white-label/theming por cliente. Isolamento de dados é por **jogador** (`player_id`/`user_id` + RLS), não por tenant. Planos (free/assinante) são por jogador, não por tenant.

## Alternativas Consideradas

### 1. Aplicar o padrão multi-tenant da Kora mesmo assim, por consistência entre projetos

- **Prós**: mesmo padrão mental em todos os projetos Kora, um dev que circula entre projetos não precisa "trocar de modelo"
- **Contras**: adiciona uma dimensão de modelagem (`tenant_id` em toda tabela, RLS por tenant *e* por jogador) sem nenhum caso de uso real — ninguém vai "ser dono de um tenant" dentro de Autohunt Idle
- **Descartado porque**: seria decisão implícita/arquitetura por hábito, exatamente o que o guia de ADR da própria skill pede pra evitar. Complexidade sem propósito é dívida técnica desde o dia 1

### 2. Modelar cada jogador como "tenant de um"

- **Prós**: tecnicamente reaproveitaria o mesmo código de RLS multi-tenant sem mudar nada
- **Contras**: semanticamente confuso (um "tenant" de verdade nesse contexto seria uma organização, não uma pessoa jogando), não resolve nenhum problema que isolamento por `player_id` já não resolve sozinho
- **Descartado porque**: complexidade artificial só pra reaproveitar um padrão que não encaixa

## Consequências

### Positivas

- Modelo de dados mais simples — um nível de isolamento a menos pra manter e testar
- Sem necessidade de lógica de white-label/theming por cliente
- Menos superfície de bug de vazamento entre tenants — porque não existem tenants

### Negativas / Trade-offs

- Se o modelo de negócio mudar no futuro (ex.: licenciar uma versão white-label do jogo pra um portal customizar com a própria marca), vai exigir retrofitting real de `tenant_id` e RLS — não é gratuito reverter essa decisão depois. Documentado aqui para não ser surpresa se isso um dia for cogitado
- Este projeto **não segue** a regra transversal nº5 de `references/arquiteturas.md` ("multi-tenant por padrão") — qualquer dev/agente novo no projeto precisa ler este ADR antes de assumir o padrão default da Kora

## Referências

- `references/multi-tenant-white-label.md` (skill `fundacao-de-projeto`) — padrão default que este ADR substitui para este projeto
- `memory/identity.md` — modelo de negócio B2C que motiva a decisão
- `memory/restrictions.md` — restrição de produto "single-tenant"

## Notas de Implementação

- Toda tabela usa `player_id`/`user_id` como chave de isolamento em RLS — nunca `tenant_id`
- `docs/02_DESIGN_SYSTEM/` não tem parametrização por tenant — tokens visuais são fixos
- `docs/04_MODELAGEM/` deve modelar o schema em torno de jogador, não de organização/estabelecimento

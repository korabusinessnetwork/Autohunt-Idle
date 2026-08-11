# 11 — SEGURANÇA · Autohunt Idle

> Plano de segurança versionado: ameaças, controles, compliance e resposta a incidentes.

**Nota**: esta é a pasta do PLANO — decisões, políticas e checklists. Código de segurança
(autenticação, validação, RLS) vive em `src/` e `supabase/migrations/`.

> ⚠️ Este projeto é single-tenant ([ADR-002](../08_DECISOES/adr-002-single-tenant.md)) — isolamento
> é por `player_id`/`user_id`, **nunca** por `tenant_id`.

## Princípio nº 1 desta pasta

**Prevenir o erro é melhor que reportar o erro. E prova é melhor que promessa.**

A primeira metade é a herança da fundação e continua valendo. A segunda foi acrescentada na
consolidação de 2026-08-11, e mudou a forma dos documentos: **nenhum controle é declarado
"garantido" sem o nome do teste que o garante.** Controle sem teste é intenção, e intenção
sobrevive a refatorações por acidente, não por desenho.

Na prática:

- Ameaça fechada cita o teste que reprova o build se a proteção sumir.
- Item de checklist é um comando que roda, ou um passo manual escrito por extenso.
- Onde não há proteção, o documento diz **ABERTA** e o que falta — em vez de omitir.

## Os documentos

| Documento | Para quê | Quando ler |
|---|---|---|
| [`modelo-de-ameacas.md`](modelo-de-ameacas.md) | 10 superfícies, cada ameaça com estado (FECHADA / MITIGADA / ABERTA) e a prova | Antes de mexer em RPC, GRANT, RLS ou economia |
| [`checklist-de-release.md`](checklist-de-release.md) | O que roda sozinho, o que é manual, o que só um Supabase real prova | Antes de publicar qualquer coisa |
| [`dados-pessoais-lgpd.md`](dados-pessoais-lgpd.md) | Inventário do dado pessoal e o desenho de exportar/excluir | Ao mexer em dado de conta |
| [`plano-mercado-p2p.md`](plano-mercado-p2p.md) | O plano específico que `memory/restrictions.md` exige antes de construir o mercado | Antes da primeira linha do mercado |
| [`termos-de-uso-rascunho.md`](termos-de-uso-rascunho.md) | Rascunho para um advogado revisar — **não é documento jurídico pronto** | Antes do lançamento público |

## Estado atual, em uma tela

| | |
|---|---|
| Ameaças mapeadas | **53**, em 10 superfícies |
| **FECHADAS** — com teste que reprova o build | **43** (7 fechadas nesta rodada) |
| **MITIGADAS** — protegidas, mas nada trava se alguém desfizer | **5** |
| **ABERTAS** | **4** |
| **ACEITA por proporcionalidade** | **1** — data de nascimento falsa; verificação por documento é paga e desproporcional ao risco deste produto |

As quatro abertas, em ordem de impacto. **Nenhuma depende de trabalho de código pendente** — todas
esperam decisão do dono ou serviço contratado:

1. **RLS não é exercitada por JWT real** (7.5) — o Postgres local reproduz `auth.uid()` a partir de
   uma variável de sessão, não de um JWT. A política pode estar sintaticamente certa e
   semanticamente errada sem ninguém notar. Só fecha num projeto Supabase; virou passo manual no
   checklist (§4).
2. **Calibragem do preço da fortificação** (4.7) — se o custo em ouro forçar a compra, o caminho
   gratuito vira fachada e a restrição de recompensa aleatória paga volta a valer *de fato*, com o
   código intacto (P6). Só dado de jogador real resolve.
3. **Webhook de gateway forjado** (3.4) — depende de P3.
4. **Replay do callback de anúncio** (2.3) — depende de P2.

Além delas, `modelo-de-ameacas.md` §10 registra quatro coisas que o modelo **não cobre**: abuso de
volume, disponibilidade (DDoS/WAF), segurança operacional das contas do dono, e o mercado P2P —
que tem documento próprio.

## O que mudou na consolidação de 2026-08-11

Este README era, até então, o plano inteiro: 97 linhas escritas na fundação, **antes de existir uma
migration sequer**. Hoje são 12 migrations e 40+ funções. A consolidação:

- **Reconciliou o modelo de ameaças com o código real** — RNG determinístico, GRANT por coluna,
  contrato de RPC sem parâmetro, `for update`, economia de duas moedas. Nada disso existia quando
  o plano foi escrito, e portanto nada disso estava protegido contra regressão.
- **Amarrou cada controle a um teste com nome.** O checklist deixou de ter itens de fé.
- **Fechou três lacunas que o próprio plano abria:**
  - LGPD saiu do papel: `exportar_meus_dados()` e `excluir_minha_conta()` existem, com teste.
  - `assinatura` deixou de ser `grant select` de tabela inteira — a regra do `CLAUDE.md` estava
    sendo violada pela tabela que a própria regra nomeia.
  - Passou a existir CI. "Secret scanning ativo" e "`npm audit` sem crítico" eram controles
    obrigatórios num repositório que não tinha `.github/`.
- **Escreveu o plano de mercado P2P**, destravando o que `memory/restrictions.md` bloqueava.

## Custo

Todos os controles ativos usam tier gratuito: RLS do Supabase, GitHub Actions, gitleaks,
`npm audit`, Postgres local. O gate de idade por data de nascimento é gratuito e proporcional ao
risco deste produto.

**O único item pago que este plano recomenda não adiar é a revisão jurídica**, dado o risco de
multa e suspensão pela ANPD — que fiscaliza tanto a LGPD quanto o ECA Digital. Monitoramento pago,
WAF e verificação de idade por documento seguem adiados por decisão de custo, registrada em
`memory/restrictions.md`.

**Nada nesta pasta é aconselhamento jurídico.**

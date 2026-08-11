# ADR-003 — Renderização em Canvas 2D, i18n próprio e Vitest

**Status**: Aceito
**Data**: 2026-08-11
**Decisores**: Matheus Bonato (via loop `/spec → /build → /review`)
**Supersede**: — (ajusta pontos em aberto de `docs/01_ARQUITETURA/tech-stack.md`)
**Supersedido por**: —

---

## Contexto

`docs/01_ARQUITETURA/tech-stack.md` deixou três pontos explicitamente em aberto para a
primeira sprint de build:

- **PixiJS** — "a confirmar na primeira sprint de build, é a peça mais nova do stack pra você"
- **TypeScript** — "não foi discutido explicitamente pra este projeto — confirmar ou trocar por JS puro"
- **i18next (ou equivalente)** — a decisão de lançar bilíngue estava tomada, a biblioteca não

E `respostas-intake.md` deixou `TEST_CMD` como *pendente*, embora `CLAUDE.md` já exija
"rodar `npm test` antes de commitar" e que funções puras nasçam com teste — uma regra que
não podia ser cumprida sem um runner definido.

Construir a Fase 1 exigia fechar os quatro pontos.

## Decisão

1. **TypeScript confirmado.** Sem desvio: é o padrão dos outros projetos Kora.
2. **Canvas 2D nativo em vez de PixiJS**, atrás de uma interface `Renderizador`
   (`src/game/renderizador.ts`).
3. **Módulo de i18n próprio e tipado** (`src/lib/i18n/`) em vez de i18next.
4. **Vitest** como runner (`npm test`), fechando o `TEST_CMD` pendente.

## Alternativas Consideradas

### PixiJS (a opção que o tech-stack sugeria)

- **Prós**: WebGL, batching, padrão de mercado para 2D; escala melhor com muito sprite em tela
- **Contras**: dependência nova e a peça menos dominada do stack; bundle relevante para um jogo
  que precisa carregar rápido em portal
- **Descartado porque**: o MVP desenha ~10 sprites de cor chapada, sem shader, sem partícula,
  sem tilemap grande. Não há gargalo para PixiJS resolver hoje. A interface `Renderizador` deixa
  a troca barata quando a Fase 3 trouxer dungeon, 8 biomas e efeito de raridade — aí a conta
  muda, e a decisão pode ser revista sem tocar em `motor.ts` nem em `mundo.ts`.

### i18next

- **Prós**: padrão de mercado, plural/contexto/namespace, ecossistema grande
- **Contras**: chave faltando é erro de *runtime* (cai no fallback ou mostra a chave crua)
- **Descartado porque**: o critério 13 do core diz que "nenhuma string nasce sem as duas
  versões". Com um dicionário tipado — `ChaveI18n = keyof typeof pt` e
  `en: Record<ChaveI18n, string>` — essa promessa vira **erro de compilação**: esquecer a versão
  em inglês quebra `npm run build`. É uma garantia mais forte que a da biblioteca, e sem
  dependência. O preço é não ter pluralização/contexto prontos; quando o jogo precisar disso,
  entra i18next e o `criarTradutor` continua sendo a interface que os componentes consomem.

### JS puro (em vez de TypeScript)

- **Descartado porque**: metade das garantias acima (dicionário tipado, contrato do snapshot,
  serviços com envelope) depende do sistema de tipos. Em JS puro elas viram convenção.

## Consequências

### Positivas

- Zero dependência nova além de React, Vite, Supabase e Vitest — bundle enxuto, que importa em
  portal web (`docs/01_ARQUITETURA/publicacao-portais.md`)
- Tradução faltando não chega em produção: quebra o build
- `TEST_CMD` deixa de ser pendência e a regra de teste do `CLAUDE.md` passa a ser executável

### Negativas / Trade-offs

- Canvas 2D vai encostar num teto de desempenho se a Fase 3 encher a tela de sprite e efeito.
  O sinal para revisar é queda de FPS com muitos elementos simultâneos — a interface
  `Renderizador` existe exatamente para esse dia
- O i18n próprio não tem plural, contexto nem interpolação de data/número. Hoje o jogo não usa
  nada disso (número passa por `Intl` em `src/utils/formato.ts`), mas é uma limitação real
- Vitest não cobre o SQL: as migrations são auditadas **estruturalmente**
  (`src/lib/contratoRpc.test.ts`), não executadas. Ver "Notas de Implementação"

## Referências

- `specs/build-fase-1-mvp.md` — decisões D1 a D4, com a tabela de origem de cada pendência
- `docs/01_ARQUITETURA/tech-stack.md` — atualizado por este ADR
- `specs/game-idle-farm-core.md` — critérios 13 e 14 (bilíngue desde o dia 1)

## Notas de Implementação

- A paleta continua tendo uma fonte só: o canvas lê os custom properties de
  `src/styles/tokens.css` em runtime (`src/game/paleta.ts`), então nenhum hex é repetido em
  TypeScript
- `src/lib/contratoRpc.test.ts` audita as migrations por leitura de arquivo: nenhuma RPC
  concedida a `authenticated` pode ter parâmetro, toda tabela precisa de RLS, e `tenant_id` não
  pode aparecer. **Isso não substitui rodar o SQL** — ver a pendência registrada em
  `docs/09_BACKLOG/README.md`

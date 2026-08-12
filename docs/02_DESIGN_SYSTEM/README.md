# 02 — DESIGN SYSTEM · Autohunt Idle

> Fonte única de verdade visual: tokens, cores, tipografia, componentes, animações.

## O que vive aqui

- **Design tokens**: escala de cores, tipografia, espaçamento, shadows, bordas
- **Paleta de cores**: cores base, semântica (sucesso/erro/aviso), acessibilidade
- **Tipografia**: fontes, escalas de tamanho, line-height, weights por contexto
- **Espacimentos**: grid, padding, margin, gap — a "régua" do layout
- **Iconografia**: conjunto único de ícones (SVG), convenção de nomes, tamanhos
- **Componentes**: catálogo de componentes visuais (atoms → molecules → organisms)
- **Animações**: transições, eases, durations — movimento consistente

## O que NÃO vive aqui

- Código dos componentes → `src/components/`
- Regras de negócio de UI → `03_REGRAS_DE_NEGOCIO/`
- Fluxos de interação → `05_FLUXOS/`
- Documentação de APIs → `07_APIS/`

## Arquivos sugeridos

- `TOKENS.md` — tabela estruturada: categoria, token name, valor, escopo
- `CORES.md` — paleta com hex/RGB, uso recomendado, contrast ratios
- `TIPOGRAFIA.md` — fontes, escalas (mobile/desktop), line-heights
- `ESPACAMENTOS.md` — grid, unidade base, escalas de spacing
- `ICONOGRAFIA.md` — conjunto de ícones SVG, nomeação, tamanhos
- `COMPONENTES.md` — atomic design: atoms, molecules, organisms
- `ANIMACOES.md` — transições, eases, durations, movimentos padrão

## Como preencher

1. **Crie uma paleta de cores primeiro**: escolha 3–5 cores base + variações (light/dark)
2. **Defina 1 única fonte para textos, 1 para display**: consistência visual
3. **Componentes nascem aqui, código em src/**: design first, depois implementa

> Autohunt Idle é single-tenant (ver ADR-002) — **sem** parametrização por tenant/white-label. Os tokens abaixo são fixos, não variáveis por cliente.

## Paleta — direção "doce endurecido" (vigente desde 2026-08-12)

Universo de doce, mas **em clima escuro** — não pastel claro. A direção mudou na
rodada 2 do brief (`brief-arte-correcao.md`), e a arte final foi entregue nesta
paleta; a interface a acompanhou quando os assets entraram. Cada hex abaixo foi
**amostrado dos PNGs entregues**, não escolhido a olho, e é o que garante que
canvas e interface sejam a mesma paleta em vez de duas parecidas.

| Token | Hex | Uso |
|---|---|---|
| `cor-primaria` | `#C93A6E` | Rosa escuro — cor principal, personagem/destaque |
| `cor-secundaria` | `#3FBFB0` | Verde-azulado — cenário, elementos secundários |
| `cor-recompensa` | `#E0A32E` | Âmbar — moeda, XP, recompensa |
| `cor-positivo` | `#6BA83F` | Verde musgo — ganho positivo ("rendeu enquanto você tava fora") |
| `cor-bloqueado` | `#C1453F` | Vermelho-tijolo — bloqueado, precisa assinar |
| `cor-fundo` | `#2E2733` | Ameixa escura — fundo/base |
| `cor-texto` | `#F0E6D8` | Creme — texto |
| `cor-contorno` | `#1A1620` | Contorno do pixel art, mais escuro que qualquer superfície |

Além das 8 da marca, `tokens.css` define **10 cores de raridade**
(`--raridade-comum` … `--raridade-cosmico`) e **24 de bioma**
(`--bioma-N-fundo|detalhe|assinatura`, também amostrados dos cenários).

> **A paleta anterior** era a "chiclete" pastel clara (`#FF5FA2`, `#FFF8ED`…) e
> está descrita em `brief-arte-claude-design.md`, que continua valendo como
> registro do pedido original. Ela **não é mais a paleta do produto**.

Direção de personagens/inimigos: criaturas tipo doce/geleia, silhuetas simples e redondas, cores chapadas — não fantasia medieval clássica (esqueleto/goblin/dragão). Detalhe completo no brief de arte.

### O que verifica que isto continua verdade

`src/styles/tokens.test.ts` reprova o build se: um token que o canvas lê não
existir no CSS, um `var(--…)` apontar para token inexistente, um hex solto
aparecer fora de `tokens.css`, ou a cor de tema do `index.html` divergir de
`--cor-fundo`.

## Ligações

- `06_COMPONENTES/` — implementação dos componentes em React
- `memory/identity.md` — identidade visual e posicionamento (seção "Identidade Visual")
- `brief-arte-claude-design.md` (nesta pasta) — prompt da rodada 1, enviado ao Claude Design
- `brief-arte-correcao.md` (nesta pasta) — prompt da rodada 2: escala 8, cenário de bioma, telas
- `inventario-de-arte.md` (nesta pasta) — o que a arte entregue cobre, o que descartamos e o que falta
- CLAUDE.md — regra de separar CSS do JSX

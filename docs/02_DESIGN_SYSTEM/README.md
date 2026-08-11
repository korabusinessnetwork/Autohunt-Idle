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

## Paleta — direção "chiclete" (ver `brief-arte-claude-design.md` nesta pasta para o prompt completo enviado ao Claude Design)

Fugindo deliberadamente da estética medieval-sombria do gênero de origem (RotMG) — candy/bubblegum, saturado, "4fun".

| Token | Hex | Uso |
|---|---|---|
| `cor-primaria` | `#FF5FA2` | Rosa chiclete — cor principal, personagem/destaque |
| `cor-secundaria` | `#3FE0D0` | Ciano — cenário, elementos secundários |
| `cor-recompensa` | `#FFC93C` | Amarelo-sol — moeda, XP, recompensa |
| `cor-positivo` | `#8CE05A` | Verde-limão — ganho positivo ("rendeu enquanto você tava fora") |
| `cor-bloqueado` | `#FF6B6B` | Coral — bloqueado, precisa assinar |
| `cor-fundo` | `#FFF8ED` | Creme claro — fundo/base (nunca escuro/dungeon) |
| `cor-texto` | `#4A2E3D` | Ameixa escura — texto e contornos, no lugar de preto puro |

Direção de personagens/inimigos: criaturas tipo doce/geleia, silhuetas simples e redondas, cores chapadas — não fantasia medieval clássica (esqueleto/goblin/dragão). Detalhe completo no brief de arte.

## Ligações

- `06_COMPONENTES/` — implementação dos componentes em React
- `memory/identity.md` — identidade visual e posicionamento (seção "Identidade Visual")
- `brief-arte-claude-design.md` (nesta pasta) — prompt completo usado para encomendar os assets ao Claude Design
- CLAUDE.md — regra de separar CSS do JSX

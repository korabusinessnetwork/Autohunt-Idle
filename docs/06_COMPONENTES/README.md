# 06 — COMPONENTES · Autohunt Idle

> A camada de UI: o que existe, como é organizada, e as três regras que valem para tudo.

## 1. As três regras

### 1.1 CSS separado do JSX, sempre

Cada componente tem um `.tsx` e um `.css` ao lado. **Nenhum estilo inline, nenhum CSS-in-JS**
(`CLAUDE.md`). Estilo desacoplado da marcação.

### 1.2 Nenhum hex fora de `tokens.css`

`src/styles/tokens.css` é a fonte única da paleta — 7 cores de marca, 24 de bioma, mais espaçamento
e raio. O canvas lê os mesmos custom properties em runtime (`src/game/paleta.ts`), então trocar uma
cor ali muda o jogo inteiro. Um teste varre `src/` e reprova hex solto.

### 1.3 Nenhuma string literal na tela

Todo texto vem de `t('chave')`. O dicionário é tipado (`Record<ChaveI18n, string>`), então **uma
chave sem tradução em inglês quebra o build** — o critério "nenhuma string nasce sem as duas
versões" virou erro de compilação em vez de promessa.

E há um teste de **chave órfã**: uma chave que existe no dicionário e não é usada em lugar nenhum
reprova. Já pegou UI faltando três vezes — a tela de equipar skin, a dungeon offline na tela de
retorno, e as pedras opcionais de fortificação.

## 2. Compartilhados — `src/components/shared/`

| Componente | Papel |
|---|---|
| `Botao` | variantes `primaria`, `recompensa`, `discreta`. Toda ação passa por aqui |
| `TelaCarregando` | o estado de carregando, com mensagem humana |
| `TelaErro` | título, mensagem sem culpa, botão de tentar de novo, código como detalhe |
| `TelaVazia` | título e mensagem próprios — nunca uma lista vazia sem explicação |

Os três estados de tela existem como componente porque o Princípio nº 1 exige **carregando, erro,
vazio e sucesso sempre visíveis com feedback humano**. Deixar isso a cargo de cada tela garantiria
que uma delas esqueceria.

## 3. A tela do jogo — `src/pages/Jogo.tsx`

```
<main>
  <header>  HUD: nível + barra de XP · vitalidade · ouro · diamante
  <div>     canvas do mundo (motor próprio, fora do React)
  <footer>  os botões que abrem os painéis
  <TelaRetorno>       aparece sozinha quando houve ausência
  {painel === …}      um painel por vez, sobre o mundo
```

O canvas tem `role="img"` e `aria-label` com o **nome do bioma corrente** — o mundo é decorativo
para leitor de tela, mas nomeado.

**O jogo é manual desde 2026-08-12** (`specs/mundo-aberto-e-modo-manual.md`). `src/game/entrada.ts`
traduz teclado, mouse e toque em **intenção** — nunca em movimento direto —, e o mundo decide o
resto. A separação é o que permite o modo auto preencher a mesma estrutura sem nenhum teclado
envolvido.

O HUD mostra o **estado do auto sempre visível**, nunca escondido atrás de menu: é o produto que se
vende, e quem não tem precisa saber que existe sem procurar.

## 4. Os painéis — `src/features/`

Um diretório por feature, com o componente, seu CSS, e a lógica pura que a feature precisa.

| Feature | Painel | O que resolve |
|---|---|---|
| `farm-offline` | `TelaRetorno` | **o momento mais importante do produto** — quanto rendeu enquanto você esteve fora |
| `desbloqueio` | `PainelDesbloqueio` | anúncio e assinatura. Título neutro, porque a Poki proíbe elemento de compra |
| `cadastro` | `ModalCadastro` | e-mail, senha e data de nascimento. O gate de 18+ |
| `atributos` | `PainelAtributos` | gastar os pontos ganhos por level up — 1 por nível, sempre à mão |
| `mochila` | `PainelMochila` | as peças, uma por uma e pelo nome, mais a dungeon |
| `mochila` | `PainelSintese` | as pilhas de 9, atrás de um botão da mochila |
| `mochila` | `PainelEquipamento` | 6 slots + skin, conjunto, e a fortificação |
| `loja` | `PainelLoja` | trocar diamante por ouro |
| `passe` | `PainelPasse` | a trilha inteira, com ou sem passe comprado |
| `ranking` | `TelaRanking` | o placar e a escolha de apelido |
| `configuracoes` | `PainelConfiguracoes` | idioma, e os dois direitos de LGPD |
| `console` | `ConsoleAjuste` | **a única tela que não é do jogador** — o dono edita os números do jogo |
| `console` | `LogOperacional` | a outra metade do console: quem mudou o quê, quando, e de quanto para quanto |

Todos são `role="dialog" aria-modal="true"` com `aria-labelledby` apontando para o próprio título.

**Um painel por vez.** O estado `painel` em `Jogo.tsx` é uma união de strings, não um booleano por
painel — assim dois nunca abrem juntos por descuido.

`ConsoleAjuste` é a exceção, e por um motivo estrutural: ele não é painel do jogo, é ferramenta de
operação. Vive na rota `/console`, montado por `App.tsx` **por cima** do jogo — que continua
rodando por baixo, para fechar o console voltar à sessão em vez de recarregá-la. Três coisas nele
não são layout, são regra:

- **a tela não protege nada.** Ela vai no bundle que todo jogador baixa, de propósito: esconder
  rota é segurança por obscuridade. Quem protege é o banco (`docs/11_SEGURANCA/` §12);
- **quem não é admin vê a tela recusar, com o motivo escrito.** Não some e não mente — e a recusa
  só aparece depois que o servidor disse quem é a pessoa, porque afirmar antes seria palpite
  apresentado como fato;
- **cada campo mostra faixa e descrição**, não só o número, senão o console vira um formulário de
  números mágicos.

São **duas abas numa rota só** — os números, e o log. O log publica na tela a lista de tipos que
mostra, porque recorte invisível engana mais do que log nenhum. E ele **não é pedido para quem não
é admin**: não por proteção (a RPC recusa de qualquer jeito), mas para carregar uma URL não virar
uma linha de recusa no banco. Chamada deliberada fica registrada; abrir a página, não.

## 5. Lógica de jogo fora dos componentes

`CLAUDE.md`: lógica de jogo isolada de componente de UI. Na prática:

- `src/game/` — motor, mundo, renderizador, sprites, biomas e os espelhos de regra. **Nada aqui
  importa React.**
- `src/features/*/regras.ts`, `idade.ts` — regra pura da feature, com teste próprio.
- `src/lib/services/` — as chamadas ao Supabase, cada uma devolvendo o envelope
  `{ data, error, meta }`.
- `src/hooks/useMotorDeJogo.ts` — a cola entre React e o motor, e só isso: criar, iniciar,
  redimensionar, parar.

O motor **não é componente React**: roda em `requestAnimationFrame` e escreve direto no canvas, sem
passar por estado nem re-render (ADR-001). Um loop de jogo re-renderizando a 60fps derrubaria a
aba.

## 6. Estado da sessão — `SessaoContext`

Um contexto só, com o snapshot do servidor e as ações. Os painéis leem dele e chamam
`atualizarSnapshot` com o que a RPC devolveu.

**O snapshot é sempre a verdade.** Nenhum painel calcula progressão localmente para exibir — se um
número aparece na tela, ele veio pronto do servidor. É o que garante que a UI e o banco nunca
divirjam.

## 7. Portal e responsividade

O jogo roda em iframe de portal (CrazyGames, Poki) ou em domínio próprio, escolhido por
`VITE_CANAL`. Duas consequências que moldam a UI:

- **o canvas se adapta a qualquer proporção**, com o mundo 16:9 centralizado e a moldura pintada na
  cor do bioma — `ResizeObserver` pega inclusive o redimensionamento causado por um painel abrindo;
- **o armazenamento cai para memória** quando `localStorage` lança exceção (janela anônima, iframe
  de outro domínio). A sessão vale enquanto a aba estiver aberta: pior que persistir, muito melhor
  que tela branca.

## 8. O que a UI deliberadamente NÃO tem

Cada ausência aqui é decisão registrada, não esquecimento:

| Não existe | Por quê |
|---|---|
| Tela de boas-vindas / tutorial | core, 17 — o jogo abre direto no mundo |
| Tela de morte | core, 16 — o herói pisca e continua |
| Botão de resgatar recompensa do passe | fila de prêmio não coletado é cobrança disfarçada |
| Contagem regressiva ou "última chance" | restrição contra dark pattern de urgência |
| Tela bloqueante ao ficar ocioso | encerrar por inatividade não é erro do jogador; o aviso fica no canto |
| Cadeado em degrau não alcançado | o tom da casa não cobra |
| Qualquer rota de vender item ou sacar saldo | não existe no servidor, e não vai existir |

## Ligações

- `docs/02_DESIGN_SYSTEM/` — paleta, tom e o brief de arte
- `docs/05_FLUXOS/` — o caminho que passa por estas telas
- `src/lib/i18n/` — o dicionário tipado

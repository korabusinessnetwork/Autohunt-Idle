# Brief de arte — jogo idle (prompt v4, com dungeon/passe/ranking)

*Copie o texto abaixo (a partir de "Contexto") e cole no Claude Design.*

---

## Contexto

Estou criando um jogo web idle. O personagem ataca sozinho enquanto anda pelo mapa (auto-attack), e o progresso continua mesmo com o jogo fechado. Público: jogador adulto (18+) casual de navegador (portais tipo Poki/CrazyGames). Nível de personagem é infinito (sem teto), com ranking global por nível.

## A técnica visual é pixel art — e por quê isso importa de verdade

**A técnica é pixel art**, no espírito de Realm of the Mad God — grade de pixel visível, bordas endentadas (nunca suavizadas/anti-aliased), sem gradiente, contagem de cor limitada por sprite. Não é preferência estética solta — resolve três problemas reais:

1. **Legibilidade em miniatura**: personagem e inimigos aparecem pequenos no mapa a maior parte do tempo. Baixa resolução força design guiado por silhueta — sem depender de sombreado fino, a forma comunica tudo sozinha.
2. **Sinal de gênero**: pixel art comunica instantaneamente "RPG de ação com loot" pra quem já joga esse tipo de jogo.
3. **Produção em escala**: com sistema de skin, raridade de loot, dungeon e passe, vamos precisar de MUITOS assets. Pixel art em grade fixa é mais rápido de produzir em quantidade de forma consistente do que ilustração vetorial detalhada.

## Direção de personagem (mantida — já validada, não mude o conceito)

Humor pastelão/debochado, não fofura piegas — criaturas tipo doce/sobremesa com atitude e expressão de deboche (referência: The Battle Cats). Mantenha os conceitos já validados como ponto de partida — Casquinha (capanga básico, triângulo, sorriso de bobo), Minhoca Azeda ("S" alto e fino, cara de tédio profundo), Rosquinha Brutamontes (tanque, anel largo, monóculo bravo), Pirulito Valentão (bola-no-palito, pose de metido), Pudim Conformado (trapézio baixo, derretendo sem pressa nenhuma). A mudança é só técnica de renderização (pixel art), não conceito.

## Sistema de skin

Personagem principal precisa de base modular: silhueta consistente o bastante pra aceitar recolor + troca de acessório (tipo a antena de estrela do "Bico") como camada separada, sem redesenhar do zero a cada skin nova.

## Sistema de raridade — comum a lendário

Linguagem visual já consagrada em jogos de loot: tier de raridade com cor própria.

- Comum — contorno cinza/branco
- Incomum — contorno verde (`#8CE05A`, já da paleta principal)
- Raro — contorno ciano (`#3FE0D0`, já da paleta principal)
- Épico — contorno roxo (cor nova fora da paleta principal — sugira o tom)
- **Lendário** — contorno dourado/laranja com brilho/partícula — precisa parecer excepcional só de olhar o ícone

## Sistema de dungeon (novo)

Área instanciada separada do mundo aberto, destravada por uma chave (item que dropa no mundo aberto). Mesma técnica pixel art, mas o tom pode escalar um pouco em intensidade (ainda chiclete, mas "a versão mais desafiadora" — pense em uma entrada/portal de dungeon que sinalize visualmente "aqui é mais puxado" sem sair do universo doce/colorido.

## Sistema de passe (novo)

Existe uma skin **exclusiva de quem tem o passe** — precisa ser visualmente reconhecível como especial/exclusiva à primeira vista (não é só mais uma skin comum, é a mais cobiçada), mas continua na mesma técnica pixel art e no mesmo universo visual chiclete — não vire outra estética à parte.

## Paleta principal

- `#FF5FA2` — rosa chiclete
- `#3FE0D0` — ciano
- `#FFC93C` — amarelo-sol (moeda, XP)
- `#8CE05A` — verde-limão (ganho positivo)
- `#FF6B6B` — coral (bloqueado)
- `#FFF8ED` — creme claro (fundo)
- `#4A2E3D` — ameixa escura (texto/contorno)

## Peças que preciso que você desenhe

1. **Personagem principal em pixel art** — base modular, 2-3 poses (parado, atacando, comemorando)
2. **2-3 skins alternativas** do personagem, incluindo a **skin exclusiva de passe** (precisa se destacar das outras)
3. **Os 5 inimigos já conceituados, em pixel art** — mesma silhueta/personalidade
4. **Set de ícones de loot por raridade** — comum até lendário, mostrando a escalada visual
5. **Ícone da chave de dungeon** — item reconhecível, coerente com o resto dos ícones de item
6. **Tela "bem-vindo de volta"** — número subindo, "coletar tudo", em pixel art
7. **Um tile de cenário/fundo do mundo aberto** — parque de doce, colorido
8. **Entrada/portal de dungeon** — sinaliza "mais desafiador" sem sair do universo visual

## Restrições técnicas

- Grade de pixel fixa e consistente em todos os assets (definir resolução base, ex. 32x32 ou 24x24, manter em tudo)
- Sem anti-aliasing, sem gradiente, sem sombra suave — só cor sólida
- Contorno consistente (mesma espessura em pixels) em todos os sprites
- Cada rarity tier precisa ser reconhecível só pela cor do contorno, mesmo em ícone pequeno

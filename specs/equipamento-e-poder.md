# Spec: Equipamento, Raridade Mecânica e "Habilidade"

*(estende `specs/dungeons-loot-skins.md` — dá corpo mecânico à raridade já definida lá)*

## 1. Escopo

Tipos de item (arma, acessório, skin, chave — skin e chave já especificados anteriormente), como raridade afeta poder real (arma/acessório), e como "habilidade especial" funciona — amarrada à arma equipada, auto-disparada, sem input manual. Decide explicitamente **contra** sistema de classes formal.

## 2. Fora de escopo

- Classes formais de personagem (escolha inicial que trava build) — decisão deliberada, ver "Nota de design"
- Habilidade como sistema/slot separado — fica amarrada à arma, não é uma quinta categoria de item
- Balanceamento numérico exato de stat por raridade — fase de build, não desta spec
- Mais de 4 tipos de item (ex.: anel, armadura separada) — escopo mínimo por design, ver nota

## 3. Arquivos afetados

- `specs/dungeons-loot-skins.md` — referenciado, **não alterado**: skin continua puramente cosmética, sem stat, em qualquer raridade
- `supabase/migrations/` — tabela de itens com `tipo` (arma | acessório | skin | chave), `raridade`, `stats` (nulo quando não aplicável), `tipo_dano` (físico | mágico, nulo em skin/chave), `conjunto_id` (nulo se o item não pertence a conjunto); jogador agora tem 3 slots de equipamento (1 arma + 2 acessórios) em vez de 2
- `src/lib/services/` — lógica de "efeito especial da arma equipada" entra no cálculo de combate (mesma RPC/resolução por stat-tick já usada em tudo)

## 4. Critérios de aceite

1. **Não existe seleção de classe** no início do jogo — personagem começa universal, sem build travada por escolha inicial
2. Todo item tem exatamente um de 4 tipos: **arma**, **acessório**, **skin**, **chave de dungeon**
3. **(Amendado)** Personagem tem **3 slots de equipamento**: 1 arma + **2 acessórios** (antes era só 1 acessório) — abre espaço pra sistema de conjunto (ver critérios 15-18)
4. Arma e acessório têm stat que escala com raridade (comum = baixo, lendário = alto)
5. Skin **nunca** tem stat, em nenhuma raridade — reafirma `specs/dungeons-loot-skins.md` critério 8
6. Arma equipada determina o efeito especial auto-disparado em combate — **não existe botão/input de habilidade**
7. Trocar de arma muda o efeito especial junto, automaticamente — build emerge do loot encontrado, não de escolha upfront
8. Personagem sempre começa com uma arma inicial (tier comum, gratuita) — nunca fica sem nada equipado
9. **(Amendado)** Arma carrega um **tipo de dano**: físico ou mágico, pra começar (extensível depois) — ex.: varinha solta dano mágico
10. **(Amendado)** Acessório pode ter **afinidade** com um tipo de dano — quando a afinidade do acessório bate com o tipo de dano da arma equipada, aplica um bônus (build sinérgico emerge do loadout, não de escolha de classe)
11. **(Amendado)** "Classe" nunca é uma escolha travada — é a identidade que emerge de qual arma+acessório o jogador tem equipado no momento, mudando livremente conforme o loot muda
12. **(Cross-ref)** Força e Inteligência (atributos ganhos por level up, `specs/ranking-global.md`) escalam dano físico e mágico respectivamente, além do que a arma/acessório já dão sozinhos
13. Arma exibe seu tipo de dano de forma visível pro jogador; acessório exibe sua afinidade (se tiver); bônus de sinergia (arma+acessório do mesmo tipo) é mensurável e testável manualmente comparando dano com e sem afinidade batendo
14. **(Amendado)** Alguns itens (raridade épico ou superior) pertencem a um **conjunto** nomeado (ex.: "Conjunto da Bruxa Caramelo") — inspirado no sistema de sets do Diablo 3
15. **(Amendado)** Vestir **2 peças do mesmo conjunto** (de qualquer combinação entre arma e os 2 acessórios) desbloqueia o **bônus de 2 peças** — efeito adicional, nunca substitui o stat normal do item
16. **(Amendado)** Vestir as **3 peças do mesmo conjunto** (arma + os 2 acessórios) desbloqueia o **bônus de conjunto completo** — mais forte que a soma dos bônus individuais, pode incluir efeito novo, não só multiplicador de stat
17. **(Amendado)** Bônus de conjunto tem tema coerente com o tipo de dano do conjunto (ex.: conjunto mágico reforça sinergia com Inteligência) — não é bônus genérico solto

## 5. Edge cases conhecidos

- Duas armas do mesmo tipo com raridades diferentes — troca livre, sem penalidade nem cooldown de troca
- Acessório vazio (algum dos 2 slots não preenchido ainda) — funciona normalmente, só sem o bônus daquele slot
- Efeito especial de arma rara/épica/lendária precisa ser **visualmente perceptível** na tela de retorno ou no combate — não pode ser uma diferença que só existe em número invisível
- Jogador tem 2 peças de um conjunto e 1 peça de outro — só o bônus de 2 peças do primeiro conjunto ativa, nada do segundo (não empilha bônus parcial entre conjuntos diferentes)
- Trocar 1 peça do conjunto por item avulso mais forte em stat bruto, mas perder o bônus de conjunto — é escolha do jogador, o jogo não deve travar isso, só deixar visível o que se perde

## Nota de design — por que sem classes formais

RotMG original tem várias classes, cada uma travando arma/habilidade/playstyle desde a criação do personagem. Não segui esse caminho aqui, por dois motivos que já estão documentados em outro lugar:

1. O jogo inteiro foi construído em cima de **um personagem** com skin puramente estética (`specs/dungeons-loot-skins.md`) — a arte já encomendada (`docs/02_DESIGN_SYSTEM/brief-arte-claude-design.md`) assume um personagem-base só, com skins como camada.
2. Escolher classe é decisão de build que exige entender o jogo **antes** de jogar — contradiz o Princípio nº1 já registrado em `CLAUDE.md` ("zero esforço, sem tutorial obrigatório").

A variedade vem do **loot**, não da escolha inicial: a arma que você encontra determina seu estilo de ataque e efeito especial, sem exigir decisão consciente pra começar a jogar. A adição de tipo de dano (físico/mágico), afinidade de acessório e conjunto reforça isso, não contradiz — "build de mago" existe como identidade emergente (varinha mágica + acessórios de conjunto mágico), nunca como opção escolhida numa tela de criação de personagem. Reverter pra classes formais é uma mudança estrutural grande — atinge personagem principal, onboarding e a arte já encomendada. Dá pra fazer, mas não é um ajuste pequeno.

## 6. Definição de "aprovado sem ressalvas"

Os 17 critérios de aceite verificados; teste manual confirma que trocar de arma muda o efeito especial automaticamente sem nenhum input extra do jogador; teste manual confirma que nenhuma skin, em nenhum caso, altera dano ou hitbox; teste manual confirma bônus de 2 peças e de conjunto completo (3 peças) aplicando corretamente e desaparecendo ao trocar uma peça pra fora do conjunto.

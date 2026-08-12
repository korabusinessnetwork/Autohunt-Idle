# Brief de correção — Autohunt Idle (rodada 2)

*Copie o texto abaixo (a partir de "Contexto") e cole no Claude Design.*

---

## Contexto

Você já entregou 9 levas de arte pro jogo **Autohunt Idle** (idle game web, pixel art, tema de doces com clima escuro, público adulto). O personagem principal, as skins, os itens e o resto do pacote ficaram muito bons — **não precisa refazer nada disso**.

Esta rodada é só pra fechar três pendências específicas. Trabalhe **uma de cada vez**, na ordem abaixo, parando pra aprovação entre elas.

---

## Pendência 1 (PRIORITÁRIA) — Leva 3 não foi entregue: as telas

A Leva 3 pedia **telas de interface**, mas vieram só ícones soltos (slots, ícones de equipamento, mini-char — que ficaram bons e continuam úteis). As telas em si não foram feitas. Preciso delas:

### 1a. Tela "Bem-vindo de volta" — a tela mais importante do jogo

É o momento central do produto: o jogador fecha o jogo, o personagem continua farmando, e quando ele volta essa tela mostra o que rendeu. Precisa de **dois estados**:

**Estado A — jogador assinante (ganhou tudo)**
- Número grande e destacado de moedas ganhas enquanto esteve fora
- Linha secundária de XP ganho
- Contagem de itens coletados, com ícones de loot "chovendo"/aparecendo
- Botão principal "COLETAR TUDO"
- Sensação de recompensa e comemoração

**Estado B — jogador SEM assinatura (perdeu progresso)**
- Mesma estrutura, mas mostrando o que ele **deixou de ganhar** — usando vermelho-tijolo `#C1453F`
- Um botão/convite pra assinar ou assistir anúncio pra recuperar parte
- **Importante**: o tom não pode ser punitivo nem culpar o jogador. É um convite, não uma bronca. Nada de cara triste, nada de "você perdeu!" agressivo — mostra o valor de forma tentadora, tipo "isso estava esperando por você"

### 1b. Tela de inventário
Grade de slots (você já fez os ícones de slot), mostrando itens equipados nos slots corretos + itens guardados. Precisa deixar visível o **contorno de raridade** de cada item (o sistema de 10 tiers que você já criou).

### 1c. Tela de mercado
Lista de itens que outros jogadores colocaram à venda, cada linha mostrando: ícone do item (com contorno de raridade), nome, e o preço em diamante. Precisa de um botão de "listar meu item".

---

## Pendência 2 — Grade de pixel inconsistente entre as levas

O brief original pedia grade de pixel fixa em todos os assets. Medindo o que foi entregue, cada leva usou uma escala diferente:

- Personagem e inimigos: escala 8
- Tiles de bioma: escala 4
- Itens (armas/acessórios): escala 3

Na prática isso quebra a coerência: um item ao lado do personagem tem "pixel" de tamanho diferente, e a ilusão de pixel art consistente se perde quando tudo aparece junto na mesma tela.

**Padronize tudo na mesma escala** (sugiro escala 8, que é a do personagem e dos inimigos — as peças mais importantes e que já ficaram boas). Os assets já entregues de item e tile precisam ser reexportados nessa grade, não redesenhados do zero.

---

## Pendência 3 — Tiles de bioma estão como textura, não cenário

Os 8 tiles ficaram como padrões repetitivos que se diferenciam basicamente pela cor. Nenhum tem elemento de mundo — o "Céu de Confete Cósmico" e a "Floresta de Algodão-Doce" têm a mesma estrutura visual, só matiz diferente.

Cada bioma precisa de **elemento de cenário reconhecível**, não só cor: formação, vegetação, estrutura, obstáculo — algo que faça o jogador saber onde está mesmo em preto e branco.

1. **Floresta de Algodão-Doce** (níveis 1–125) — árvores de algodão-doce, névoa suja entre elas
2. **Vale das Geleias** (126–250) — poças/formações de gelatina, superfície instável
3. **Deserto de Açúcar Queimado** (251–375) — dunas de açúcar, formações de caramelo endurecido
4. **Recife de Pirulito** (376–500) — formações tipo coral feitas de pirulito, ambiente aquático
5. **Montanhas de Chocolate** (501–625) — rocha de chocolate, cavernas, tom denso
6. **Geleira de Menta** (626–750) — gelo de menta, estalactites, tom frio
7. **Vulcão de Goma** (751–875) — rocha derretida de goma, fissuras brilhantes, perigo visível
8. **Céu de Confete Cósmico** (876–1000) — plataformas flutuantes, vazio estrelado, endgame

Mantenha o clima escuro/endurecido que já está funcionando no resto do pacote — não volte pro pastel claro.

---

## Pendência 4 (rápida) — Bug no wordmark

No `wordmark.png`, a espada está cobrindo o "T" de AUTOHUNT — o logo lê "AU OHUNT". Reposicione a espada (ou o texto) pra que todas as letras fiquem legíveis, principalmente nas versões de ícone pequeno (16px, 32px).

---

## Restrições (valem pra tudo)

- Pixel art de verdade: grade visível, sem anti-aliasing, sem gradiente, sem sombra suave
- Paleta endurecida já em uso: `#C93A6E` rosa escuro, `#2A9D8F` verde-azulado, `#E0A32E` âmbar, `#6BA83F` verde musgo, `#C1453F` vermelho-tijolo, `#2E2733` fundo escuro, `#F0E6D8` creme (texto), `#1A1620` contorno
- Nas telas: evite texto embutido fixo — o jogo é bilíngue (português e inglês), então texto precisa ser camada separada/substituível. Use placeholder onde for necessário mostrar texto

# Spec de execução: fortificação de item

*(spec de **build**. Traduz `specs/fortificacao-de-item.md`, já decidida, em algo implementável.)*

- **Spec de origem:** `specs/fortificacao-de-item.md` (13 critérios)
- **Depende de:** rodada 3c/3d (equipamento com stat e slots por parte do corpo)
- **Rodada do loop:** 6ª

## 1. Escopo

Fortificar equipamento de `+0` até um teto, com **chance de sucesso decrescente**, gastando
**ouro** e **pedras que caem jogando**. Falhar consome o material e **não mexe no item**.

## 2. Fora de escopo — e por quê

- **Loja de ouro por diamante** (critério 2 da spec de origem). Ela depende de diamante existir,
  que depende de gateway contratado — pendência P3 do backlog, sem previsão. Construir a loja
  agora seria construir contra uma moeda que não existe.
  **Consequência boa:** nesta rodada a fortificação é 100% gratuita, alimentada só por farm. O
  caminho pago entra depois, e a condição 2 de compliance (ouro precisa ser genuinamente
  ganhável) nasce satisfeita por construção.
- **Fortificar skin** — skin não tem stat, então fortificá-la não teria efeito. Recusada.

## 3. Decisões de execução

| # | Assunto | Decisão |
|---|---|---|
| D1 | **Teto** | `+15`. A chance chega ao piso de 5% por volta de `+12`, então os últimos degraus são troféu de longo prazo, não progressão esperada. |
| D2 | **Bônus** | **Percentual sobre o stat do item** (`+8%` por nível), não valor fixo. Assim fortificar um item cósmico vale mais que fortificar um comum — que é o incentivo certo. |
| D3 | **Pedras** | Três tipos, todos **itens de inventário que caem jogando**: `pedra_fortificacao` (material da tentativa), `pedra_sorte` (+15 pontos percentuais na chance) e `pedra_garantia` (torna a tentativa certa). Nenhuma é vendida — nem por diamante, nem por ouro. |
| D4 | **Sorteio** | Determinístico e semeado por `(player_id, contador_sorteio)`, como todo o resto do loot. |

## 4. Critérios de aceite

1. Todo item equipável tem um nível de fortificação, de `+0` a `+15`.
2. Fortificar custa **ouro** e **1 pedra de fortificação**, consumidos com ou sem sucesso.
3. **Nenhuma rota vende pedra** — por diamante, por ouro ou por qualquer coisa.
4. A **chance de sucesso cai** a cada nível, com piso de 5%.
5. A **Pedra da Sorte** é opcional e aumenta a chance daquela tentativa; consumida junto.
6. A **Pedra de Garantia** torna a tentativa certa; consumida junto.
7. **Falhar não rebaixa nem destrói o item** — o nível de fortificação nunca cai. Verificação:
   nenhum caminho no SQL decrementa `fortificacao`.
8. O nível de fortificação **soma ao poder do item**, e portanto ao poder de ataque.
9. **Skin não pode ser fortificada** — recusada pelo servidor com motivo claro.
10. O servidor recusa a tentativa quando falta ouro, falta pedra ou o item já está no teto — sem
    consumir nada.
11. A UI mostra **a chance em número e o custo exato em ouro antes** da tentativa (restrição
    ética de transparência).
12. O sorteio é do servidor; o client nunca informa resultado, custo nem material gasto além do
    que escolheu usar.
13. `npm test` e `npm run build` verdes; a chance, o custo e o bônus nascem com teste.

## 5. Edge cases

- **Item no teto** — botão desabilitado, e o servidor recusa de qualquer forma.
- **Sorte e Garantia juntas** — permitido; a Garantia manda, e a Sorte é consumida à toa. A UI
  não deve oferecer as duas ao mesmo tempo.
- **Item fortificado consumido numa síntese** — a fortificação vai junto, é do item.
- **Ouro insuficiente** — recusa antes de consumir pedra.

## 6. Definição de "aprovado sem ressalvas"

Os 13 critérios verificados; e as três provas centrais por teste: **falhar deixa o item
exatamente como estava**, **a chance nunca sobe com o nível** e **nenhuma rota vende pedra**.

# 03 — REGRAS DE NEGÓCIO · Autohunt Idle

> Os números que decidem o jogo, onde cada um mora, e qual lado prevalece quando dois lugares
> discordam.

## 1. A regra sobre as regras

**Toda regra que decide valor mora no Postgres.** O que existe em `src/game/regras*.ts` é
**espelho**, não fonte: serve para a UI antecipar um número na tela e para os testes puros
exercitarem a matemática sem subir banco.

Quando os dois discordam, **o servidor está certo por definição** — ele é quem credita. Um espelho
divergente é bug do espelho.

E o corolário que sustenta o produto inteiro: **o client nunca declara tempo nem recompensa**
(core, critério 3). As RPCs que creditam valor têm zero parâmetro.

## 2. Ciclo e farm

| Regra | Valor de partida | Onde | Editável? |
|---|---|---|---|
| Duração do ciclo | **15 s** | `c_ciclo_segundos` / `CICLO_SEGUNDOS` | não — é a unidade de contabilidade do `last_seen_at` |
| Abates por ciclo | **3** | `ajuste.abates_base` / `ABATES_BASE` | **sim**, 1 a 30 |
| XP por abate | **4** | `ajuste.xp_por_abate_base` | **sim**, 1 a 500 |
| Moeda por abate | **2** | `ajuste.moeda_por_abate_base` | **sim**, 0 a 500 |
| Dano recebido por ciclo | **8** | `ajuste.dano_por_ciclo_base` | **sim**, 0 a 500 |
| Ataque ganho por abate | **8** | `ajuste.ataque_por_abate` | **sim**, 1 a 200 |
| Boost global de XP / de ouro | **1×** | `ajuste.xp_multiplicador_global`, `…moeda…` | **sim**, 0,1 a 10 |
| Teto de um lote | **120 s** | `c_limite_lote_segundos` | não — é trava de segurança |

**Desde 2026-08-12 estes números não moram mais no código.** Vivem na tabela `ajuste`, editáveis
pelo dono no console (`specs/console-de-ajuste.md`), cada um com faixa própria. A coluna "valor de
partida" é o que foi semeado — e também o padrão embutido, usado se a linha sumir. Mudança vale
**do próximo lote em diante**: nada é recalculado para trás, porque o crédito já aconteceu.

Nada disso afrouxou a regra da seção 1: os números econômicos são lidos **dentro** do servidor,
por `resolver_ciclos`, e não viajam para o client. Só os visuais (velocidade do herói, alcance do
tiro, densidade de spawn) vão no snapshot — e nenhum deles credita nada.

O lote de 120 s é uma trava de segurança, não de balanceamento: mesmo que o motor do client demore
a pedir validação, o servidor nunca credita mais que isso de uma vez.

**O tempo vem sempre do `now()` do Postgres.** Adiantar o relógio da máquina não muda nada na tela.

## 3. Nível e atributos

- **Curva de XP:** `50·(n−1)·n` acumulado até o nível `n`. Sem teto — o nível é infinito
  (`specs/ranking-global.md`), e `nivel_por_xp` devolve `bigint`.
- **Pontos por nível:** 3.
- **Custo de atributo:** 1 ponto por nível até +10; a partir daí sobe. `custo_acumulado_atributo` é
  forma fechada, e o teste de fumaça confere contra o somatório real **nível a nível até 250** —
  forma fechada que diverge do somatório é exatamente o erro que só executando aparece.
- **Vitalidade:** 25 de vida por ponto.
- **Auto-alocação:** ligada por padrão, desliga no primeiro respec manual, e `reativar_auto_alocacao()`
  devolve. Sem esse desligamento a auto-alocação desfazia a escolha do jogador no lote seguinte.

## 4. Loot e raridade

- **10 tiers:** comum, incomum, raro, épico, lendário, caramelizado, glaceado, dourado,
  cristalizado, cósmico.
- **Chance de subir um degrau:** 18%, mais Sorte, com teto de +12 pontos percentuais.
  - No SQL: `sorte / 4000`. No TS: `sorte / (SORTE_POR_PONTO × 100)`, com `SORTE_POR_PONTO = 40`.
    **São o mesmo número** — o nome em TS é "quanta Sorte vale um ponto percentual". Vale registrar
    porque a diferença de nome já parece divergência à primeira vista, e não é.
- **Piso é garantia, não sorteio.** Boss de dungeon garante piso raro; o sorteio só sobe a partir
  dele.
- **Síntese:** 9 itens iguais viram 1 do tier acima, com **8%** de chance de pular um tier. Não
  custa nada além dos próprios itens.
- **Chave de dungeon:** cai a `0,15%` por ciclo. Mini boss a cada ~240 ciclos (~1 h de jogo).

**O sorteio é determinístico e temperado.** A semente é `segredo || player_id || marcador ||
contador`, e o segredo vive numa tabela que ninguém alcança. Determinismo sem segredo não protege
nada — foi o furo de `docs/07_APIS/` §6.

## 5. Equipamento

- **6 slots de poder** (arma, capacete, armadura, luva, bota, acessório) mais **skin**, que é
  puramente cosmética. A função que decide recompensa não sabe o que é skin, e um teste prova.
- **Sinergia de afinidade:** +20% quando a afinidade do item casa com o tipo de dano da arma.
- **Conjunto:** 2 peças → +8%, 4 peças → +20%, 6 peças → +45%. Só o conjunto **mais representado**
  conta — bônus parcial não empilha entre conjuntos diferentes.
- **Trocar é livre**: sem custo, sem cooldown, sem confirmação.
- O personagem **nunca fica sem arma**: `garantir_arma_inicial` é idempotente e roda a cada
  crédito e depois de cada síntese.

## 6. Fortificação

- **+0 a +15.** Chance inicial **95%**, caindo 7,5 pontos por nível, com piso de **5%**.
- **Bônus:** +8% de poder por nível de fortificação.
- **Custa ouro**, e consome uma Pedra de Fortificação.
- **Pedra da Sorte:** +15 pontos percentuais. **Pedra de Garantia:** sucesso certo.
- **Falhar só gasta.** Nunca rebaixa o item, nunca destrói. Não existe caminho no schema que
  reduza `fortificacao` — e é teste, não promessa.

O preço em ouro é **condição de compliance, não só de diversão** (P6): se for calibrado para
forçar a compra de ouro, o caminho gratuito vira fachada.

## 7. Economia

| | |
|---|---|
| **Ouro** | cai jogando; paga fortificação |
| **Diamante** | cai derrotando boss de dungeon (**2** por vitória); quando houver gateway, também comprado |
| **Loja de ouro** | 10💎 → 5.000 · 50💎 → 30.000 · 200💎 → 150.000. Quantidade **fixa e publicada** |

Três regras inegociáveis, todas verificadas por teste:

1. **Diamante nunca vira dinheiro de volta**, por rota nenhuma. É o que permite vendê-lo como moeda
   de jogo em vez de disparar a análise de transmissão de valor entre pessoas.
2. **O único débito de diamante do schema é a compra de ouro** — e ela entrega ouro, não dinheiro.
3. **A quantidade é fixa.** Nenhum sorteio no caminho da compra — é o que a separa de uma loot box.

## 8. Os dois produtos de tempo

Desde `specs/mundo-aberto-e-modo-manual.md` o jogo é **manual**, e o auto virou o que se vende. São
**dois produtos separados**, cada um com seu saldo — gastar um não consome o outro.

| Produto | O que é | Grátis | Assinante |
|---|---|---|---|
| **Auto na tela** | o personagem joga sozinho com a aba aberta | até **2 h/dia** por anúncio, 15 min cada | ilimitado |
| **Farm offline** | rende com a aba fechada | até **2 h/dia** por anúncio, 15 min cada | **24 h** por ausência |

Assinante também tem **2× XP** em toda atividade. Cancelar **não** corta o benefício: o período
pago segue até vencer.

**Manual e auto rendem exatamente o mesmo.** A habilidade do jogador não muda número nenhum — o
servidor credita por tempo × poder e não sabe quem estava no comando. É o que manteve a
arquitetura de segurança intacta quando a premissa inverteu.

**Sem auto destravado, ficar parado não rende:** 2 minutos sem input encerram a sessão, pela mesma
rota do fechar-aba.

## 9. Passe de recompensas

Produto **independente** da assinatura. 12 tiers, de 100 a 10.000 pontos, 1 ponto por ciclo.

- Pontos **só acumulam com o passe ativo**; cancelar congela, reativar retoma de onde parou.
- **Nada expira.** A trilha não tem prazo, e recompensa destravada é do jogador para sempre.
- **Nada sorteia.** A recompensa de cada tier está escrita na tabela e publicada antes da compra.
- **Concessão automática** ao cruzar o tier — sem botão de resgatar.

## 10. Regras que são restrição, não balanceamento

Estas não se ajustam com dado de jogador. Mudá-las exige decisão explícita do dono, e algumas nem
isso:

| Regra | Natureza |
|---|---|
| **Nunca recompensa aleatória paga (loot box)** | restrição **CRÍTICA permanente** |
| **Diamante nunca vira dinheiro** | idem |
| **18+ com data de nascimento real** | exigência legal (ECA Digital, Lei 15.211/2025) |
| **Sem dark pattern de urgência** | restrição ética registrada |
| **Cancelar é tão fácil quanto assinar** | idem |
| **Progresso nunca é punido** | princípio de produto — já custou o permadeath ao projeto |

## 11. O que ainda é chute fundamentado

Registrado em D4 do backlog, e vale repetir aqui: **quase todo número desta página foi escolhido
para o sistema ficar observável e testável, não para ser divertido.** Ciclo de 15 s, curva de XP,
derrota a cada ~11 ciclos, curva do passe, preço da fortificação. Balancear com dado de jogador
real é trabalho da Fase 2 — e dois deles (P6 e a curva do passe) são condição de compliance, não
só de diversão.

## Ligações

- `src/game/regras*.ts` — os espelhos puros, com teste
- `supabase/migrations/` — a fonte
- `specs/` — de onde cada regra veio
- `docs/11_SEGURANCA/modelo-de-ameacas.md` — as que viraram invariante de segurança

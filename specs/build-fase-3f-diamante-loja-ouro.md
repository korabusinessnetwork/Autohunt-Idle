# Spec de execução: diamante e loja de ouro

*(spec de **build**. Cobre a metade de `specs/mercado-diamante.md` que não está bloqueada.)*

- **Spec de origem:** `specs/mercado-diamante.md` (critérios 1 a 4)
- **Fecha:** `specs/fortificacao-de-item.md`, critério 2 — a loja de ouro que faltava
- **Rodada do loop:** 7ª

## 1. Escopo

Moeda premium **diamante**, ganha jogando (dungeon) e — quando houver gateway — comprada do
operador. E a **loja de ouro**: troca diamante por ouro em quantidade fixa e publicada, que é a
peça que faltava para a fortificação ter o caminho pago descrito na spec dela.

## 2. Fora de escopo — e por quê

- **Mercado P2P entre jogadores** (critérios 5 a 7 da spec de origem). **Bloqueado por restrição
  registrada**, não por escolha minha:

  > `memory/restrictions.md` — "Sem chat/marketplace no MVP (…) Exigem verificação de idade mais
  > forte e moderação antes de existir com segurança. **Entram no roadmap só com plano de
  > segurança específico escrito primeiro.**"

  `docs/11_SEGURANCA/` ainda é o esqueleto da fundação. O mercado só pode ser construído depois
  que esse plano existir — e escrevê-lo é trabalho de Fase 3, segundo o próprio `CLAUDE.md`.
- **Compra de diamante com dinheiro real** — depende de gateway contratado (P3 do backlog). Entra
  o *seam* (webhook assinado + RPC exclusiva do servidor), não o provedor.

## 3. A regra que não é preferência de design

`specs/mercado-diamante.md`, critério 3, e `memory/restrictions.md`:

> **Diamante nunca pode ser convertido de volta em dinheiro real**, por nenhum jogador, em nenhuma
> circunstância — sem exceção, sem programa "VIP" que abra brecha.

É o que sustenta vender diamante como moeda de jogo em vez de disparar a restrição de transmissão
de valor entre pessoas. Vira teste, não comentário: **nenhuma função reduz o saldo de diamante,
exceto a compra de ouro** — e essa entrega ouro, não dinheiro.

## 4. Critérios de aceite

1. O jogador tem **saldo de diamante**, em `bigint`, nunca negativo.
2. **Derrotar o boss de dungeon concede diamante** — é a fonte gratuita, e é o que sustenta a
   condição de compliance da fortificação (o caminho sem pagar precisa existir de verdade).
3. A loja vende **pacotes de ouro por diamante**, cada um com **quantidade fixa e publicada**:
   X diamantes entregam sempre exatamente Y ouro. Sem faixa, sem bônus aleatório, sem surpresa.
4. Os pacotes são **dados em tabela**, legíveis pelo client — o preço aparece na tela antes da
   compra, sem letra miúda (restrição ética de transparência).
5. A compra é **atômica**: debita diamante e credita ouro na mesma transação, ou nada acontece.
6. A compra é **recusada** quando falta diamante, sem consumir nada.
7. **Nenhuma rota reduz diamante além da compra de ouro.** Verificação estrutural: o único
   `diamante = diamante -` do schema está dentro de `comprar_ouro`.
8. **Nenhuma rota converte diamante, ouro ou item em dinheiro** — não existe saque, resgate,
   transferência entre jogadores nem reembolso em valor.
9. O crédito de diamante comprado com dinheiro só vem por **webhook assinado**, com a RPC
   revogada de `authenticated` — mesmo padrão da assinatura.
10. `npm test`, `npm run build` e `./scripts/pg-local.sh` verdes.

## 5. Edge cases

- **Compra com saldo exato** — permitida, deixa o saldo em zero.
- **Pacote desativado** — recusado, mesmo que o client ainda o exiba em cache.
- **Duas compras simultâneas com saldo para só uma** — a linha do jogador é travada; a segunda
  falha por saldo insuficiente.
- **Dungeon perdida** — não concede diamante. A chave foi gasta, e isso já é o custo.

## 6. Definição de "aprovado sem ressalvas"

Os 10 critérios verificados; e as duas provas centrais por teste: **não existe caminho que
converta diamante em dinheiro** e **o único débito de diamante é a compra de ouro, com quantidade
fixa**.

---

# Resultado da review — 2026-08-11

`npm test`: **165 passando** (161 → 165). `npm run build`: **verde**, orçamento em 0,43 MB de 8 MB.
`./scripts/pg-local.sh`: **11 migrations aplicam e o teste de fumaça passa**, com uma seção nova
(`== loja de ouro ==`) que executa a compra de verdade contra Postgres 16.

## Auditoria dos 10 critérios

| # | Veredito | Evidência |
|---|---|---|
| 1 | sim | `jogador.diamante bigint not null default 0 check (diamante >= 0)`; a fumaça tenta gravar `-1` e o `check_violation` recusa |
| 2 | sim | `resolver_uma_dungeon` credita `c_diamante_por_vitoria` só no ramo da vitória; a fumaça conferiu o saldo subindo (10000 → 10002) |
| 3 | sim | `pacote_ouro` guarda o par fixo; a fumaça compara o ouro creditado com `v_pacote.ouro` e exige igualdade exata |
| 4 | sim | tabela lida pelo client (`grant select … to authenticated`) e publicada no snapshot via `montar_loja_ouro()`; a UI mostra preço e quantidade lado a lado, no mesmo peso |
| 5 | sim | débito e crédito no mesmo `update`, dentro da mesma transação da RPC |
| 6 | sim | `DIAMANTE_INSUFICIENTE` antes de qualquer escrita; a fumaça confere que o ouro não mudou depois da recusa |
| 7 | sim | teste estrutural: existe **exatamente um** `diamante = diamante -` no schema inteiro, e o índice dele cai dentro de `comprar_ouro` |
| 8 | sim | teste estrutural contra `saque\|sacar\|reembolso\|estorno\|payout\|withdraw\|cash_out\|transferir_para_jogador`; nenhuma ocorrência |
| 9 | sim | `creditar_diamante` revogada de `public, anon, authenticated` e concedida a `service_role`; a fumaça confere que `authenticated` não a alcança |
| 10 | sim | as três verificações verdes |

## Decisões de implementação que valem registro

- **Pacote é linha de tabela, não constante em função.** É o que torna auditável que a quantidade
  é fixa: dá para ler o catálogo com um `select`, sem confiar na leitura do corpo de uma função.
- **A quantidade fixa virou teste, não comentário.** Além do valor conferido na fumaça, um teste
  estrutural proíbe `random(`, `sorteio01`, `escalar_raridade` e `conceder_item` dentro de
  `comprar_ouro` — é exatamente o que transformaria a compra em recompensa aleatória paga.
- **O HUD passou a dizer "Ouro" onde dizia "Moedas".** A fortificação e a loja sempre falaram em
  ouro; um contador chamado "Moedas" obrigava o jogador a deduzir que era a mesma coisa. Custa uma
  string e economiza a única dedução que a tela pedia (Princípio nº 1).
- **Diamante ganhou cor própria no HUD.** Duas moedas com a mesma cor de recompensa seriam
  confundidas de relance — e só uma delas paga a fortificação.

## Ressalvas que continuam valendo

- **O preço em ouro da fortificação segue sendo condição de compliance** (P6 do backlog). Agora
  existem os dois caminhos — dungeon dá diamante, diamante compra ouro —, mas se o custo for
  calibrado para forçar a compra, o caminho gratuito vira fachada. Só dado de jogador real resolve.
- **Compra de diamante com dinheiro não existe ainda**: entrou o *seam* (`creditar_diamante`,
  exclusiva de `service_role`), não o provedor. Depende de P3.
- **O mercado P2P continua bloqueado** pela restrição registrada, e não por escopo desta rodada.

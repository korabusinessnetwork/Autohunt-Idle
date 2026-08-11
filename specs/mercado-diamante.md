# Spec: Diamante (moeda premium) + Mercado P2P

*(estende `specs/dungeons-loot-skins.md` e `specs/passe-de-recompensas.md`)*

## 1. Escopo

Moeda premium "diamante" — comprada com dinheiro real (Asaas, sempre do operador do jogo pro jogador, nunca P2P em dinheiro) e também ganha em dungeon. Usada em duas frentes: **loja própria** (item específico e conhecido, nunca sorteio) e **mercado P2P entre jogadores** — jogador lista item por um preço em diamante, outro compra, diamante muda de dono, e listar cobra uma taxa em diamante (sink econômico).

## 2. Fora de escopo

- **Qualquer caminho de saque de diamante pra dinheiro real** — critério inegociável, não preferência de design (ver "Nota de design")
- Venda ou transferência de conta como forma indireta de sacar valor — proibida por termo de uso do jogo, não é lacuna técnica a fechar depois
- Loot box / item aleatório vendido por diamante — loja e mercado só vendem item específico e conhecido, nunca sorteio
- Gateway único — **superado**: agora são dois, Stripe (EN/internacional) + Asaas (PT/Brasil), roteados por idioma do jogador (ver `docs/01_ARQUITETURA/tech-stack.md`). O mercado P2P em si não toca gateway nenhum, então isso não muda nada do fluxo descrito nesta spec
- Skin exclusiva de passe circulando no mercado — pendente de decisão, ver edge cases

## 3. Arquivos afetados

- `supabase/migrations/` — saldo de diamante por jogador; tabela de listagens do mercado (item, preço em diamante, vendedor, status); taxa de listagem
- `src/lib/services/` — novo `marketService.ts`; `subscriptionService.ts` (já esboçado) ganha compra de diamante via Asaas
- `docs/01_ARQUITETURA/tech-stack.md` — **amendado**: Asaas é o gateway definitivo, não "a decidir"

## 4. Critérios de aceite

1. Diamante é comprado com dinheiro real via Asaas, sempre do operador (o jogo) pro jogador — nunca jogador pra jogador em dinheiro
2. Diamante também é ganho como recompensa de dungeon (já especificado em `specs/dungeons-loot-skins.md`)
3. **Diamante nunca pode ser convertido de volta em dinheiro real**, por nenhum jogador, em nenhuma circunstância — sem exceção, sem programa "VIP" que abra brecha
4. Loja própria vende item específico e conhecido por diamante — nunca caixa aleatória/sorteio
5. Mercado: jogador lista um item **tradable** (arma ou acessório) por um preço em diamante de sua escolha — **skin nunca é tradable, em nenhuma circunstância**, incluindo a skin exclusiva de passe (que preserva a exclusividade por consequência direta desta regra, não por caso especial)
6. Comprar item no mercado transfere diamante do comprador pro vendedor e o item pro comprador — tudo dentro do banco de dados do jogo, **nunca** via Asaas
7. Listar um item cobra uma taxa em diamante do vendedor (sink econômico) — cobrada no momento da listagem, não só na venda (ver raciocínio nos edge cases)
8. Cliente fora do Brasil só compra diamante depois de passar pela liberação manual do Asaas pra cartão estrangeiro — o cadastro precisa avisar isso claramente, sem assumir Pix/boleto disponível pra todo mundo

## 5. Edge cases conhecidos

- Taxa de listagem cobrada na hora de listar (mesmo sem vender) é o que de fato desestimula spam de listagem vazia e cria sink real — valor exato é balanceamento, não bloqueia esta spec
- Jogador lista item e ninguém compra — expira ou fica listado pra sempre? A decidir, não bloqueia
- Chave de dungeon não entra no mercado — mesma lógica de skin (é pessoal, não gera economia entre jogadores); assumido por consistência, não confirmado explicitamente — fácil reverter se a intenção for outra

## Nota de negócio — onde a receita de verdade acontece

Os dois únicos momentos que geram receita nova são a **compra de diamante** e a **compra de assinatura** — é onde dinheiro real entra no sistema. O mercado P2P depois disso é redistribuição entre jogadores: não gera receita nova quando um vende pro outro, só quando o diamante nasce (comprado). Prioridade de polimento de UX no build: checkout de diamante e checkout de assinatura vêm primeiro — é ali que conversão vira receita de verdade.

## Nota de design — por que "sem saque" é inegociável, não preferência

Todo o raciocínio que sustenta esse sistema sem cair em transmissão de dinheiro P2P depende inteiramente de o diamante nunca virar dinheiro de volta — é o que permite vender diamante como "moeda de jogo, operador vendendo" em vez de disparar a mesma restrição de "transmissão pessoa-a-pessoa" que bloqueia outras formas desse desenho. No dia que existir qualquer caminho de saque — direto ou indireto (ex.: venda de conta) — o diamante deixa de ser moeda de jogo e vira dinheiro circulando entre pessoas de fato, reabrindo o mesmo problema que fez o Diablo 3 fechar o RMAH. Essa regra precisa estar no termo de uso do jogo, não só implícita no código.

## 6. Definição de "aprovado sem ressalvas"

Os 8 critérios de aceite verificados; teste manual confirma que não existe nenhuma rota (API, admin, suporte) que converta diamante em dinheiro real ou equivalente; termo de uso do jogo proíbe explicitamente venda/transferência de conta.

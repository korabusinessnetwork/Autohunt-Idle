# Termos de Uso — Rascunho estruturado (Autohunt Idle, nome provisório)

> ⚠️ **ISSO NÃO É UM DOCUMENTO JURÍDICO PRONTO.** É um rascunho organizado, consolidando tudo que já foi decidido ao longo do desenvolvimento deste projeto — ponto de partida pra um advogado revisar e formalizar, não texto pra publicar direto. Dado que há dinheiro real envolvido (Asaas/Stripe), moeda virtual (diamante), e a ANPD fiscalizando ativamente o ECA Digital, **revisão jurídica profissional é necessária antes de qualquer lançamento público.** Precisa de versão em inglês também, dado o lançamento bilíngue (`specs/game-idle-farm-core.md`).

---

## 1. Elegibilidade e idade

- O jogo é restrito a maiores de **18 anos**.
- O cadastro exige data de nascimento real — não autodeclaração isolada tipo checkbox.
- Conta identificada como pertencente a menor de 18 anos será suspensa/encerrada.
- *(Base: `memory/restrictions.md`, pesquisa sobre ECA Digital Lei nº 15.211/2025)*

## 2. Conta do usuário e dados pessoais (LGPD)

- Dados coletados: e-mail, data de nascimento, dados de progresso de jogo, dados de pagamento (processados pelo gateway, nunca armazenados por nós).
- O usuário tem direito de **exportar** e **excluir** seus dados a qualquer momento.
- Base legal de tratamento de dados a especificar com advogado (provavelmente execução de contrato + consentimento).
- *(Base: `docs/11_SEGURANCA/README.md`)*

## 3. Moeda virtual — Diamante

- Diamante é comprado com dinheiro real, sempre da empresa pro jogador (nunca jogador pra jogador em dinheiro).
- Diamante também pode ser obtido jogando (recompensa de dungeon).
- **Diamante não tem valor monetário no mundo real e não pode ser resgatado, trocado ou convertido de volta em dinheiro, por nenhuma via, em nenhuma circunstância.**
- Diamante não pertence ao usuário no sentido de propriedade — é uma licença de uso dentro do jogo, revogável conforme estes termos.
- A empresa pode ajustar preços, disponibilidade ou descontinuar o diamante mediante aviso prévio.
- *(Base: `specs/mercado-diamante.md` — regra tratada como inegociável em todo o desenvolvimento)*

## 4. Mercado entre jogadores

- Jogadores podem listar itens específicos (nunca sorteio/caixa aleatória) por um preço em diamante.
- A empresa não garante o valor, disponibilidade ou venda de nenhum item listado.
- Taxa de listagem é cobrada em diamante no momento da listagem.
- Itens cosméticos (skins) e chaves de dungeon **não podem** ser listados no mercado.
- *(Base: `specs/mercado-diamante.md`, `specs/equipamento-e-poder.md`)*

## 5. Assinatura e Passe

- Assinatura e Passe são cobranças recorrentes, canceláveis a qualquer momento.
- Ao cancelar, benefícios continuam ativos até o fim do período já pago — não há reembolso proporcional nem corte imediato.
- Recompensas de Passe já destravadas permanecem com o jogador mesmo após cancelamento — nunca são retiradas.
- *(Base: `specs/game-idle-farm-core.md`, `specs/passe-de-recompensas.md`)*

## 6. Condutas proibidas

- Venda, compra, transferência ou negociação de contas fora da plataforma.
- Qualquer tentativa de manipular, explorar ou burlar o cálculo de progresso, farm offline, ou qualquer sistema econômico do jogo.
- Uso de bot, engenharia reversa ou automação não autorizada pelo próprio jogo (o jogo já é auto-attack por design — isso se refere a ferramenta externa que manipula o cliente/servidor).
- Consequência: suspensão ou encerramento de conta, sem reembolso de valores já gastos em diamante/assinatura/passe.

## 7. Sem caixa de recompensa (loot box)

- O jogo não vende, e não venderá, recompensa aleatória paga (loot box) sob nenhuma circunstância.
- *(Base: `memory/restrictions.md` — restrição permanente desde a Fase 3 da fundação)*

## 8. Propriedade intelectual e itens virtuais

- Todos os itens, personagens, skins e conteúdo do jogo são propriedade da empresa.
- O jogador recebe uma licença limitada, pessoal e não-transferível de uso.
- A empresa pode modificar, rebalancear ou descontinuar itens/funcionalidades a qualquer momento.

## 9. Processamento de pagamento

- Pagamentos processados por **Stripe** (jogadores internacionais) e **Asaas** (jogadores brasileiros), conforme `docs/01_ARQUITETURA/tech-stack.md`.
- A empresa não armazena dados de cartão — processamento delegado inteiramente aos gateways.

## 10. Lei aplicável e jurisdição

- A definir com advogado — empresa (Kora Business Network) é brasileira, mas o público é majoritariamente internacional; pode exigir cláusula específica sobre qual jurisdição rege disputas, e possível necessidade de observar regras de proteção ao consumidor de outros países conforme onde o jogador está.

## 11. Alterações nos termos

- A empresa pode alterar estes termos mediante aviso — mecanismo exato (e-mail, aviso in-game) a definir.

## 12. Contato

- A preencher — canal de suporte/contato oficial.

---

## Checklist pro advogado revisar (não é lista de "já resolvido")

- [ ] Confirmar jurisdição/lei aplicável dado público internacional
- [ ] Confirmar base legal LGPD exata (Art. 7º/Art. 14)
- [ ] Confirmar se a cláusula de "diamante sem valor monetário" é redigida de forma que resista a contestação, dado o volume real de dinheiro que passa pelo sistema
- [ ] Confirmar necessidade de termo específico por jurisdição (ex.: EUA pode exigir linguagem diferente da UE)
- [ ] Revisar antes do lançamento em qualquer portal (Poki/CrazyGames podem exigir termo próprio deles referenciado ou embutido)

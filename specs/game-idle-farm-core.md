# Spec: Game Idle Auto-Farm — Core de Combate e Progressão Offline

*(nome do jogo: **Autohunt Idle** — slug de trabalho dos arquivos: `game-idle-farm-core`)*

## 1. Escopo
Definir a arquitetura core e as regras de negócio de um web idle game de ação leve, estética inspirada em Realm of the Mad God (top-down), priorizando simplicidade sobre profundidade de economia ("chiclete"). Cobre: combate resolvido por cálculo (não física), mundo instanciado por jogador, farm automático "ao vivo" com client aberto, e farm offline calculado server-side quando o client fecha — com dois caminhos de desbloqueio de horas offline: assinatura (24h/dia, sem anúncio) e anúncio recompensado (15min por anúncio, até 2h/dia, exclusivo de não-assinantes).

## 2. Fora de escopo
- Mundo compartilhado / multiplayer em tempo real (PvP, boss visível pra todos, chat ao vivo) — não pedido, e a arquitetura instanciada escolhida não suporta sem redesenho
- Simulação física de combate (desviar de projétil, hit detection fina) — resolvido por cálculo de stat/tick, não por física
- Nome final do jogo, sistema de classes, árvore de progressão e design de loot — pendente de rodada de design separada
- Escolha final de portal de distribuição (Poki/CrazyGames vs. deploy próprio) e de gateway de pagamento (Stripe vs. Asaas)
- Fundação document-first do projeto (`memory/`, `docs/`, ADRs) — este venture ainda não passou pela `fundacao-de-projeto`; é pré-requisito pro `/build` real, mas não bloqueia este spec

## 3. Arquivos/estrutura afetados
Projeto greenfield — ainda sem fundação Kora rodada. Estrutura inicial proposta (a confirmar quando `fundacao-de-projeto` rodar):
- `supabase/migrations/` — tabelas de personagem, inventário, assinatura, `farm_state` (`last_seen_at`, `accumulated_minutes`, `ad_minutes_today`)
- `supabase/functions/` — RPC `calcular_farm_offline` (`SECURITY DEFINER`), webhook de assinatura, callback de conclusão de anúncio
- `src/game/` — loop de render fora do ciclo do React (canvas/PixiJS via `requestAnimationFrame`), lógica de auto-attack e movimento livre
- `src/features/farm-offline/` — tela "enquanto você tava fora" (ganho ou perda de progresso)
- `specs/game-idle-farm-core.md` — este spec

## 4. Critérios de aceite
1. Com o client aberto, o personagem se move e ataca automaticamente (auto-attack) — sem exigir desviar de projétil manualmente
2. Fechar o client encerra a sessão "ao vivo" e inicia a contagem de farm offline
3. O cálculo de recompensa offline usa exclusivamente `now()` do Postgres via RPC `SECURITY DEFINER` — nenhuma rota aceita timestamp vindo do client pra esse cálculo
4. Assinante ativo acumula até 24h de farm automático por ausência, sem precisar de anúncio
4a. *(Amendado — ver `specs/passe-de-recompensas.md`)* Assinante ativo também recebe multiplicador de 2x XP em toda atividade (farm e dungeon)
5. Não-assinante acumula 0h de farm offline por padrão
6. Não-assinante pode desbloquear até 2h de farm offline por dia assistindo anúncios recompensados, em incrementos de 15min por anúncio
7. Conclusão de anúncio só é creditada via callback validado do SDK no servidor — nenhuma rota credita minutos de anúncio direto a partir do client
8. O bucket de 2h de anúncio reseta a cada 24h
9. Quando a assinatura vence de fato (fim do período pago, ou falha de cobrança definitiva sem carência), o progresso acumulado e ainda não coletado é zerado
10. A tela de retorno exibe o tempo decorrido e o rendimento correspondente — ou, quando aplicável, indica que o progresso não foi salvo por falta de assinatura/anúncio
11. Toda a infraestrutura roda em Supabase (DB + RPC + Edge Functions) — sem servidor de jogo dedicado nem processo persistente
12. *(Amendado)* Nível do personagem não tem teto — cresce indefinidamente, sem level máximo (ver `specs/ranking-global.md`)
13. **(Amendado)** Jogo lança **bilíngue: português e inglês**, desde o dia 1 — nenhuma string de UI, nome de item/inimigo ou texto de tela nasce sem as duas versões. Detecção automática por idioma do navegador, com opção manual de troca nas configurações (a UI da troca é detalhe de build, não bloqueia esta spec)
14. **(Amendado)** Nome de personagem/inimigo/conjunto **não é tradução literal** — humor e trocadilho (ex.: "Minhoca Azeda", "Conjunto da Bruxa Caramelo") precisam de versão em inglês pensada própria pra funcionar no idioma, não texto passado por tradutor automático
15. **(Amendado)** Combate ao vivo: o client simula localmente pra sensação visual (fluida, sem lag de rede a cada golpe), mas o que conta pra XP/loot/moeda só é creditado depois de validação do servidor, em lote a cada N segundos (valor exato é balanceamento) — mesma filosofia do cálculo offline (nunca confiar no client pro que vale economicamente), só que rodando durante a sessão ao vivo também, não só na volta
16. **(Amendado)** "Derrota" no mundo aberto (Vitalidade zerada, `specs/ranking-global.md`) nunca incapacita o personagem de verdade — na pior das hipóteses, zera só o progresso do ciclo de farm em andamento (XP/item já conquistado antes daquele ciclo fica, não é multado), e o personagem recomeça a farmar imediatamente. Mesmo espírito do "sem permadeath" já valendo pra dungeon (`specs/dungeons-loot-skins.md`), sem precisar de um segundo sistema de "vida" com regra própria
17. **(Amendado)** Onboarding: o jogo abre direto no mundo aberto, personagem já andando/atacando sozinho — sem tela de boas-vindas, sem escolha inicial (Princípio nº1). Uma **conta anônima real** (Supabase `signInAnonymously`) é criada no primeiro segundo de jogo, silenciosamente — nunca existe progresso "fora" do sistema seguro, mesmo antes de e-mail/senha
18. **(Amendado)** Cadastro (e-mail/senha + gate de idade) só é pedido quando o jogador tenta fazer algo que exige identidade permanente: fechar o client (ativar farm offline) ou gastar diamante. Cadastrar **adiciona credenciais à conta anônima já existente** — nunca migra ou reimporta progresso, porque nunca houve estado fora da conta pra começar

## 5. Edge cases conhecidos
- Reconexões rápidas em sequência não podem gerar crédito duplicado do mesmo intervalo — avanço de `last_seen_at` precisa ser atômico
- Assinatura vence durante uma sessão offline em andamento — assumindo que "vencer" = fim do período pago/falha definitiva de cobrança, não o clique de cancelar (a confirmar)
- Anúncio fechado ou com erro antes do fim não credita os 15min
- Jogador já no teto de 2h de anúncio tenta assistir mais um — bloquear ou avisar antes de gastar o tempo dele num anúncio que não vai render nada
- Relógio do client dessincronizado do servidor é irrelevante pro cálculo em si (ignorado por design), mas pode afetar o texto exibido na tela de retorno se esse número for montado no client em vez de vir pronto do servidor

## 6. Definição de "aprovado sem ressalvas"
Os 11 critérios de aceite verificados como sim; cálculo offline comprovadamente resistente a timestamp forjado (teste manual: alterar a hora do sistema local não muda o resultado); teto de assinante (24h) vs. free (0h base + até 2h via anúncio) refletido corretamente na UI de retorno.

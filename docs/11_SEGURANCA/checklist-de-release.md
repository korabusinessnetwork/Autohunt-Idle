# Checklist de release — Autohunt Idle

> **Regra deste documento:** nenhuma linha depende de alguém lembrar de conferir. Cada item é um
> comando que roda, ou um passo manual escrito por extenso com o resultado esperado.
>
> A versão anterior deste checklist tinha itens como "RLS ativa em todas as tabelas" — verdadeiro,
> importante, e impossível de saber se alguém checou. Onde existe teste, o item virou o **nome do
> teste**. Onde não existe, virou passo manual explícito, e a ausência de automação está dita.

---

## 1. Automático — roda no CI a cada push

`.github/workflows/ci.yml`. Se algum falhar, não existe release.

| Comando | O que garante |
|---|---|
| `npm test` | 179 testes, dos quais 29 auditam o contrato do schema e 5 auditam a superfície do client. É aqui que moram as provas do `modelo-de-ameacas.md` |
| `npm run build` | Tipo, compilação e o orçamento de peso do portal |
| `npm audit --audit-level=critical` | Nenhuma dependência com vulnerabilidade crítica aberta |
| `gitleaks` (com `fetch-depth: 0`) | Nenhum segredo no repositório — **inclusive no histórico**, porque segredo "removido num commit seguinte" continua lá |
| `./scripts/pg-local.sh` | As 13 migrations aplicam em ordem contra um Postgres 16 real, e o teste de fumaça executa a lógica ponta a ponta |

**Para rodar tudo localmente antes de subir:**

```bash
npm test && npm run build && npm audit --audit-level=critical && ./scripts/pg-local.sh
```

## 2. Automático — o que os testes já provam

Não precisa conferir à mão. Está listado aqui para quem quiser saber *onde* a prova mora, e para
que remover a proteção quebre um teste com nome legível em vez de passar despercebido.

- **RLS em toda tabela** → `toda tabela criada tem RLS habilitada` + `RLS ativa em toda tabela do
  schema public`
- **Client não escreve progressão** → `o jogador não recebe UPDATE em coluna de progressão`
- **Client não declara tempo nem recompensa** → `as RPCs que creditam valor não aceitam parâmetro
  nenhum` + `nenhuma RPC do jogador aceita parâmetro de tempo ou de recompensa`
- **Farm usa `now()` do Postgres** → `o tempo do cálculo vem sempre de now() do Postgres`
- **Gate de 18+ no banco** → `o gate de 18+ é enforcado por trigger, não só pelo formulário`
- **Data de nascimento imutável** → `a data de nascimento não pode ser reescrita depois de
  informada`
- **Sem `tenant_id` (ADR-002)** → `não existe tenant_id em nenhuma instrução`
- **Sem rota de diamante para dinheiro** → `nenhuma rota converte diamante, ouro ou item em
  dinheiro`
- **Sem loot box** → `a quantidade de ouro do pacote é fixa, nunca sorteada` + `nenhuma rota vende
  pedra de fortificação`
- **Sem `select *` em tabela sensível** → `a referência do gateway nunca é concedida ao jogador`
- **LGPD não alcança conta alheia** → `as RPCs de LGPD não alcançam a conta de outro jogador`
- **Sorteio determinístico, nunca `random()`** → `nenhum sorteio do jogo usa random() do Postgres`
- **Nenhum dado de cartão no schema** → `nenhuma tabela guarda dado de cartão`
- **`service_role` fora do bundle** → `a service_role nunca é referenciada no client`
- **Nenhuma chave hardcoded no client** → `nenhuma chave ou URL de API é hardcoded`
- **Nenhum log no client** → `não existe console.* no código de produção`
- **Passe não é loot box** → `a recompensa do passe nunca é sorteada`
- **Nada na trilha expira** → `nada na trilha do passe expira`
- **Recompensa destravada não é retirada** → `recompensa de passe já destravada nunca é retirada`
- **Skin do passe é exclusiva de verdade** → `só a trilha do passe concede item exclusivo`

## 3. Manual — configuração do projeto Supabase

Não dá para automatizar: são chaves e botões de painel, fora do repositório.

- [ ] **`signInAnonymously` habilitado.** Sem isso o jogo abre na tela de erro e ninguém joga
      (D2 do backlog). *Como conferir:* abrir o jogo numa aba anônima; o personagem tem que
      aparecer andando em até 5 segundos, sem nenhuma tela de login.
- [ ] **Decidir "Confirm email"** (P1 do backlog). Ligada = mais seguro contra e-mail digitado
      errado; desligada = menos fricção. O código funciona nos dois modos.
- [ ] **`service_role` não está em variável de ambiente do frontend.** *Como conferir:* no painel
      da Vercel, a lista de env vars do projeto não pode ter nenhuma chave que comece com
      `SUPABASE_SERVICE` nem qualquer `VITE_` com valor de JWT longo.
- [ ] **`pg_cron` agendando `recomputar_ranking()`** (D6). Sem isso o placar só se mexe quando
      alguém define apelido. Extensão gratuita, roda dentro do Postgres.
- [ ] **2FA ativo** nas contas de Supabase, Vercel e GitHub do dono. Fora do código, e o vetor
      mais direto que existe contra o projeto inteiro.

## 4. Manual — o que o Postgres local NÃO prova

`./scripts/pg-local.sh` roda contra um Postgres comum com um stub de `auth`. Ele prova que o SQL
roda, que as constraints pegam e que a matemática fecha. **Não prova RLS sob um JWT real**
(ameaça 7.5 do modelo). Estes testes só existem num projeto Supabase de verdade:

- [ ] **Isolamento entre jogadores.** Criar duas contas, A e B. Com o token de A, tentar ler a
      linha de B em `jogador`, `farm_state`, `item_jogador` e `assinatura`. *Esperado:* zero linha
      em todas — não erro de permissão, **zero linha**, que é como RLS recusa.
- [ ] **Escrita cruzada.** Com o token de A, tentar `update` na linha de B. *Esperado:* zero linha
      afetada.
- [ ] **Papel `anon`.** Sem autenticar, tentar ler qualquer tabela. *Esperado:* recusa — `anon` não
      tem grant nenhum.
- [ ] **Relógio do client.** Adiantar o relógio do sistema em 10 horas e reabrir o jogo.
      *Esperado:* a tela de retorno mostra exatamente o mesmo que mostraria sem mexer no relógio.
- [ ] **Crédito de anúncio sem anúncio.** Chamar a rota de crédito direto, sem o callback do
      provedor. *Esperado:* recusa. **Só testável depois de P2.**

## 5. Manual — compliance antes do lançamento público

- [ ] **Revisão jurídica dos termos de uso.** `termos-de-uso-rascunho.md` é rascunho, e diz isso na
      primeira linha. Há dinheiro real, moeda virtual e a ANPD fiscalizando o ECA Digital. **É o
      único item pago que este projeto recomenda não adiar.**
- [ ] **Termos publicados em português e inglês** — o jogo lança bilíngue.
- [ ] **A cláusula de "diamante não vira dinheiro" está no termo**, não só no código. É o que
      sustenta o produto inteiro (ameaça 4.1).
- [ ] **A proibição de venda/transferência de conta está no termo.** É a rota indireta de saque, e
      o código não consegue fechá-la sozinho.
- [ ] **Aprovação do portal**, se o canal for Poki ou CrazyGames. A Poki precisa confirmar se
      bloqueia chamada ao Supabase (P4) — **é a pendência de maior impacto do projeto**, porque uma
      resposta negativa invalida a arquitetura inteira naquele canal.

## 6. Manual — primeira vez que dinheiro real entrar

Enquanto P3 estiver aberto, esta seção inteira está adiada. Quando abrir:

- [ ] Webhook do gateway com verificação de assinatura HMAC — não só o segredo no header.
- [ ] Replay do mesmo webhook não credita duas vezes.
- [ ] `creditar_diamante` continua revogada de `authenticated`. *Como conferir:* o teste
      `as funções que aceitam parâmetro são exclusivas do servidor` já cobre; roda no CI.
- [ ] Nenhum dado de cartão em tabela nossa. *Como conferir:* o teste `nenhuma tabela guarda dado
      de cartão` já cobre; roda no CI.
- [ ] Cancelar assinatura é tão fácil quanto assinar (restrição ética, não usabilidade).

---

## Resposta a incidentes

1. **Detectar** — de onde veio (log, report, CI). Registrar em `memory/bugs.md` com severidade.
2. **Conter** — revogar chave vazada, revogar o `grant` da função afetada, bloquear a conta.
3. **Corrigir** — patch **mais o teste que prova a correção**. Sem o teste, o incidente volta.
4. **Registrar** — post-mortem curto em `memory/learnings.md`; se muda arquitetura, abrir ADR.
5. **Prevenir** — o aprendizado vira restrição (`memory/restrictions.md`) ou linha nova no
   `modelo-de-ameacas.md`, com o nome do teste.

**Cenários mais prováveis, em ordem de severidade:**

| Severidade | Cenário | Contenção imediata |
|---|---|---|
| CRÍTICA | Vazamento da `service_role` | Rotacionar a chave no painel do Supabase. Ela alcança tudo, ignorando RLS |
| CRÍTICA | Vazamento de dado de assinatura/conta | Aciona LGPD/ANPD — prazo de comunicação ao titular e à autoridade |
| ALTA | Farm offline explorado | `revoke execute` nas RPCs de sessão derruba o farm para todos, mas estanca. Afeta a economia inteira |
| ALTA | Rota de diamante para dinheiro descoberta (inclusive venda de conta) | Reabre a análise regulatória inteira, não só um bug |
| MÉDIA | Callback de anúncio burlado | `AD_PROVIDER` vazio desliga o crédito. Afeta receita do tier grátis |
| BAIXA | Spam em `evento_jogo` | `revoke insert` na tabela; o log é fire-and-forget e o jogo funciona sem ele |

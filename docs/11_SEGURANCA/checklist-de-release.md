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
| `npm test` | 199 testes, dos quais 29 auditam o contrato do schema e 5 auditam a superfície do client. É aqui que moram as provas do `modelo-de-ameacas.md` |
| `npm run build` | Tipo, compilação e o orçamento de peso do portal |
| `npm audit --audit-level=critical` | Nenhuma dependência com vulnerabilidade crítica aberta |
| `gitleaks` (com `fetch-depth: 0`) | Nenhum segredo no repositório — **inclusive no histórico**, porque segredo "removido num commit seguinte" continua lá |
| `./scripts/pg-local.sh` | As 14 migrations aplicam em ordem contra um Postgres 16 real, e o teste de fumaça executa a lógica ponta a ponta |

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
- **Cenário não vira recompensa** → `nenhuma migration menciona bioma` + `nenhum módulo de regra importa biomas`
- **A superfície do client é fechada** → `a superfície do client é exatamente a lista declarada` (pergunta ao banco, não ao arquivo)
- **O sorteio não é previsível pelo jogador** → `authenticated não lê farm_state.contador_sorteio` + `authenticated não lê o tempero do RNG`
- **Função nova não nasce exposta** → `EXECUTE não é mais concedido por omissão`

## 3. Manual — configuração do projeto Supabase

> Para a primeira vez, o caminho completo está em `docs/01_ARQUITETURA/subir-o-supabase.md`. Esta
> lista é a conferência; lá é a travessia.

Não dá para automatizar: são chaves e botões de painel, fora do repositório.

- [ ] **`signInAnonymously` habilitado.** Sem isso o jogo abre na tela de erro e ninguém joga
      (D2 do backlog). *Como conferir:* abrir o jogo numa aba anônima; o personagem tem que
      aparecer andando em até 5 segundos, sem nenhuma tela de login.
- [ ] **Decidir "Confirm email"** (P1 do backlog). Ligada = mais seguro contra e-mail digitado
      errado; desligada = menos fricção. O código funciona nos dois modos.
      *Decidido em 2026-08-12: **desligada** durante o desenvolvimento. Volta à mesa aqui, antes do
      lançamento público — é este item que a traz de volta.*
- [ ] **Captcha no cadastro anônimo** (D23 do backlog). O próprio painel do Supabase avisa ao
      habilitar `signInAnonymously`: sem captcha, um script cria contas em massa. Não vaza nada
      (cada conta enxerga só a própria linha), mas incha o banco e **conta como MAU**, que é o que
      o plano gratuito limita. Enquanto o jogo é privado, o risco é teórico. *Como conferir:*
      Authentication → Attack Protection → captcha habilitado (hCaptcha e Turnstile têm plano
      gratuito — não fere a restrição de custo).
- [ ] **`service_role` não está em variável de ambiente do frontend.** *Como conferir:* no painel
      da Vercel, a lista de env vars do projeto não pode ter nenhuma chave que comece com
      `SUPABASE_SERVICE` nem qualquer `VITE_` com valor de JWT longo.
- [ ] **`pg_cron` agendando `recomputar_ranking()`** (D6). Sem isso o placar só se mexe quando
      alguém define apelido. Extensão gratuita, roda dentro do Postgres.
- [ ] **Rodar `scripts/conferir-supabase.sql` no SQL Editor** e conferir 14/14. Somente leitura.
      **Não é conveniência, é passo obrigatório:** foi ele que achou, em 2026-08-12, duas
      concessões que a suíte local inteira aprovava — `public.ajuste` com ALL para `anon` e
      `authenticated`, e `emitir_ticket_auto()` alcançável por `anon`. O Postgres local prova a
      lógica; a configuração de papéis só o banco real prova.
- [ ] **Promover o dono a admin.** É o único caminho que existe — não há autocadastro, convite nem
      botão dentro do jogo, de propósito. No SQL editor do Supabase:
      `update public.jogador set admin = true where id = '<uuid do dono>';`
      Sem isso o console `/console` abre e recusa toda escrita, que é exatamente o comportamento de
      quem não é admin.
- [ ] **Conferir que ninguém mais é admin.** `select id from public.jogador where admin;` — a lista
      precisa ter exatamente as contas que o dono reconhece. Uma linha a mais aqui vale mais que
      qualquer outra brecha do schema (ameaça 12.9).
- [ ] **2FA ativo** nas contas de Supabase, Vercel e GitHub do dono. Fora do código, e o vetor
      mais direto que existe contra o projeto inteiro.

## 4. Manual — o que o Postgres local NÃO prova

`./scripts/pg-local.sh` roda contra um Postgres comum com um stub de `auth`. Ele prova que o SQL
roda, que as constraints pegam e que a matemática fecha. **Não prova RLS sob um JWT real**
(ameaça 7.5 do modelo). Estes testes só existem num projeto Supabase de verdade:

> **Executados pela primeira vez em 2026-08-12**, contra o projeto real, com duas contas anônimas
> criadas e excluídas pelo próprio `excluir_minha_conta`. Ficam marcados, e **voltam a ser
> exigidos a cada release** — RLS é policy, e policy some numa migration distraída sem quebrar
> nenhum teste. Repetir é barato; a primeira execução levou dois minutos.

- [x] **Isolamento entre jogadores.** Criar duas contas, A e B. Com o token de A, tentar ler a
      linha de B em `jogador`, `farm_state`, `item_jogador` e `assinatura`. *Esperado:* zero linha
      em todas — não erro de permissão, **zero linha**, que é como RLS recusa.
      *2026-08-12: `[]` nas quatro, e também em `atributo_jogador`, `passe_jogador` e
      `ticket_anuncio`. Zero linha, não erro — a distinção importa, porque erro de permissão
      significaria que quem barrou foi o GRANT, e a policy nunca teria sido exercitada.*
- [x] **Escrita cruzada.** Com o token de A, tentar `update` na linha de B. *Esperado:* zero linha
      afetada. *2026-08-12: `[]` com `Prefer: return=representation`, ou seja, zero linha afetada —
      a policy filtrou antes de escrever. O `delete` nem chega à policy: não existe grant de DELETE
      para `authenticated`, então para por privilégio, uma camada antes.*
- [x] **Papel `anon`.** Sem autenticar, tentar ler qualquer tabela. *Esperado:* recusa — `anon` não
      tem grant nenhum. *2026-08-12: `42501 permission denied` nas oito tabelas testadas
      (`jogador`, `farm_state`, `item_jogador`, `assinatura`, `ajuste`, `evento_jogo`,
      `ranking_posicao`, `pacote_ouro`). Este é o item que a migration `20260827` consertou — antes
      dela, `ajuste` respondia.*
- [x] **A separação de escopo do console vale no banco, não só na tela** (ameaças 12.x).
      *2026-08-12, com token de jogador comum: `ajuste` devolve **9 linhas de 16**, todas de escopo
      `visual` — os sete números econômicos não chegam ao client. `definir_ajuste` devolve
      `NAO_AUTORIZADO`, `log_operacional` devolve `NAO_AUTORIZADO`, e `UPDATE` direto na tabela para
      por privilégio. `segredo_rng` e `farm_state.contador_sorteio`, negados.*
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

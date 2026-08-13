# Subir o Supabase — passo a passo

> O jogo inteiro foi construído sem nunca ter rodado contra um banco de verdade. Este documento é
> a travessia: do projeto vazio até abrir `/console` como admin.

Tempo real: **20 a 30 minutos**, quase todo esperando o projeto provisionar.

## Antes de começar

- **Pode ser um e-mail diferente do e-mail do GitHub.** Supabase e Vercel não exigem que a conta
  seja a mesma do repositório — o vínculo é por autorização OAuth na hora de conectar, não por
  e-mail igual.
- **Plano gratuito serve.** O que ele impõe e vale saber de antemão: até 2 projetos ativos, e o
  projeto **pausa sozinho depois de ~7 dias sem uso** (despausar é um clique, não perde dado). Nada
  neste jogo precisa de plano pago hoje.
- Nada aqui exige instalar a CLI do Supabase. Há um caminho com CLI no passo 2, para quem preferir.

---

## 1. Criar o projeto

1. `supabase.com` → criar conta → **New project**.
2. **Nome:** `autohunt-idle`.
3. **Database password:** gere uma forte e **guarde num gerenciador de senhas**. Ela não aparece de
   novo, e é ela que abre o banco por fora do painel.
4. **Região:** `South America (São Paulo)` — o público é brasileiro, e a latência de cada RPC vai
   direto na sensação de responsividade do jogo.
5. Criar e esperar provisionar (~2 min).

## 2. Aplicar o schema

São **17 migrations**, e a ordem importa: várias redefinem funções das anteriores — `iniciar_sessao`
foi reescrita cinco vezes ao longo das rodadas. Colar arquivo por arquivo é onde se pula um ou se
troca a ordem, e o erro aparece muito depois, como comportamento estranho em vez de falha.

Gere o arquivo único:

```bash
./scripts/sql-para-supabase.sh > autohunt.sql
```

No painel: **SQL Editor** → **New query** → colar o arquivo inteiro → **Run**.

Três coisas sobre esse arquivo, todas verificadas contra um Postgres 16 de verdade:

- **aplica de uma vez num projeto vazio** e cria as 13 tabelas;
- **roda dentro de uma transação.** Se falhar no meio, o banco volta exatamente ao que era — um
  projeto meio migrado é o pior estado possível, porque parece que funcionou;
- **não é para rodar duas vezes.** O arquivo é o histórico completo, e histórico não é
  re-executável: a migration `20260818` trocou `item_jogador.equipado` por `slot`, então uma
  migration anterior cria um índice sobre uma coluna que, num banco já migrado, não existe mais. A
  segunda execução falha e reverte inteira, sem estrago — mas não faça. Para **evoluir** um banco
  que já tem o schema, aplique só a migration nova.

> **Alternativa com CLI**, para quem preferir: `supabase link --project-ref <ref>` e
> `supabase db push`. Vantagem real — a CLI guarda o histórico de migrations dentro do projeto, o
> que o arquivo único não faz. Custa instalar a CLI e gerar um access token.

**Conferir que colou:** o SQL Editor deve listar 13 tabelas em **Table Editor**. Se aparecerem
menos, a transação reverteu e a mensagem de erro está no painel — corrija e rode de novo, o banco
está limpo.

## 2b. Conferir o que o banco DEIXOU

Cole `scripts/conferir-supabase.sql` no SQL Editor e rode. Somente leitura — não escreve, não cria
conta de teste, não deixa rastro. Devolve 14 linhas, falhas no topo.

**Não pule.** O passo 2 prova que as migrations *aplicam*; este pergunta ao banco o que elas
*deixaram*, que é outra coisa. Na primeira vez que este schema existiu num Supabase real, esta
consulta achou duas concessões que a suíte local inteira aprovava — a história está em
`docs/07_APIS/` §6.

## 3. Ligar a conta anônima — o passo que quebra tudo se faltar

**Authentication → Providers/Sign-in → habilitar `Anonymous sign-ins`.**

Não é opcional: **toda sessão do jogo começa numa conta anônima criada em silêncio no primeiro
segundo** (core, critério 17). Com isso desligado o jogo abre na tela de erro — que existe, é
legível e tem botão de tentar de novo, mas ninguém joga. É a dívida D2 do backlog.

## 4. Decidir a confirmação de e-mail (P1 — é sua)

**Authentication → Sign In / Providers → Email → `Confirm email`.**

| Ligada | Desligada |
|---|---|
| `auth.users.email` só é preenchido depois do clique no link | cadastro vale na hora |
| protege contra e-mail digitado errado — e e-mail errado é conta perdida pra sempre | menos fricção, alinhado ao Princípio nº 1 |

O código já lida com as duas: o gate de 18+ usa `identidade_verificada`, que se apoia na data de
nascimento imutável e não no e-mail confirmado.

**Recomendação para agora: desligada.** Você é o único jogador durante o desenvolvimento, e um
e-mail de confirmação que não chega vira meia hora perdida investigando a coisa errada. Antes do
lançamento público a decisão volta à mesa — está no checklist de release.

## 5. Ligar o jogo no projeto

**Project Settings → API.** Copie dois valores:

- a **URL** do projeto (`https://<ref>.supabase.co`);
- a **chave pública**. Dependendo de quando o projeto foi criado, o painel a chama de `anon`
  `public` (um JWT longo, começa com `eyJ`) ou de **publishable key** (`sb_publishable_…`).
  **Qualquer uma das duas serve** — o SDK aceita as duas, e as duas são públicas por natureza.
  A que **nunca** sai do painel é a `service_role` / `secret`: ela ignora RLS e alcança todas as
  contas.

Crie o `.env` na raiz do projeto:

```bash
cp .env.example .env
```

e preencha:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<a chave pública>
VITE_CANAL=dominio-proprio
```

`.env` está no `.gitignore` — confira antes de commitar qualquer coisa. Um teste
(`nenhuma chave ou URL de API é hardcoded`) reprova o build se uma URL de projeto ou um JWT
aparecer dentro de `src/`.

## 6. Rodar

```bash
npm run dev
```

O que tem que acontecer, nesta ordem: a tela de carregamento com a marca → o mundo aparece → o HUD
mostra nível 1. **Se aparecer a tela de erro**, o motivo está escrito nela — quase sempre é o passo
3 (conta anônima desligada) ou uma variável do `.env` com espaço sobrando.

Confirme do outro lado também: **Table Editor → `jogador`** deve ter uma linha. Ela é você.

## 7. Virar admin e abrir o console

O uuid da sua conta sai do **Authentication → Users**, ou do SQL Editor:

```sql
select id, criado_em from public.jogador order by criado_em;
```

Depois, ainda no SQL Editor:

```sql
update public.jogador set admin = true where id = '<seu uuid>';
```

**É o único caminho que existe.** Não há autocadastro, convite nem botão dentro do jogo — qualquer
fluxo de promoção dentro do produto seria um fluxo explorável, e um `update` manual exige a chave do
projeto, que já é o acesso mais alto que existe.

Recarregue e abra **`/console`**. As duas abas devem funcionar: os números do jogo (com faixa e
descrição) e o log — que já vai ter pelo menos uma linha, a sua.

Teste a proteção de verdade, em uma janela anônima: abra `/console` sem ser admin. A tela **abre**,
diz que não é pra você, e qualquer tentativa de salvar é recusada pelo servidor. É assim de
propósito — esconder a rota seria obscuridade, e obscuridade não é controle.

---

## O que fica para depois, e por quê

| Item | Por que não agora |
|---|---|
| **`pg_cron` chamando `recomputar_ranking()`** (D6) | Extensão gratuita, roda dentro do Postgres. Sem ela o placar só se mexe quando alguém define apelido — dá pra viver com isso enquanto você é o único jogador |
| **Deploy das Edge Functions** | As três existem (`anuncio-callback`, `anuncio-resgate`, `assinatura-webhook`), mas nenhuma tem provedor plugado: P2 (anúncio) e P3 (gateway) são decisões suas. Sem provedor, elas rejeitam tudo — que é o estado correto |
| ~~**Teste de RLS com JWT real**~~ (ameaça 7.5) — **feito em 2026-08-12** | Era o único teste que o Postgres local **não** consegue fazer: o stub simula `auth.uid()` por variável de sessão, não por token. Feito assim que o projeto existiu — duas contas anônimas, A não lê nem escreve nada de B em sete tabelas, `anon` não alcança tabela nenhuma, e as duas contas foram apagadas pelo próprio `excluir_minha_conta`. A política estava certa. **Continua no checklist de release §4**, porque não há teste automático que a defenda de uma migration distraída |
| **Vercel** | Outro passo, outro documento. O jogo roda local primeiro |

## Ligações

- `docs/11_SEGURANCA/checklist-de-release.md` — a lista completa de configuração manual do projeto
- `docs/09_BACKLOG/README.md` — P1, P2, P3, P4 e D2/D6
- `scripts/sql-para-supabase.sh` — gera o arquivo do passo 2

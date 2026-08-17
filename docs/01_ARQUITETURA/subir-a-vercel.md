# Subir a Vercel — passo a passo

> Continuação de `subir-o-supabase.md`. Lá o jogo ganhou banco; aqui ele ganha endereço.
> Faça na ordem: sem o Supabase de pé, o que sobe aqui abre direto na tela "Não deu pra conectar".

Tempo real: **10 a 15 minutos**, quase todo esperando o primeiro build.

## Antes de começar

- **Pode ser um e-mail diferente do e-mail do GitHub**, como no Supabase. O vínculo se faz por
  autorização OAuth na hora de conectar o repositório.
- **Nada aqui exige instalar a CLI da Vercel.** Todo o caminho é pelo painel, e o `vercel.json` do
  repositório já carrega as decisões que costumam ser feitas por clique.
- **⚠️ O plano gratuito (Hobby) é para uso NÃO COMERCIAL.** Está nos termos da Vercel, e este jogo
  tem assinatura e diamante no roteiro. Enquanto ele é privado e não fatura, o Hobby serve e não
  fere a restrição de custo do `CLAUDE.md`. **No dia em que o primeiro real entrar, o plano precisa
  virar Pro** — hoje US$ 20/mês por usuário. Ver "Quando isto passa a custar" no fim do documento,
  que traz as alternativas gratuitas e a recomendação.

---

## 1. Importar o repositório

1. `vercel.com` → criar conta → **Add New… → Project**.
2. Autorizar o GitHub e escolher `korabusinessnetwork/Autohunt-Idle`.
3. A Vercel detecta **Vite** sozinha. **Não mexa em Build Command nem em Output Directory**: o
   `vercel.json` na raiz do repositório já os define, e o que está lá vence o que o painel mostra.
4. **Não clique em Deploy ainda.** Antes, o passo 2 — sem as variáveis, o primeiro build sobe um
   jogo que não conecta em nada.

## 2. As variáveis de ambiente

Ainda na tela de importação, abra **Environment Variables** e cadastre as duas que o jogo exige:

| Nome | Valor | Onde achar |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | painel do Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | a chave **anon / public** | mesma tela |

Marque as três caixas (Production, Preview, Development) nas duas.

Uma terceira é opcional e fica **vazia** por enquanto:

| Nome | Valor | Para quê |
|---|---|---|
| `VITE_CANAL` | vazio, ou `crazygames` / `poki` | canal de distribuição (`docs/01_ARQUITETURA/publicacao-portais.md`). Vazio cai em `dominio-proprio`, que não carrega SDK de terceiro nenhum |

**A regra que não tem exceção: a `service_role` NUNCA entra aqui.** Ela ignora RLS inteira — no
navegador de qualquer jogador, é o banco aberto. O checklist de release confere isto explicitamente
(`docs/11_SEGURANCA/checklist-de-release.md`, §3): a lista de env vars não pode ter chave começando
com `SUPABASE_SERVICE`, nem nenhuma `VITE_` com um JWT longo dentro. Tudo que começa com `VITE_` vai
para dentro do bundle que o jogador baixa — é público por construção, não por descuido.

## 3. Deploy

**Deploy** → esperar (~2 min). O build roda `npm run build`, que é `tsc --noEmit && vite build` mais
o `scripts/verificar-orcamento.mjs` — o mesmo comando do CI, então uma falha aqui já teria falhado
lá. O artefato de hoje: **0,32 MB** de download inicial, de um teto de 8 MB.

**Conferir que colou:** abrir a URL `*.vercel.app` que a Vercel devolve. O jogo tem que abrir **no
mundo**, com o herói no meio da tela — não na tela de erro. Se aparecer `CONFIGURACAO_AUSENTE`, as
variáveis do passo 2 não chegaram ao build: corrija e refaça o deploy (variável nova **não** entra
num build já feito).

## 4. Voltar ao Supabase e apontar as URLs

Este passo é fácil de esquecer porque acontece no outro painel — e sem ele o link de confirmação de
e-mail cai no vazio. Já mordeu uma vez (2026-08-13).

No Supabase: **Authentication → URL Configuration**.

- **Site URL**: o domínio de produção da Vercel.
- **Redirect URLs**: acrescente `https://<seu-projeto>.vercel.app/**` e, para os previews de cada
  branch, `https://*.vercel.app/**`. Mantenha `http://localhost:5173/**` para o desenvolvimento.

O jogo manda a origem certa em `emailRedirectTo` (sai de `window.location.origin`, sem URL fixa no
código), mas o Supabase **só honra o redirect se ele estiver na lista**.

## 5. Domínio próprio (opcional, e gratuito de configurar)

**Project → Settings → Domains** → adicionar o domínio → apontar o DNS como a Vercel indicar. O
certificado TLS é emitido e renovado por ela, sem custo. Feito isso, volte ao passo 4 e troque a
Site URL do Supabase para o domínio definitivo.

---

## O que o `vercel.json` já resolve, e por quê

Três decisões que, se ficassem para o painel, ficariam sem registro:

**`rewrites` de `/console`.** O jogo não tem roteador (`src/App.tsx`): `/console` é decidido lendo
`window.location.pathname`. Para a Vercel, porém, `/console` é um arquivo que não existe no `dist/`
— sem o rewrite, abrir ou recarregar a tela do dono devolve 404. O rewrite é **estreito de
propósito**: só `/console`. Um catch-all `/(.*)` transformaria todo endereço errado numa tela de
jogo, e um 404 de verdade vale mais que um jogo aberto no lugar errado.

**`trailingSlash: false`.** Esta é a parte não óbvia, e é uma armadilha real. O `vite.config.ts` usa
`base: './'` — caminhos relativos, porque os portais servem o jogo de um subdiretório. Em
`/console`, `./assets/index.js` resolve para `/assets/index.js` e tudo carrega. Em `/console/` (com
barra), resolveria para `/console/assets/index.js`, que **não existe**: tela branca. O
`trailingSlash: false` faz a Vercel redirecionar `/console/` para `/console` antes de servir
qualquer coisa, e a armadilha deixa de existir. *Verificado num servidor que imita estas regras
sobre o `dist/` real: `/console`, `/console/` e `/` carregam os três sem um request de erro.*

**`Cache-Control` imutável em `/assets/*`.** O Vite põe hash no nome de cada arquivo, então um
`/assets/index-CwvkRr0K.js` nunca muda de conteúdo — só nasce outro nome no build seguinte. O
`index.html` fica de fora da regra e continua sendo revalidado, que é o que faz o deploy novo
aparecer para quem já tinha o jogo aberto.

## Quando isto passa a custar

Enquanto o jogo não fatura, tudo aqui é gratuito. O que muda a conta:

| Gatilho | Custo | Alternativa gratuita | Recomendação |
|---|---|---|---|
| **Primeira receita** (assinatura ou diamante vendido) | Vercel **Pro**, US$ 20/mês por usuário — o Hobby proíbe uso comercial nos termos | **Cloudflare Pages** e **Netlify** hospedam site estático sem cláusula de não-comercial no plano gratuito. O jogo é `dist/` estático, então a migração é reapontar o DNS, não reescrever nada | **Depois.** Não antecipe: enquanto for privado e sem receita, o Hobby está dentro das regras. No dia da primeira venda, decida entre pagar os US$ 20 ou mover para a Cloudflare — e a decisão vira ADR |
| **100 GB de banda/mês** no Hobby | idem | idem | Longe. 0,32 MB por jogador dá muita gente antes de encostar no teto |

Nada neste documento exige contratar nada hoje.

## Ligações

- `docs/01_ARQUITETURA/subir-o-supabase.md` — o passo anterior, obrigatório
- `docs/11_SEGURANCA/checklist-de-release.md` — a lista completa antes de abrir ao público, com o
  item da `service_role` e o 2FA das três contas (Supabase, Vercel, GitHub)
- `docs/01_ARQUITETURA/publicacao-portais.md` — CrazyGames e Poki, que são outro caminho de
  distribuição e não substituem este
- `memory/restrictions.md` — a regra de custo que enquadra o Hobby × Pro acima

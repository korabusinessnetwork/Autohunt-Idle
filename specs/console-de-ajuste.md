# Spec: console de ajuste do jogo

> Pedido do dono em 2026-08-12: *"criar um console pra eu editar todos os tipos de coisa no jogo —
> velocidade, boost de XP, spawn de monstros, dano de monstros individuais etc"*.

## 1. O que este console é, e o que ele nunca pode virar

É a ferramenta que tira o balanceamento das minhas mãos e coloca nas do dono. Hoje **quase todo
número do jogo é chute meu** (D4 do backlog): ciclo de 15 s, 3 abates por ciclo, herói a 110 de
velocidade, alcance de tiro em 210. Números escolhidos para o sistema ficar observável, não para
ser divertido — e só quem joga sabe qual é qual.

**O que ele nunca pode virar:** uma segunda porta para a economia. Quem alcança este console muda
XP, dano e drop de todo mundo. É a superfície mais perigosa que este schema vai ter.

## 2. A decisão que molda tudo: onde mora a proteção

**No banco. Nunca na tela.**

Esconder a rota de admin é segurança por obscuridade, e obscuridade não é controle. A tela pode
estar no bundle que todo jogador baixa — e vai estar, porque manter um segundo deploy só para isso
custa infra numa fase que a restrição de custo manda evitar.

O que protege é:

- a escrita passa por **uma RPC `SECURITY DEFINER`** que confere se `auth.uid()` é admin;
- as tabelas de ajuste **não têm grant de UPDATE para `authenticated`**, nem para admin. Nem o dono
  escreve direto: ele passa pela RPC, que valida faixa e registra quem mudou o quê.

Consequência prática: um jogador curioso pode abrir a tela, preencher os campos e clicar. A RPC
recusa. Nada nele muda, e a tentativa fica no log.

## 3. Como alguém vira admin

Não existe autocadastro, não existe convite, e não existe botão. **Um `update` no SQL editor do
Supabase**, feito por quem tem acesso ao projeto:

```sql
update public.jogador set admin = true where id = '<uuid do dono>';
```

É deliberado que seja assim. Qualquer fluxo dentro do jogo que conceda admin é um fluxo que pode
ser explorado; um `update` manual exige a chave do projeto, que já é o nível de acesso mais alto
que existe.

`admin` é coluna de `jogador`, **fora do grant de UPDATE do client** — pela mesma razão de `nivel`
e `moeda` estarem fora.

## 4. Os dois tipos de número, e por que a distinção importa

O pedido mistura duas coisas que o resto do projeto manteve separadas com muito cuidado:

| Tipo | Exemplos | Onde é lido | O que muda |
|---|---|---|---|
| **Visual** | velocidade do herói, alcance de tiro, densidade de spawn, velocidade do projétil | pelo **client**, via snapshot | a *sensação* de jogar |
| **Econômico** | XP por abate, moeda por abate, dano recebido por ciclo, boost de XP, taxa de drop | pelas **RPCs do servidor** | quanto todo mundo ganha |

**Os dois vão para a mesma tabela, e é o servidor que lê os econômicos.** Um valor visual chegar
adulterado ao client não vale nada — ele não credita. Um valor econômico nunca passa pelo client.

Isso preserva a regra que sustenta o produto: **o client continua sem declarar ganho.** Ele recebe
números prontos; nunca os envia.

## 5. Escopo

### 5.1 Servidor

- Tabela `ajuste`: `chave`, `valor`, `minimo`, `maximo`, `categoria`, `descricao`.
- **Faixa obrigatória por linha.** É o que impede um zero digitado errado em "duração do ciclo"
  parar o jogo inteiro, e um `999999` em "XP por abate" arruinar a economia num clique.
- `definir_ajuste(chave, valor)` — `SECURITY DEFINER`, confere admin, valida a faixa, registra.
- As funções que hoje têm `constant` passam a ler da tabela.
- `montar_snapshot` publica os valores **visuais** para o client.

### 5.2 Client

- Rota `/console`, com os ajustes agrupados por categoria.
- Cada campo mostra **valor atual, faixa permitida e o que aquilo faz** — sem isso o console vira
  um formulário de números mágicos, e quem mexe seis meses depois não sabe o que está mexendo.
- Quem não é admin vê a tela dizer que não é admin. **Não some, e não mente.**

### 5.3 Monstro por monstro

O pedido cita *"dano de monstros individuais"*. Hoje o pool de inimigos vive em
`src/game/mundo.ts` como constante de client, e **inimigo não causa dano econômico**: o dano por
ciclo é um número só, do servidor. Então:

- **vida, velocidade e raio por espécie** viram ajuste visual — mudam a cena;
- **"dano do monstro"** não existe como conceito hoje. Criar exigiria o dano por ciclo deixar de
  ser fixo e passar a depender de quais espécies apareceram — que é informação do client.
  **Fica fora**, com o motivo registrado.

## 6. Fora de escopo — e por quê

- **Dano por espécie afetando recompensa.** Ver 5.3: exigiria o client informar quem apareceu.
- **Segundo deploy para o admin.** Restrição de custo, e a proteção é o banco.
- **Vários admins com papéis diferentes.** Produto single-tenant, um dono. Um booleano basta;
  hierarquia é complexidade sem demanda.
- **Desfazer/versionar ajustes.** O log registra o que mudou, e voltar é digitar de novo.
- **Duração do ciclo (`c_ciclo_segundos`).** Decidido durante o build, e vale registrar o porquê:
  ela não é só balanceamento, é a **unidade de contabilidade do `last_seen_at`** — três funções de
  sessão fazem aritmética de resto com ela para não creditar o mesmo intervalo duas vezes.
  Torná-la editável exigiria reescrever `iniciar_sessao`, `validar_lote` e `coletar_farm_offline`
  por inteiro para obter o efeito que `abates_base` já obtém sozinho: dobrar abates por ciclo é o
  mesmo que dobrar a frequência do ciclo, e não mexe em nada que conte tempo.
- **O 2× do assinante.** Também decidido no build. É o que a pessoa **comprou**; um número que
  muda o que já foi vendido não é balanceamento, é outra coisa. Quem quiser mexer no ritmo geral
  mexe em `xp_multiplicador_global`, que existe justamente para isso e vale para todo mundo igual.

## 7. Critérios de aceite

1. **Nenhuma tabela de ajuste tem UPDATE para `authenticated`.** Nem admin escreve direto.
2. `definir_ajuste` **recusa quem não é admin**, e a recusa entra no log.
3. `definir_ajuste` **recusa valor fora da faixa** da própria linha.
4. `admin` está **fora do grant de UPDATE** de `jogador` — ninguém se promove.
5. Todo ajuste aplicado vira evento com **quem, quando, de quanto para quanto**.
6. Os valores econômicos são lidos **pelo servidor**; nenhuma RPC passa a receber número de
   balanceamento vindo do client.
7. O contrato continua valendo: **nenhuma RPC recebe tempo, recompensa, modo ou desempenho.**
8. As restrições permanentes continuam **estruturalmente** garantidas, mesmo com valor vindo de
   tabela: nenhum ajuste introduz sorteio em `comprar_ouro` nem em `conceder_recompensa_passe`.
9. A tela mostra **faixa e descrição** de cada campo, não só o número.
10. Não-admin vê a tela recusar, com o motivo escrito.
11. `npm test`, `npm run build` e `./scripts/pg-local.sh` verdes.

## 8. Edge cases

- **Ajuste que não existe na tabela** — a função que o lê cai no padrão embutido em vez de quebrar.
  Jogo que para porque uma linha sumiu é pior que jogo mal balanceado.
- **Dois admins editando ao mesmo tempo** — o último grava. Sem trava: é ajuste, não transação de
  valor.
- **Mudar XP por abate no meio de uma sessão** — vale do próximo lote em diante. Nada é recalculado
  para trás, porque o crédito já aconteceu — e recalcular retroativamente mexeria no saldo de quem
  já jogou.
- **Valor no limite da faixa** — aceito. A faixa é inclusiva.
- **Admin perde o acesso** (`admin = false`) — a tela passa a recusar no próximo carregamento; o
  que ele já ajustou continua valendo.

## 9. Definição de "aprovado sem ressalvas"

Os 11 critérios verificados; e as duas provas centrais por teste: **não-admin não escreve ajuste
nenhum** e **nenhum ajuste abre caminho para o client declarar ganho**.

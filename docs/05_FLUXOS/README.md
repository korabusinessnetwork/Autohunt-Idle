# 05 — FLUXOS · Autohunt Idle

> Os caminhos que o jogador percorre, do primeiro segundo ao apagar a conta.

Cada fluxo aqui responde três perguntas: **o que o jogador vê**, **o que o servidor decide**, e
**o que acontece quando dá errado**. A terceira é a que costuma faltar, e é a que o Princípio nº 1
cobra.

## 1. Abrir o jogo pela primeira vez

O fluxo mais importante do produto, porque é onde a promessa "qualquer pessoa entende sem tutorial"
é cumprida ou perdida.

```
abre a página
  → TelaCarregando ("Entrando no mundo…")
  → signInAnonymously (Supabase Auth)
  → iniciar_sessao()          ← cria jogador, farm_state, atributos, arma inicial
  → o jogador já está no mundo, no comando
```

**Não existe tela de boas-vindas, escolha de classe, nome ou tutorial** (core, 17). O jogador cai
direto no mundo — e desde a inversão de premissa, **no comando**: andar e atirar são a primeira
coisa que ele faz, e se explicam em cinco segundos porque são o que qualquer top-down faz.

**Quando dá errado:** `TelaErro` com título legível, mensagem sem culpa e botão de tentar de novo.
O código do erro aparece como detalhe, para suporte. Tela branca é o que o Princípio nº 1 proíbe
acima de tudo.

**Pré-requisito operacional:** `signInAnonymously` habilitado no projeto Supabase (D2). Sem isso,
todo mundo cai na tela de erro.

## 2. Jogar — manual, com o loop de 15 segundos por baixo

**Mudou em 2026-08-12** (`specs/mundo-aberto-e-modo-manual.md`): o jogo é manual. O jogador anda
com WASD/setas e mira com o mouse; no toque, joystick e mira automática.

```
entrada (teclado, mouse, toque) → intenção
motor (requestAnimationFrame, fora do React)
  ├── aplica a intenção, avança e desenha  ← puramente visual, não vale nada
  └── a cada 15 s: aoValidarLote()         ← "servidor, valida agora"
                     → validar_lote()
                     → snapshot novo: XP, moeda, nível, drops, passe
```

O callback **não transporta recompensa** — e, desde a inversão de premissa, também não transporta
**modo**. Quem calcula é o servidor, com o `now()` do Postgres e o poder de ataque. **Manual e auto
creditam exatamente o mesmo**, e é por isso que virar um jogo de verdade não custou nada em
segurança.

### 2b. O auto, e a trava que o sustenta

Auto é o produto: o personagem joga sozinho e você pode ir embora. Destrava por anúncio ou
assinatura, e tem **saldo próprio**, separado do farm offline.

**Sem auto destravado**, 2 minutos sem input encerram a sessão — pela mesma rota do fechar-aba,
sem nenhuma regra nova no servidor. O aviso aparece no canto, sem bronca e sem contagem
regressiva, e voltar a jogar reabre a sessão normalmente.

> Isto é **anti-ocioso, não anti-cheat**: pega quem levanta e sai, não quem escreve um script. O
> captcha, que pegaria o script, foi adiado pelo dono — e o buraco está registrado na spec.

**Quando o jogador perde um ciclo:** o herói pisca e continua farmando no mesmo instante. Sem tela
de morte, sem cooldown, sem nada retirado (core, 16).

## 3. Voltar depois de um tempo fora

**O momento mais importante do produto** (Princípio nº 1). Precisa ser legível de relance, sem
exigir leitura.

```
abre de novo
  → iniciar_sessao()
      servidor calcula: now() − last_seen_at, aplica o teto de desbloqueio,
      resolve ciclos, drops e dungeons acumuladas
  → TelaRetorno: tempo fora · tempo que rendeu · +XP · +ouro · dungeons
  → "Coletar tudo" → coletar_farm_offline()
```

Cada número na tela veio **pronto** do servidor. O client não recalcula nada a partir do relógio
local.

O bloco `motivo` explica em uma frase por que rendeu o que rendeu — creditado, teto de assinante,
teto de anúncio, sem desbloqueio, assinatura vencida. **Nenhuma das frases dá bronca por ter ficado
offline**, e isso é regra de tom registrada.

**Quando não há nada acumulado:** estado vazio com texto próprio ("Seu personagem tá farmando
agora"), não uma tela em branco nem um zero solto.

## 4. Desbloquear o farm offline — e o gate de idade

Este é o único ponto do jogo em que o cadastro é pedido, e a posição é deliberada:

```
"Caçada automática"
  → tem identidade verificada?
      não → ModalCadastro (e-mail, senha, DATA DE NASCIMENTO)
              → trigger do banco valida 18+ ANTES de criar credencial
              → menor de 18: recusado, e a conta anônima segue anônima
      sim → PainelDesbloqueio (anúncio ou assinatura)
```

**A data de nascimento vai primeiro, de propósito.** Se o trigger reprovar a idade, nenhuma
credencial foi criada — o gate não é uma tela que dá para pular, é uma constraint.

Ativar o farm offline é exatamente o momento em que a identidade permanente passa a ser necessária
(core, 18): antes disso, pedir cadastro seria fricção sem motivo.

## 5. Assistir anúncio

```
emitir_ticket_anuncio()     ← sem parâmetro: o SERVIDOR decide os minutos
  → SDK do provedor exibe o anúncio
  → callback do provedor → Edge Function → creditar_anuncio(ticket_id)
```

O ticket é de uso único, e o crédito acontece **contra o ticket**, nunca contra um pedido do
client. O jogador nunca diz quantos minutos ganhou.

**Hoje:** nenhum provedor plugado (P2). O botão aparece **desabilitado com o motivo escrito** —
não some, e não mente.

## 6. Dungeon

```
"Entrar na dungeon" → iniciar_dungeon()      ← sem parâmetro
     servidor: consome uma chave (for update skip locked),
               compara poder de ataque × dificuldade, decide, concede loot
  → venceu: loot raro garantido + 2 diamantes
  → perdeu: "A chave foi embora, mas você não perdeu nada além dela"
  → sem chave: recusa sem consumir nada
```

O client não escolhe a chave, não sabe a dificuldade e não declara o resultado.

## 7. Fortificar um item

O fluxo com mais transparência obrigatória do jogo:

```
PainelEquipamento → item equipado
  a tela mostra, ANTES do botão:
    · a chance exata em número
    · o custo exato em ouro
    · quantas pedras você tem
    · "Se falhar, você perde o material — o item continua igualzinho"
  → fortificar_item(item, usarSorte?, usarGarantia?)
```

Mostrar chance e custo em número **antes** da tentativa é restrição ética de transparência, não
enfeite. E o aviso de que falhar não rebaixa fica sempre visível, porque é a diferença entre esta
mecânica e a do jogo que a inspirou.

## 8. Comprar ouro

```
PainelLoja → cada pacote mostra quantidade e preço LADO A LADO, mesmo peso
  → comprar_ouro(pacote)
     servidor: trava a linha, confere saldo, debita e credita na mesma instrução
  → recusa sem consumir nada se faltar diamante
```

Nenhum dos dois números é a letra miúda do outro. E a linha "diamante você ganha derrotando o boss
da dungeon" fica sempre visível — o caminho gratuito não pode ser nota de rodapé.

## 9. Entrar no ranking

```
TelaRanking
  → tem cadastro? não → ModalCadastro (e volta para o ranking, não para o farm)
  → definir_apelido(apelido)
     colisão decidida pelo ÍNDICE ÚNICO, não por consulta prévia
```

Entre "verificar se está livre" e "gravar" cabe outro jogador gravando igual — por isso a colisão é
`unique_violation` traduzida, não um `select` antes.

**Sem apelido, joga-se normalmente** e fica-se fora do placar. Não é punição: é a opção de sair.

## 10. Exportar ou apagar os dados

```
Configurações → "Baixar meus dados"  → exportar_meus_dados() → JSON baixado
             → "Apagar minha conta"  → confirmação em duas etapas
                                        → aviso sobre assinatura no gateway
                                        → excluir_minha_conta()
                                        → sair() + conectar() → conta anônima nova
```

Nenhuma das duas RPCs recebe `player_id`: operam sobre `auth.uid()`, e **é a ausência do parâmetro
que garante o isolamento**.

A exclusão é irreversível, e a tela diz isso **antes** — prevenção de erro, não mensagem de erro.
O aviso sobre a cobrança que vive no gateway está lá pelo mesmo motivo.

## 11. O fluxo que ainda não existe

**Comprar assinatura ou passe.** Os dois botões aparecem desabilitados com o motivo escrito,
porque não há gateway contratado (P3). O *seam* está pronto dos dois lados: `ativar_passe` e
`aplicar_evento_assinatura` existem e são exclusivas de `service_role`, esperando webhook assinado.

## Ligações

- `docs/07_APIS/` — as RPCs de cada passo
- `docs/06_COMPONENTES/` — as telas
- `specs/game-idle-farm-core.md` — de onde vêm os critérios citados

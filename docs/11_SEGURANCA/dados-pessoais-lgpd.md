# Dados pessoais e LGPD — Autohunt Idle

> Inventário do que o jogo guarda, e o desenho dos dois direitos que ele já exerce em código:
> **exportar** e **excluir**.

## 1. Por que este documento existe

`README.md` dizia, desde a fundação, que o direito de exportar e excluir dados "não é feature
depois". O rascunho de termos promete os dois ao usuário, por escrito. Até 2026-08-11 **não havia
uma linha de código** — nem RPC, nem serviço, nem botão, nem teste.

A distância entre uma promessa em prosa e um botão que funciona é exatamente o tipo de coisa que
um plano de segurança tem que fechar em vez de repetir. Esta rodada fechou.

## 2. Inventário — o que o jogo guarda

| Dado | Onde | Natureza | Obrigatório? |
|---|---|---|---|
| E-mail | `auth.users` (Supabase) | Pessoal, identificador | Só depois do cadastro. Conta anônima não tem |
| Senha (hash) | `auth.users` | Credencial | Idem. **Nunca lida pelo nosso código** |
| Data de nascimento | `jogador.data_nascimento` | Pessoal, sensível por finalidade | Sim, no cadastro — **exigência legal**, ECA Digital |
| Apelido | `jogador.apelido` | Pseudônimo público | Não. Sem apelido, o jogador fica fora do placar |
| Idioma | `jogador.idioma` | Preferência | Não |
| Progressão | `jogador`, `farm_state`, `atributo_jogador`, `item_jogador` | Dado de uso, não pessoal isoladamente | Gerado jogando |
| Estado de assinatura | `assinatura.status`, `expira_em` | Dado contratual | Só para assinante |
| Referência no gateway | `assinatura.referencia_externa`, `provedor`, `passe_jogador.referencia_externa` | Dado do provedor | **Nunca concedido ao client**, e fora da exportação |
| Progresso do passe | `passe_jogador.ativo`, `pontos`, `tier` | Dado de uso e contratual | Só para quem comprou a trilha |
| Log de atividade | `evento_jogo` | Dado de uso | Gerado jogando |
| Dado de cartão | **nenhum lugar** | — | Processamento 100% do gateway |
| Token de sessão | `localStorage` do navegador, chave `autohunt.sessao` | Credencial local | Mecanismo padrão do SDK |

**Não coletamos:** nome civil, CPF, endereço, telefone, geolocalização, contatos, nem dado
biométrico. A verificação de idade é um campo de data validado — controle proporcional ao risco
deste produto, decisão registrada em `memory/restrictions.md` e revisitável se o público mudar.

## 3. Direito de acesso e portabilidade — `exportar_meus_dados()`

Devolve, num JSON só, tudo da tabela acima que pertence a quem chamou. Seções: `conta`,
`progresso`, `atributos`, `farm`, `assinatura`, `passe`, `itens`, `eventos`.

**Tabela nova de dado do jogador entra aqui junto, na mesma rodada.** Uma exportação que esquece
uma tabela é o direito de acesso virando promessa parcial — foi por isso que o passe entrou na
função na própria migration que criou a tabela, e não numa limpeza posterior.

**Três decisões de desenho valem registro:**

1. **A função não recebe parâmetro.** Nem `player_id`, nem nada. Opera exclusivamente sobre
   `auth.uid()`. Isso não é economia de digitação: **é a garantia de isolamento**. Não existe
   assinatura de função capaz de pedir a conta de outra pessoa, então não há validação que alguém
   possa esquecer de escrever. Provado por `as RPCs de LGPD não alcançam a conta de outro jogador`.
2. **Exportar é leitura pura.** Não coleta o farm pendente, não credita, não muda estado. O
   pendente sai como pendente. Provado por `exportar não credita nem coleta nada`.
3. **A referência do gateway fica de fora.** É identificador do jogador *dentro do provedor*, não
   dado que o titular precise para portabilidade — e incluí-la no JSON contradiria o grant que a
   esconde.

**Conta anônima exporta normalmente**, com `email` e `dataNascimento` nulos. Falhar seria pior:
uma conta sem cadastro ainda tem progressão, e progressão é dado do titular.

## 4. Direito de eliminação — `excluir_minha_conta()`

Apaga a linha de `auth.users`. O `on delete cascade` de `jogador` leva junto `farm_state`,
`atributo_jogador`, `item_jogador`, `assinatura`, `passe_jogador`, `ticket_anuncio`,
`evento_jogo` e `ranking_posicao`.

**Apagar em cascata, e não tabela por tabela, é escolha deliberada:** uma tabela criada amanhã já
nasce coberta pela cascata, enquanto uma lista explícita precisaria ser lembrada — e a lista que
alguém esquece de atualizar é exatamente como dado órfão sobrevive a uma exclusão. O teste de
fumaça confere as 9 tabelas uma a uma, incluindo `ranking_posicao`, a única com dado visível a
terceiros.

**Não existe "desativar".** Guardar o dado "por precaução" depois que o titular pediu eliminação é
o oposto do que a LGPD pede. A UI diz que é irreversível **antes** de fazer, com confirmação
explícita em duas etapas — prevenção de erro, não mensagem de erro.

### O buraco honesto: assinatura ativa

Excluir a conta apaga o nosso lado. **A cobrança recorrente vive no gateway, fora do nosso banco**,
e continua. Hoje a UI avisa em texto (`dados.excluir.avisoAssinatura`), pedindo para cancelar lá
antes.

Isso é uma **mitigação por aviso, não uma solução** — e está registrado como tal na ameaça 8.5. O
cancelamento automático na exclusão depende de gateway contratado (P3 do backlog). Quando P3
fechar, a exclusão deve chamar o cancelamento antes de apagar, e este parágrafo sai daqui.

## 4b. O log operacional — o dono lendo evento de terceiro

Desde 2026-08-12 o console do dono lê `evento_jogo` de **outros jogadores**, por
`log_operacional()`. É tratamento de dado pessoal de terceiro, e por isso a decisão está escrita
aqui e não só no código:

- **Finalidade:** auditoria de operação e de economia — quem mexeu no balanceamento, e para onde
  o valor circulou. Quando o mercado P2P existir, é o que torna investigável um caso de lavagem ou
  de golpe (`plano-mercado-p2p.md` §4.6).
- **Minimização:** não é a tabela inteira. `tipos_do_log_operacional()` é uma **lista fechada**, e
  o corte é declarado: entra o que move valor ou muda configuração; **presença, progressão e
  escolha pessoal ficam de fora**. Quando alguém jogou, por quanto tempo e como montou o
  personagem não são visíveis para o dono por caminho nenhum do produto.
- **Identificação:** o retorno traz `player_id` e o apelido. O identificador é necessário para a
  finalidade — rastro sem sujeito não investiga nada — e é o mesmo dado que já vive na tabela.
- **Retenção:** o log herda a da `evento_jogo`, e a exclusão de conta o apaga em cascata junto com
  o resto. **Não existe cópia fora da tabela.**
- **Transparência:** a tela publica a lista de tipos que mostra. Recorte invisível engana mais do
  que log nenhum.

Vale registrar o que **não** foi feito, porque era o caminho curto: uma policy de RLS
`using (public.e_admin())` em `evento_jogo`. Ela daria ao dono tudo o que qualquer jogador já
registrou — e, como `dados` é `jsonb` livre com `grant insert` para o client (item 5 da seção 6),
também tudo o que ainda vier a ser registrado. Isso é vigilância, não auditoria.

## 5. Base legal e retenção

- **Base legal:** a definir com advogado — provavelmente execução de contrato (Art. 7º, V) para a
  conta e a progressão, e obrigação legal (Art. 7º, II) para a data de nascimento, que existe
  porque o ECA Digital exige. **Este documento não é aconselhamento jurídico.**
- **Retenção:** enquanto a conta existir. Não há política de expurgo de conta inativa — decisão em
  aberto, e vale decidir antes do lançamento: conta abandonada é dado pessoal guardado sem
  finalidade.
- **Compartilhamento:** só com o gateway de pagamento (assinatura) e o provedor de anúncio
  (identificador de sessão). Nenhum dos dois recebe data de nascimento nem progressão.

## 6. O que continua aberto

| # | Item | Depende de |
|---|---|---|
| 1 | Cancelamento automático da assinatura na exclusão | P3 (gateway) |
| 2 | Política de retenção de conta inativa | Decisão do dono |
| 3 | Base legal exata por tipo de dado | Revisão jurídica |
| 4 | Confirmação de que o e-mail é mesmo do titular | P1 (confirmação de e-mail) |
| 5 | `evento_jogo` aceita `jsonb` livre do client — nada impede um `tipo` novo carregar PII | Convenção, sem teste (ameaça 8.6) |

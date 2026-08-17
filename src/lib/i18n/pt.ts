// Dicionário português — a língua de referência.
//
// `ChaveI18n` (em `chaves.ts`) é derivada DESTE objeto, e `en.ts` é tipado como
// `Record<ChaveI18n, string>`. Consequência prática: acrescentar uma chave aqui
// sem acrescentar em `en.ts` quebra `npm run build`. É o critério 13 do core
// ("nenhuma string nasce sem as duas versões") virando erro de compilação em
// vez de promessa.
//
// Tom (memory/identity.md): leve, engraçadinho, nunca corporativo, e NUNCA dá
// bronca por ter ficado offline.

export const pt = {
  // --- Estados de carregamento e erro -------------------------------------
  'app.carregando': 'Entrando no mundo…',
  'app.erro.titulo': 'Não deu pra conectar',
  'app.erro.mensagem': 'A conexão com o servidor falhou. Sem estresse, dá pra tentar de novo.',
  'app.erro.tentarDeNovo': 'Tentar de novo',

  // --- HUD ----------------------------------------------------------------
  'hud.nivel': 'Nível',
  'hud.moeda': 'Ouro',
  'hud.diamante': 'Diamantes',
  'hud.vitalidade': 'Vitalidade',
  'hud.retrato': 'Seu personagem',
  'hud.xpParaProximo': '{atual} / {alvo} XP',
  'hud.modo': 'Modo',
  'hud.auto.ligado': 'Automático',
  'hud.auto.desligado': 'Você no comando',
  'hud.auto.saldo': '{minutos} min de automático',
  'hud.auto.bloqueado': 'Automático precisa de anúncio ou assinatura',
  "ocioso.titulo": 'Você deu uma pausa',
  "ocioso.explicacao": 'Ficou um tempinho sem mexer, então o jogo parou por aqui. Nada do que você já ganhou se perdeu.',
  "ocioso.voltar": 'Voltar a jogar',
  "ocioso.querAuto": 'Quero que jogue sozinho',
  'hud.aoVivo': 'Farmando ao vivo',
  'hud.ativarOffline': 'Caçada automática',
  // Rótulo da barra de ícones. Só o leitor de tela lê — na tela, o que aparece
  // são os ícones com os rótulos deles.
  'hud.acoes': 'Painéis do jogo',

  // --- Paginação ----------------------------------------------------------
  // Nenhum menu rola: o que não cabe vira página. Estes três rótulos são o
  // controle inteiro, e só aparecem quando existe mais de uma página.
  'paginacao.contador': '{pagina} de {paginas}',
  'paginacao.anterior': 'Página anterior',
  'paginacao.proxima': 'Próxima página',

  // --- Mapa ---------------------------------------------------------------
  // Mapa é CENÁRIO: um mapa avançado não rende mais nada, e por isso nenhum
  // texto daqui promete recompensa maior. O que ele vende é lugar novo.
  'mapa.titulo': 'Mapa',
  'mapa.explicacao':
    'Oito lugares pra explorar, um por tema. O que muda é a paisagem e o bicho que mora lá — o que você ganha continua saindo do tempo que você joga.',
  'mapa.faixaDeNivel': 'Nível {de} a {ate}',
  'mapa.viajar': 'Ir pra lá',
  'mapa.vocEstaAqui': 'Você está aqui',
  'mapa.faltamNiveis': 'Faltam {niveis} níveis',
  'mapa.alemDaUltimaLeva':
    'Você já passou do nível {nivel} — os mapas novos ainda estão sendo desenhados. Até lá, o Céu de Confete é a sua casa.',

  // --- Login --------------------------------------------------------------
  'login.titulo': 'Entrar na sua conta',
  'login.explicacao': 'Já tem conta aqui? Entra que seu personagem tá te esperando.',
  'login.entrar': 'Entrar',
  'login.entrando': 'Entrando…',
  'login.minhaConta': 'Minha conta',
  'login.naoTenhoConta': 'Ainda não tenho conta',
  'login.avisoConvidado':
    'Você tá jogando como convidado. Entrar em outra conta deixa esse progresso pra trás — se quiser guardar ele, cria uma conta antes.',
  'login.erro.SENHA_OBRIGATORIA': 'Falta a senha.',
  'login.erro.LOGIN_INVALIDO': 'E-mail ou senha não conferem. Tenta de novo.',

  // --- Tela de retorno ----------------------------------------------------
  'retorno.titulo': 'Enquanto você tava fora',
  'retorno.tempoFora': 'Você ficou {tempo} fora',
  'retorno.tempoRendido': 'Rendeu por {tempo}',
  'retorno.xpGanho': '+{valor} XP',
  'retorno.moedaGanha': '+{valor} de ouro',
  'retorno.coletar': 'Coletar tudo',
  'retorno.coletando': 'Coletando…',
  'retorno.voltarAoJogo': 'Voltar pro jogo',
  'retorno.vazio.titulo': 'Nada acumulado ainda',
  'retorno.vazio.mensagem': 'Seu personagem tá farmando agora. Volta depois pra ver o bolo.',

  'retorno.motivo.creditado': 'Rendeu o tempo inteiro que você ficou fora.',
  'retorno.motivo.teto_assinante':
    'Sua assinatura rende até 24h por ausência — foi exatamente o que você levou.',
  'retorno.motivo.teto_anuncio':
    'Rendeu até onde seus minutos de anúncio cobriam. O resto do tempo não foi salvo.',
  'retorno.motivo.sem_desbloqueio':
    'Esse tempo não foi salvo: farm offline precisa de assinatura ou de minutos de anúncio.',
  'retorno.motivo.assinatura_vencida':
    'Sua assinatura chegou ao fim do período pago, então o que estava acumulado e não coletado foi zerado.',
  'retorno.motivo.primeira_sessao': 'Boa! Seu personagem já tá farmando.',

  // --- Anúncio recompensado -----------------------------------------------
  'anuncio.assistir': 'Assistir anúncio (+{minutos} min offline)',
  'anuncio.carregando': 'Carregando anúncio…',
  'anuncio.saldo': '{minutos} min de farm offline no bolso',
  'anuncio.restanteHoje': 'Dá pra desbloquear mais {minutos} min hoje',
  'anuncio.indisponivel.TETO_DIARIO_ATINGIDO':
    'Você já desbloqueou as 2h de hoje. Volta amanhã que reseta.',
  'anuncio.indisponivel.SALDO_JA_NO_TETO':
    'Seu bolso de farm offline já tá cheio (2h). Gasta esse tempo antes de pegar mais.',
  'anuncio.indisponivel.ASSINANTE_NAO_PRECISA':
    'Você assina — já tem 24h por dia, sem anúncio nenhum.',
  'anuncio.indisponivel.SEM_PROVEDOR':
    'Anúncio recompensado ainda não está disponível nesta versão.',
  'anuncio.erro': 'O anúncio não completou, então nada foi creditado.',

  // --- Desbloqueio de farm offline ----------------------------------------
  // Título neutro, usado onde o canal proíbe qualquer elemento de compra
  // (a Poki proíbe sem exceção — ver docs/01_ARQUITETURA/publicacao-portais.md).
  'desbloqueio.titulo': 'Farm com o jogo fechado',

  // --- Assinatura ---------------------------------------------------------
  'assinatura.ativa': 'Assinante — 24h de farm por dia e 2x XP',
  'assinatura.inativa': 'Sem assinatura — farm offline só com anúncio',
  'assinatura.indisponivel': 'A assinatura ainda não está aberta nesta versão.',

  // --- Cadastro (gate de idade) -------------------------------------------
  'cadastro.titulo': 'Pra guardar seu progresso offline',
  'cadastro.explicacao':
    'Seu personagem já é seu — só falta um e-mail pra ele continuar rendendo com o jogo fechado.',
  'cadastro.email': 'E-mail',
  'cadastro.senha': 'Senha',
  'cadastro.dataNascimento': 'Data de nascimento',
  'cadastro.avisoIdade': 'Autohunt Idle é para maiores de 18 anos.',
  'cadastro.enviar': 'Criar meu acesso',
  'cadastro.enviando': 'Criando…',
  'cadastro.agoraNao': 'Agora não',
  'cadastro.erro.IDADE_MINIMA_NAO_ATINGIDA': 'É preciso ter 18 anos ou mais para jogar.',
  'cadastro.erro.DATA_NASCIMENTO_INVALIDA': 'Essa data de nascimento não parece válida.',
  'cadastro.erro.DATA_NASCIMENTO_OBRIGATORIA': 'Informe sua data de nascimento.',
  'cadastro.erro.EMAIL_INVALIDO': 'Esse e-mail não parece válido.',
  'cadastro.erro.SENHA_CURTA': 'A senha precisa de pelo menos 8 caracteres.',
  'cadastro.erro.EMAIL_EM_USO': 'Esse e-mail já tem conta. Seu progresso aqui continua intacto.',
  'cadastro.erro.CADASTRO_FALHOU': 'Não deu pra criar o acesso agora. Tenta de novo?',
  'cadastro.confirme.titulo': 'Falta um clique no seu e-mail',
  'cadastro.confirme.explicacao':
    'Mandamos um link de confirmação pra {email}. Abre ele pra liberar o farm offline.',
  'cadastro.confirme.calmo':
    'Nada se perdeu: seu personagem e tudo que ele já ganhou continuam aqui, do jeito que estavam.',
  'cadastro.confirme.ok': 'Voltar pro jogo',

  // --- Atributos ----------------------------------------------------------
  'atributos.titulo': 'Atributos',
  'atributos.pontosLivres': '{pontos} pontos livres',
  // O efeito de cada atributo de dano cita as ARMAS, não o adjetivo do canal.
  // "Dano físico" obrigava o jogador a descobrir sozinho que o martelo dele é
  // físico; "Dano de espada e martelo" responde a pergunta que ele realmente
  // tem — *este atributo mexe na minha arma?* — sem vocabulário novo. Isso
  // passou a ser decisivo quando o atributo que não casa deixou de contar
  // metade e passou a contar zero.
  'atributos.forca': 'Força',
  'atributos.forca.efeito': 'Dano de espada e martelo',
  'atributos.destreza': 'Destreza',
  'atributos.destreza.efeito': 'Dano de arco e adaga',
  'atributos.inteligencia': 'Inteligência',
  'atributos.inteligencia.efeito': 'Dano de cajado e varinha',
  'atributos.vitalidade': 'Vitalidade',
  'atributos.vitalidade.efeito': 'Aguenta mais antes de cair',
  'atributos.sorte': 'Sorte',
  'atributos.sorte.efeito': 'Chance de item melhor (chega com as dungeons)',
  // Selo da linha do atributo que casa com a arma EQUIPADA. Minúsculo porque é
  // aposto do nome ("Destreza · sua arma"), não título.
  'atributos.suaArma': 'sua arma',
  'atributos.custoProximo': 'Próximo: {custo} pt',
  'atributos.subir': 'Subir {atributo}',
  'atributos.descer': 'Descer {atributo}',
  'atributos.zerar': 'Zerar tudo',
  'atributos.manual':
    'Cada nível te dá 1 ponto. Gasta como quiser — e pode mudar de ideia quando quiser, de graça.',
  'atributos.salvar': 'Salvar',
  'atributos.salvando': 'Salvando…',
  'atributos.semAlteracao': 'Nada mudou ainda',
  'atributos.erro.PONTOS_INSUFICIENTES': 'Você não tem pontos suficientes para essa distribuição.',
  'atributos.erro.ATRIBUTO_INVALIDO': 'Essa distribuição não é válida.',
  'atributos.erro.ATRIBUTO_FALHOU': 'Não deu pra salvar agora. Tenta de novo?',

  // --- Ranking ------------------------------------------------------------
  'ranking.titulo': 'Ranking global',
  'ranking.posicao': '#{posicao}',
  'ranking.nivel': 'Nv {nivel}',
  'ranking.suaPosicao': 'Você está em #{posicao}',
  'ranking.vazio.titulo': 'O placar ainda tá vazio',
  'ranking.vazio.mensagem': 'Ninguém entrou ainda. Escolhe um apelido e seja o primeiro.',
  'ranking.carregando': 'Carregando o placar…',
  'ranking.erro': 'Não deu pra carregar o placar agora.',
  'ranking.apelido.titulo': 'Como você quer aparecer?',
  'ranking.apelido.explicacao':
    'Só quem escolhe um apelido aparece no placar. Sem apelido, você joga normalmente e fica de fora.',
  'ranking.apelido.campo': 'Apelido',
  'ranking.apelido.enviar': 'Entrar no ranking',
  'ranking.apelido.enviando': 'Entrando…',
  'ranking.apelido.erro.APELIDO_TAMANHO_INVALIDO': 'O apelido precisa ter de 3 a 20 caracteres.',
  'ranking.apelido.erro.APELIDO_CARACTERE_INVALIDO': 'Esse apelido tem caractere que não vale.',
  'ranking.apelido.erro.APELIDO_EM_USO': 'Esse apelido já é de outro jogador. Escolhe outro?',
  'ranking.apelido.erro.APELIDO_FALHOU': 'Não deu pra salvar o apelido agora. Tenta de novo?',
  'ranking.cadastro.titulo': 'O placar pede um acesso',
  'ranking.cadastro.explicacao':
    'Apelido no ranking é só seu, e ninguém mais pode usar — por isso ele precisa de uma conta que não se perca. Jogar continua livre sem isso.',
  'ranking.cadastro.criar': 'Criar meu acesso',

  // --- Raridade (10 tiers) ------------------------------------------------
  'raridade.comum': 'Comum',
  'raridade.incomum': 'Incomum',
  'raridade.raro': 'Raro',
  'raridade.epico': 'Épico',
  'raridade.lendario': 'Lendário',
  'raridade.caramelizado': 'Caramelizado',
  'raridade.glaceado': 'Glaceado',
  'raridade.dourado': 'Dourado',
  'raridade.cristalizado': 'Cristalizado',
  'raridade.cosmico': 'Cósmico',

  // --- Itens e mochila ----------------------------------------------------
  'item.arma': 'Arma',
  'item.capacete': 'Capacete',
  'item.armadura': 'Armadura',
  'item.luva': 'Luva',
  'item.bota': 'Bota',
  'item.acessorio': 'Acessório',
  'item.pedra_fortificacao': 'Pedra de Fortificação',
  'item.pedra_sorte': 'Pedra da Sorte',
  'item.pedra_garantia': 'Pedra de Garantia',
  'item.skin': 'Skin',
  'item.chave': 'Chave',

  // --- Nome da peça -------------------------------------------------------
  // Uma peça se chama BASE + RARIDADE ("Espada lendária", "Cajado cósmico"), e
  // não pelo slot que ela ocupa. Ver `features/mochila/nomeDoItem.ts`.
  //
  // Em português o adjetivo vem depois e concorda em gênero; em inglês vem
  // antes e não concorda. É por isso que o formato é uma chave traduzível, e
  // não uma concatenação no código — e por isso existem duas tabelas de
  // adjetivo, `m` e `f`, que em inglês apontam para a mesma palavra.
  'item.nome': '{base} {adjetivo}',
  'item.base.espada': 'Espada',
  'item.base.adaga': 'Adaga',
  'item.base.arco': 'Arco',
  'item.base.martelo': 'Martelo',
  'item.base.cajado': 'Cajado',
  'item.base.varinha': 'Varinha',
  'item.adj.m.comum': 'comum',
  'item.adj.m.incomum': 'incomum',
  'item.adj.m.raro': 'raro',
  'item.adj.m.epico': 'épico',
  'item.adj.m.lendario': 'lendário',
  'item.adj.m.caramelizado': 'caramelizado',
  'item.adj.m.glaceado': 'glaceado',
  'item.adj.m.dourado': 'dourado',
  'item.adj.m.cristalizado': 'cristalizado',
  'item.adj.m.cosmico': 'cósmico',
  'item.adj.f.comum': 'comum',
  'item.adj.f.incomum': 'incomum',
  'item.adj.f.raro': 'rara',
  'item.adj.f.epico': 'épica',
  'item.adj.f.lendario': 'lendária',
  'item.adj.f.caramelizado': 'caramelizada',
  'item.adj.f.glaceado': 'glaceada',
  'item.adj.f.dourado': 'dourada',
  'item.adj.f.cristalizado': 'cristalizada',
  'item.adj.f.cosmico': 'cósmica',

  'mochila.titulo': 'Mochila',
  'mochila.chaves': '{quantidade} chaves de dungeon',
  'mochila.vazia.titulo': 'Mochila vazia por enquanto',
  'mochila.vazia.mensagem': 'Seu personagem tá farmando. O primeiro item cai logo.',
  'mochila.quantidade': '{quantidade}x',
  'mochila.equipar': 'Equipar',
  'mochila.equipada': 'Em uso',
  'mochila.poder': 'Poder de ataque: {poder}',
  'mochila.slot.arma': 'Arma',
  'mochila.slot.capacete': 'Capacete',
  'mochila.slot.armadura': 'Armadura',
  'mochila.slot.luva': 'Luva',
  'mochila.slot.bota': 'Bota',
  'mochila.slot.acessorio': 'Acessório',
  'mochila.slot.skin': 'Skin',
  'mochila.equipamento': 'Equipamento',
  'mochila.aba.itens': 'Itens',
  'mochila.verAtributos': 'Ver atributos',
  'mochila.slot.vazio': 'Vazio',
  'mochila.arrastarDica': 'Arraste uma peça até o slot dela para vestir — ou use o botão Equipar.',
  'mochila.erroAoEquipar': 'Não deu pra vestir essa peça agora. Tenta de novo?',
  'item.detalhe.ver': 'Ver atributos desta peça',
  'item.detalhe.poder': 'Poder da peça: {poder}',
  'item.detalhe.fortificacao': 'Fortificada +{nivel} — rende {ganho}% a mais que sem fortificação',
  'item.detalhe.semFortificacao': 'Sem fortificação ainda — dá pra subir até +{teto}',
  'item.detalhe.dano': 'Tipo de dano: {dano}',
  'item.detalhe.afinidade': 'Afinidade: {dano}',
  'item.detalhe.conjunto': 'Conjunto: {conjunto}',
  'mochila.semStat': 'Skin não muda nenhum número — é só aparência.',

  // --- Tipo de dano, afinidade e conjunto ---------------------------------
  // O canal de dano é chamado pelo NOME DO ATRIBUTO, não por um adjetivo. Com
  // dois canais dava para conviver com dois vocabulários ("Físico" na peça,
  // "Força" no painel); com três, o jogador teria de decorar uma tabela de
  // tradução para saber o que upar. Assim "Tipo de dano: Destreza" já é a
  // resposta inteira.
  'dano.fisico': 'Força',
  'dano.destreza': 'Destreza',
  'dano.magico': 'Inteligência',
  'afinidade.combina': 'Combina com sua arma (+20%)',
  'afinidade.naoCombina': 'Não combina com sua arma',
  'conjunto.bruxa-caramelo': 'Conjunto da Bruxa Caramelo',
  'conjunto.cavaleiro-biscoito': 'Conjunto do Cavaleiro Biscoito',
  'conjunto.feiticeira-menta': 'Conjunto da Feiticeira Menta',
  'conjunto.brutamontes-nougat': 'Conjunto do Brutamontes Nougá',
  // Os dois conjuntos de Destreza. Existem para que o arqueiro alcance o
  // degrau de 6 peças igual às outras builds — sem eles, o canal novo nasceria
  // com metade do teto de poder dos antigos.
  'conjunto.arqueira-avela': 'Conjunto da Arqueira de Avelã',
  'conjunto.ladina-amora': 'Conjunto da Ladina de Amora',
  'conjunto.pecas': '{pecas} de 6 peças',
  'conjunto.bonus2': 'Bônus de 2 peças ativo',
  'conjunto.bonus3': 'Conjunto completo — bônus cheio',

  // --- Dungeon ------------------------------------------------------------
  'dungeon.entrar': 'Entrar na dungeon',
  'dungeon.entrando': 'Entrando…',
  'dungeon.semChave': 'Você precisa de uma chave. Elas caem no mundo aberto e nos mini bosses.',
  'dungeon.venceu': 'Boss derrotado! Loot raro garantido.',
  'dungeon.perdeu': 'O boss aguentou dessa vez. A chave foi embora, mas você não perdeu nada além dela.',
  'dungeon.offline': '{resolvidas} dungeons enquanto você tava fora',

  // --- Síntese ------------------------------------------------------------
  'sintese.titulo': 'Síntese',
  'sintese.abrir': 'Combinar itens',
  'sintese.explicacao': 'Junte 9 itens iguais e eles viram 1 do tier de cima. Sem pagar nada.',
  'sintese.vazia.titulo': 'Nada pra combinar ainda',
  'sintese.vazia.mensagem': 'Assim que os itens repetidos forem caindo, eles aparecem aqui.',
  'sintese.combinar': 'Combinar 9',
  'sintese.combinando': 'Combinando…',
  'sintese.faltam': 'Faltam {faltam} para combinar',
  'sintese.erro.ITENS_INSUFICIENTES': 'Você não tem 9 itens iguais aí.',
  'sintese.erro.TIER_MAXIMO': 'Cósmico é o topo — não dá pra subir mais.',
  'sintese.erro.SINTESE_FALHOU': 'Não deu pra combinar agora. Tenta de novo?',

  // --- Fortificação -------------------------------------------------------
  'fort.titulo': 'Fortificar',
  'fort.nivel': '+{nivel}',
  'fort.chance': '{chance}% de dar certo',
  'fort.custo': 'Custa {ouro} de ouro',
  'fort.pedras': '{fortificacao} pedras · {sorte} sorte · {garantia} garantia',
  'fort.usarSorte': 'Usar Pedra da Sorte (+15%)',
  'fort.usarGarantia': 'Usar Pedra de Garantia (sucesso certo)',
  'fort.tentar': 'Fortificar',
  'fort.tentando': 'Fortificando…',
  'fort.semPunicao': 'Se falhar, você perde o material — o item continua igualzinho.',
  'fort.sucesso': 'Deu certo! Agora é +{nivel}.',
  'fort.falhou': 'Não pegou dessa vez. O item tá intacto, só o material foi.',
  'fort.erro.TETO_ATINGIDO': 'Esse item já tá no máximo.',
  'fort.erro.OURO_INSUFICIENTE': 'Falta ouro para essa tentativa.',
  'fort.erro.SEM_PEDRA': 'Você não tem a pedra necessária.',
  'fort.erro.ITEM_NAO_FORTIFICAVEL': 'Esse item não dá pra fortificar.',
  'fort.erro.FORTIFICACAO_FALHOU': 'Não deu pra fortificar agora. Tenta de novo?',

  // --- Loja de ouro -------------------------------------------------------
  // A quantidade aparece inteira, no cartão, antes do botão. É o que o
  // critério 4 da spec exige — e é o oposto de "pague e veja o que vem".
  'loja.titulo': 'Loja de ouro',
  'loja.explicacao': 'Troque diamante por ouro. A quantidade é fixa: o que tá escrito é o que você recebe.',
  'loja.pacote.punhado': 'Punhado',
  'loja.pacote.saco': 'Saco',
  'loja.pacote.bau': 'Baú',
  'loja.ouro': '{ouro} de ouro',
  'loja.preco': '{diamantes} diamantes',
  'loja.comprar': 'Trocar',
  'loja.comprando': 'Trocando…',
  'loja.comprou': 'Pronto! +{ouro} de ouro.',
  'loja.comoGanhar': 'Diamante você ganha derrotando o boss da dungeon.',
  'loja.vazia': 'Nenhum pacote disponível agora.',
  'loja.erro.DIAMANTE_INSUFICIENTE': 'Falta diamante para esse pacote.',
  'loja.erro.PACOTE_INDISPONIVEL': 'Esse pacote não tá mais à venda.',
  'loja.erro.COMPRA_FALHOU': 'Não deu pra trocar agora. Tenta de novo?',

  // --- Passe de recompensas -----------------------------------------------
  // Nenhuma string aqui tem prazo, contagem regressiva ou "última chance" — a
  // trilha não expira, e a ausência de urgência é a decisão de produto
  // (`specs/passe-de-recompensas.md`, nota de design).
  'passe.titulo': 'Trilha de recompensas',
  'passe.ativo': 'Sua trilha tá rolando',
  'passe.inativo': 'Você ainda não tem a trilha',
  'passe.explicacao': 'Com a trilha ativa, jogar normalmente vai destravando cada prêmio abaixo.',
  'passe.semPrazo': 'Sem prazo: o que você destravar é seu pra sempre, mesmo se cancelar depois.',
  'passe.tier': '{tier}º',
  'passe.custa': '{pontos} pts',
  'passe.destravado': 'Destravado',
  'passe.exclusiva': 'Só na trilha',
  'passe.faltam': 'Faltam {pontos} pts pro {tier}º prêmio',
  'passe.completa': 'Você destravou a trilha inteira.',
  'passe.comprar': 'Ativar a trilha',
  'passe.indisponivel': 'A trilha ainda não está à venda nesta versão.',

  // --- Configurações ------------------------------------------------------
  'config.titulo': 'Configurações',
  'config.idioma': 'Idioma',
  'config.idioma.pt': 'Português',
  'config.idioma.en': 'Inglês',
  'config.fechar': 'Fechar',

  // --- Dados pessoais (LGPD) ----------------------------------------------
  // O tom continua o da casa: nada de juridiquês. O jogador precisa entender o
  // que cada botão faz sem abrir o termo de uso.
  'dados.titulo': 'Seus dados',
  'dados.explicacao': 'Tudo que o jogo guarda sobre você é seu. Dá pra baixar ou apagar quando quiser.',
  'dados.exportar': 'Baixar meus dados',
  'dados.exportando': 'Preparando…',
  'dados.exportado': 'Pronto, o arquivo foi baixado.',
  'dados.excluir': 'Apagar minha conta',
  'dados.excluir.confirmacao':
    'Isso apaga tudo: personagem, itens, ouro, diamante e progresso. Não dá pra desfazer.',
  'dados.excluir.avisoAssinatura':
    'Se você assina, cancele a assinatura antes — apagar a conta aqui não interrompe a cobrança.',
  'dados.excluir.confirmar': 'Apagar mesmo assim',
  'dados.excluir.cancelar': 'Deixa quieto',
  'dados.excluindo': 'Apagando…',
  'dados.erro.EXPORTACAO_FALHOU': 'Não deu pra preparar o arquivo agora. Tenta de novo?',
  'dados.erro.EXCLUSAO_FALHOU': 'Não deu pra apagar a conta agora. Tenta de novo?',

  // --- Tempo --------------------------------------------------------------
  'tempo.minutos': '{valor} min',
  'tempo.horas': '{valor}h',
  'tempo.horasEMinutos': '{horas}h {minutos}min',

  // --- Mundo e inimigos ---------------------------------------------------
  // Os nomes em inglês NÃO são tradução literal (core, critério 14) — cada um
  // ganhou um trocadilho próprio que funciona no idioma. Ver `en.ts`.
  'mundo.bioma1': 'Floresta de Algodão-Doce',
  'mundo.bioma2': 'Vale das Geleias',
  'mundo.bioma3': 'Deserto de Açúcar Queimado',
  'mundo.bioma4': 'Recife de Pirulito',
  'mundo.bioma5': 'Montanhas de Chocolate',
  'mundo.bioma6': 'Geleira de Menta',
  'mundo.bioma7': 'Vulcão de Goma',
  'mundo.bioma8': 'Céu de Confete Cósmico',
  'inimigo.casquinha': 'Casquinha',
  'inimigo.minhoca': 'Minhoca Azeda',
  'inimigo.rosquinha': 'Rosquinha Brutamontes',
  'inimigo.pirulito': 'Pirulito Valentão',
  'inimigo.pudim': 'Pudim Conformado',

  // Um inimigo assinatura por bioma — soma ao pool base, nunca substitui.
  'inimigo.algodao': 'Algodão Fofo',
  'inimigo.geleia': 'Gelatinho Mole',
  'inimigo.toffee': 'Caco de Caramelo',
  'inimigo.concha': 'Concha Chiclete',
  'inimigo.trufa': 'Trufa Pesada',
  'inimigo.floco': 'Floco Afiado',
  'inimigo.brasa': 'Brasa de Goma',
  'inimigo.confete': 'Confete Cósmico',

  // --- Console de ajuste (tela do dono, não do jogador) --------------------
  // Está no bundle de todo mundo de propósito: esconder a rota seria segurança
  // por obscuridade. Quem protege é o banco (`specs/console-de-ajuste.md`).
  'console.titulo': 'Console de ajuste',
  'console.fechar': 'Fechar',
  'console.carregando': 'Buscando os números…',
  'console.explicacao':
    'Cada número aqui vale pro jogo inteiro, na hora. O que já foi creditado não é recalculado.',
  'console.negado.titulo': 'Isto aqui não é pra você.',
  'console.negado.mensagem':
    'Só a conta do dono edita estes números. Você pode olhar, mas o servidor recusa qualquer alteração.',
  'console.faixa': 'de {minimo} a {maximo}',
  'console.salvar': 'Salvar',
  'console.salvo': 'Salvo! Já vale a partir do próximo ciclo.',
  'console.escopo.visual': 'visual',
  'console.escopo.visual.ajuda': 'Muda o que aparece na tela. Não mexe em XP nem em ouro.',
  'console.escopo.economico': 'economia',
  'console.escopo.economico.ajuda': 'Muda quanto todo mundo ganha. Lido só pelo servidor.',
  'console.categoria.heroi': 'Herói',
  'console.categoria.inimigo': 'Inimigos',
  'console.categoria.mundo': 'Mundo',
  'console.categoria.economia': 'Economia',
  'console.rodape': 'Toda alteração fica registrada com quem mexeu, quando, e de quanto pra quanto.',
  'console.erro.NAO_AUTORIZADO': 'O servidor recusou: esta conta não é de administrador.',
  'console.erro.FORA_DA_FAIXA': 'Valor fora da faixa permitida pra este número.',
  'console.erro.AJUSTE_INEXISTENTE': 'Esse ajuste não existe mais no servidor.',
  'console.erro.VALOR_INVALIDO': 'Precisa ser um número.',
  'console.erro.AJUSTE_FALHOU': 'Não deu pra salvar agora. Tenta de novo.',
  'console.erro.AJUSTES_NAO_CARREGARAM': 'Não deu pra carregar os ajustes.',
  'console.erro.CONFIGURACAO_AUSENTE': 'O jogo ainda não está ligado a um servidor (ver .env.example).',
  'console.aba.ajustes': 'Números do jogo',
  'console.aba.log': 'Log',
  'console.log.titulo': 'Log operacional',
  'console.log.carregando': 'Buscando o rastro…',
  'console.log.explicacao':
    'Tudo que mexeu em número, em dinheiro ou em valor dentro do jogo — mais recente primeiro.',
  'console.log.filtrar': 'Filtrar por tipo',
  'console.log.todos': 'tudo',
  'console.log.carregarMais': 'Carregar mais',
  'console.log.vazio.titulo': 'Nada aconteceu ainda',
  'console.log.vazio.mensagem': 'Assim que alguém mexer num número ou gastar alguma coisa, aparece aqui.',
  'console.log.negado':
    'O log é o rastro de quem mexeu no jogo. Só a conta do dono lê, e a sua tentativa fica registrada.',
  'console.log.recorte':
    'O log mostra só o que move valor ou muda configuração. Quando alguém jogou, por quanto tempo, e como montou o personagem ficam de fora de propósito — isso é comportamento, não operação.',
  'console.log.erro': 'Não deu pra carregar o log.',
} as const

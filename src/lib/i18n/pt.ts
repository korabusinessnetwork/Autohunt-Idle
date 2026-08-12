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
  'hud.ativarOffline': 'Render com o jogo fechado',

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

  // --- Atributos ----------------------------------------------------------
  'atributos.titulo': 'Atributos',
  'atributos.pontosLivres': '{pontos} pontos livres',
  'atributos.autoAlocado':
    'Seus pontos são distribuídos sozinhos. Mexer aqui é opcional — e sempre reversível.',
  'atributos.forca': 'Força',
  'atributos.forca.efeito': 'Dano físico',
  'atributos.inteligencia': 'Inteligência',
  'atributos.inteligencia.efeito': 'Dano mágico',
  'atributos.vitalidade': 'Vitalidade',
  'atributos.vitalidade.efeito': 'Aguenta mais antes de cair',
  'atributos.sorte': 'Sorte',
  'atributos.sorte.efeito': 'Chance de item melhor (chega com as dungeons)',
  'atributos.custoProximo': 'Próximo: {custo} pt',
  'atributos.subir': 'Subir {atributo}',
  'atributos.descer': 'Descer {atributo}',
  'atributos.zerar': 'Zerar tudo',
  'atributos.voltarAoAutomatico': 'Deixar o jogo distribuir',
  'atributos.manual': 'Você está distribuindo à mão.',
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
  'mochila.slot.vazio': 'Vazio',
  'mochila.semStat': 'Skin não muda nenhum número — é só aparência.',

  // --- Tipo de dano, afinidade e conjunto ---------------------------------
  'dano.fisico': 'Físico',
  'dano.magico': 'Mágico',
  'afinidade.combina': 'Combina com sua arma (+20%)',
  'afinidade.naoCombina': 'Não combina com sua arma',
  'conjunto.bruxa-caramelo': 'Conjunto da Bruxa Caramelo',
  'conjunto.cavaleiro-biscoito': 'Conjunto do Cavaleiro Biscoito',
  'conjunto.feiticeira-menta': 'Conjunto da Feiticeira Menta',
  'conjunto.brutamontes-nougat': 'Conjunto do Brutamontes Nougá',
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
  'sintese.explicacao': 'Junte 9 itens iguais e eles viram 1 do tier de cima. Sem pagar nada.',
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
} as const

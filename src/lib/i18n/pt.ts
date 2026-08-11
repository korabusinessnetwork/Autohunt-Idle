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
  'hud.moeda': 'Moedas',
  'hud.vitalidade': 'Vitalidade',
  'hud.xpParaProximo': '{atual} / {alvo} XP',
  'hud.aoVivo': 'Farmando ao vivo',
  'hud.validando': 'Salvando progresso…',

  // --- Tela de retorno ----------------------------------------------------
  'retorno.titulo': 'Enquanto você tava fora',
  'retorno.tempoFora': 'Você ficou {tempo} fora',
  'retorno.tempoRendido': 'Rendeu por {tempo}',
  'retorno.xpGanho': '+{valor} XP',
  'retorno.moedaGanha': '+{valor} moedas',
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
  'cadastro.sucesso': 'Pronto — agora seu progresso continua com o jogo fechado.',

  // --- Configurações ------------------------------------------------------
  'config.titulo': 'Configurações',
  'config.idioma': 'Idioma',
  'config.idioma.pt': 'Português',
  'config.idioma.en': 'Inglês',
  'config.fechar': 'Fechar',

  // --- Tempo --------------------------------------------------------------
  'tempo.minutos': '{valor} min',
  'tempo.horas': '{valor}h',
  'tempo.horasEMinutos': '{horas}h {minutos}min',

  // --- Mundo e inimigos ---------------------------------------------------
  // Os nomes em inglês NÃO são tradução literal (core, critério 14) — cada um
  // ganhou um trocadilho próprio que funciona no idioma. Ver `en.ts`.
  'mundo.bioma1': 'Floresta de Algodão-Doce',
  'inimigo.casquinha': 'Casquinha',
  'inimigo.minhoca': 'Minhoca Azeda',
  'inimigo.rosquinha': 'Rosquinha Brutamontes',
  'inimigo.pirulito': 'Pirulito Valentão',
  'inimigo.pudim': 'Pudim Conformado',
} as const

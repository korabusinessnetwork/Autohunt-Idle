import type { ChaveI18n } from './chaves'

// English dictionary.
//
// Typed as `Record<ChaveI18n, string>` on purpose: a key added to `pt.ts`
// without a counterpart here fails the build.
//
// Enemy and biome names are NOT literal translations (core, criterion 14).
// Each one got its own joke that lands in English:
//   Casquinha            → "Cone Head"   (an ice cream cone that is also a dunce)
//   Minhoca Azeda        → "Glum Worm"   (gummy worm, but sulking)
//   Rosquinha Brutamontes→ "Sir Glazealot" (glazed donut with a knightly monocle)
//   Pirulito Valentão    → "Sucker Punch"  (a lollipop is a sucker; bullies punch)
//   Pudim Conformado     → "Flanpathy"     (flan + apathy, melting without urgency)
//   Floresta de Algodão-Doce → "The Fluffwoods" (fluff + woods)

export const en: Record<ChaveI18n, string> = {
  // --- Loading and error states -------------------------------------------
  'app.carregando': 'Dropping you into the world…',
  'app.erro.titulo': "Couldn't connect",
  'app.erro.mensagem': 'The server did not answer. No big deal — give it another go.',
  'app.erro.tentarDeNovo': 'Try again',

  // --- HUD ------------------------------------------------------------------
  'hud.nivel': 'Level',
  'hud.moeda': 'Coins',
  'hud.vitalidade': 'Vitality',
  'hud.xpParaProximo': '{atual} / {alvo} XP',
  'hud.aoVivo': 'Farming live',
  'hud.ativarOffline': 'Earn with the game closed',

  // --- Welcome back screen --------------------------------------------------
  'retorno.titulo': 'While you were out',
  'retorno.tempoFora': 'You were away for {tempo}',
  'retorno.tempoRendido': 'Earned for {tempo}',
  'retorno.xpGanho': '+{valor} XP',
  'retorno.moedaGanha': '+{valor} coins',
  'retorno.coletar': 'Collect it all',
  'retorno.coletando': 'Collecting…',
  'retorno.voltarAoJogo': 'Back to the game',
  'retorno.vazio.titulo': 'Nothing banked yet',
  'retorno.vazio.mensagem': 'Your hero is farming right now. Come back later for the pile.',

  'retorno.motivo.creditado': 'You earned for the whole time you were away.',
  'retorno.motivo.teto_assinante':
    'Your subscription earns up to 24h per absence — that is exactly what you took home.',
  'retorno.motivo.teto_anuncio':
    'You earned as far as your ad minutes stretched. The rest of the time was not saved.',
  'retorno.motivo.sem_desbloqueio':
    'That time was not saved: offline farming needs a subscription or ad minutes.',
  'retorno.motivo.assinatura_vencida':
    'Your subscription reached the end of its paid period, so anything banked and uncollected was cleared.',
  'retorno.motivo.primeira_sessao': 'Nice! Your hero is already farming.',

  // --- Rewarded ads ---------------------------------------------------------
  'anuncio.assistir': 'Watch an ad (+{minutos} min offline)',
  'anuncio.carregando': 'Loading the ad…',
  'anuncio.saldo': '{minutos} min of offline farming in your pocket',
  'anuncio.restanteHoje': 'You can unlock {minutos} more min today',
  'anuncio.indisponivel.TETO_DIARIO_ATINGIDO':
    "You've unlocked today's full 2h. Come back tomorrow — it resets.",
  'anuncio.indisponivel.SALDO_JA_NO_TETO':
    'Your offline pocket is already full (2h). Spend it before grabbing more.',
  'anuncio.indisponivel.ASSINANTE_NAO_PRECISA':
    "You're a subscriber — you already get 24h a day, no ads at all.",
  'anuncio.indisponivel.SEM_PROVEDOR': 'Rewarded ads are not available in this build yet.',
  'anuncio.erro': 'The ad did not finish, so nothing was credited.',

  // --- Offline unlock -------------------------------------------------------
  'desbloqueio.titulo': 'Farming with the game closed',

  // --- Subscription ---------------------------------------------------------
  'assinatura.ativa': 'Subscriber — 24h of farming a day and 2x XP',
  'assinatura.inativa': 'No subscription — offline farming only through ads',
  'assinatura.indisponivel': 'Subscriptions are not open in this build yet.',

  // --- Sign-up (age gate) ---------------------------------------------------
  'cadastro.titulo': 'To keep your offline progress',
  'cadastro.explicacao':
    'Your hero is already yours — all that is missing is an email so they keep earning with the game closed.',
  'cadastro.email': 'Email',
  'cadastro.senha': 'Password',
  'cadastro.dataNascimento': 'Date of birth',
  'cadastro.avisoIdade': 'Autohunt Idle is for players aged 18 and over.',
  'cadastro.enviar': 'Create my login',
  'cadastro.enviando': 'Creating…',
  'cadastro.agoraNao': 'Not now',
  'cadastro.erro.IDADE_MINIMA_NAO_ATINGIDA': 'You must be 18 or older to play.',
  'cadastro.erro.DATA_NASCIMENTO_INVALIDA': 'That date of birth does not look valid.',
  'cadastro.erro.DATA_NASCIMENTO_OBRIGATORIA': 'Please enter your date of birth.',
  'cadastro.erro.EMAIL_INVALIDO': 'That email does not look valid.',
  'cadastro.erro.SENHA_CURTA': 'Your password needs at least 8 characters.',
  'cadastro.erro.EMAIL_EM_USO': 'That email already has an account. Your progress here is untouched.',
  'cadastro.erro.CADASTRO_FALHOU': "Couldn't create the login right now. Try again?",

  // --- Attributes -----------------------------------------------------------
  'atributos.titulo': 'Attributes',
  'atributos.pontosLivres': '{pontos} points to spend',
  'atributos.autoAlocado':
    'Your points spend themselves. Touching this is optional — and always reversible.',
  'atributos.forca': 'Strength',
  'atributos.forca.efeito': 'Physical damage',
  'atributos.inteligencia': 'Intelligence',
  'atributos.inteligencia.efeito': 'Magic damage',
  'atributos.vitalidade': 'Vitality',
  'atributos.vitalidade.efeito': 'Takes longer to go down',
  'atributos.sorte': 'Luck',
  'atributos.sorte.efeito': 'Better loot odds (arrives with dungeons)',
  'atributos.custoProximo': 'Next: {custo} pt',
  'atributos.subir': 'Raise {atributo}',
  'atributos.descer': 'Lower {atributo}',
  'atributos.zerar': 'Reset all',
  'atributos.voltarAoAutomatico': 'Let the game spend them',
  'atributos.manual': "You're spending them by hand.",
  'atributos.salvar': 'Save',
  'atributos.salvando': 'Saving…',
  'atributos.semAlteracao': 'Nothing changed yet',
  'atributos.erro.PONTOS_INSUFICIENTES': "You don't have enough points for that spread.",
  'atributos.erro.ATRIBUTO_INVALIDO': 'That spread is not valid.',
  'atributos.erro.ATRIBUTO_FALHOU': "Couldn't save right now. Try again?",

  // --- Ranking --------------------------------------------------------------
  'ranking.titulo': 'Global ranking',
  'ranking.posicao': '#{posicao}',
  'ranking.nivel': 'Lv {nivel}',
  'ranking.suaPosicao': "You're at #{posicao}",
  'ranking.vazio.titulo': 'The board is still empty',
  'ranking.vazio.mensagem': 'Nobody has joined yet. Pick a name and be the first.',
  'ranking.carregando': 'Loading the board…',
  'ranking.erro': "Couldn't load the board right now.",
  'ranking.apelido.titulo': 'How should you show up?',
  'ranking.apelido.explicacao':
    'Only players with a name appear on the board. Without one you play as usual and stay out of it.',
  'ranking.apelido.campo': 'Display name',
  'ranking.apelido.enviar': 'Join the ranking',
  'ranking.apelido.enviando': 'Joining…',
  'ranking.apelido.erro.APELIDO_TAMANHO_INVALIDO': 'The name needs 3 to 20 characters.',
  'ranking.apelido.erro.APELIDO_CARACTERE_INVALIDO': 'That name has a character we cannot use.',
  'ranking.apelido.erro.APELIDO_FALHOU': "Couldn't save the name right now. Try again?",

  // --- Settings -------------------------------------------------------------
  'config.titulo': 'Settings',
  'config.idioma': 'Language',
  'config.idioma.pt': 'Portuguese',
  'config.idioma.en': 'English',
  'config.fechar': 'Close',

  // --- Time -----------------------------------------------------------------
  'tempo.minutos': '{valor} min',
  'tempo.horas': '{valor}h',
  'tempo.horasEMinutos': '{horas}h {minutos}min',

  // --- World and enemies ----------------------------------------------------
  'mundo.bioma1': 'The Fluffwoods',
  'inimigo.casquinha': 'Cone Head',
  'inimigo.minhoca': 'Glum Worm',
  'inimigo.rosquinha': 'Sir Glazealot',
  'inimigo.pirulito': 'Sucker Punch',
  'inimigo.pudim': 'Flanpathy',
}

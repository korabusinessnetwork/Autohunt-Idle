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
  'ranking.apelido.erro.APELIDO_EM_USO': 'Another player already has that name. Pick another?',
  'ranking.apelido.erro.APELIDO_FALHOU': "Couldn't save the name right now. Try again?",
  'ranking.cadastro.titulo': 'The board needs a login',
  'ranking.cadastro.explicacao':
    'A ranking name is yours alone, and nobody else can take it — so it needs an account that will not get lost. Playing stays free without one.',
  'ranking.cadastro.criar': 'Create my login',

  // --- Rarity (10 tiers) ----------------------------------------------------
  // The first five are standard loot-game vocabulary, and translating them
  // straight is the correct call — a player scanning a tier list expects
  // exactly these words. The candy-themed top five got their own jokes
  // (core, criterion 14): "Glazed Over" is also being dazed, "Rock Candy" is a
  // real sweet made of crystallised sugar, "Starfrosted" reads as endgame.
  'raridade.comum': 'Common',
  'raridade.incomum': 'Uncommon',
  'raridade.raro': 'Rare',
  'raridade.epico': 'Epic',
  'raridade.lendario': 'Legendary',
  'raridade.caramelizado': 'Toffee-Touched',
  'raridade.glaceado': 'Glazed Over',
  'raridade.dourado': 'Gilded',
  'raridade.cristalizado': 'Rock Candy',
  'raridade.cosmico': 'Starfrosted',

  // --- Items and bag --------------------------------------------------------
  'item.arma': 'Weapon',
  'item.capacete': 'Helmet',
  'item.armadura': 'Armor',
  'item.luva': 'Gloves',
  'item.bota': 'Boots',
  'item.acessorio': 'Accessory',
  'item.pedra_fortificacao': 'Forge Stone',
  'item.pedra_sorte': 'Lucky Stone',
  'item.pedra_garantia': 'Sure Thing Stone',
  'item.skin': 'Skin',
  'item.chave': 'Key',
  'mochila.titulo': 'Bag',
  'mochila.chaves': '{quantidade} dungeon keys',
  'mochila.vazia.titulo': 'Nothing in the bag yet',
  'mochila.vazia.mensagem': 'Your hero is farming. The first drop lands soon.',
  'mochila.quantidade': '{quantidade}x',
  'mochila.equipar': 'Equip',
  'mochila.equipada': 'In use',
  'mochila.poder': 'Attack power: {poder}',
  'mochila.slot.arma': 'Weapon',
  'mochila.slot.capacete': 'Helmet',
  'mochila.slot.armadura': 'Armor',
  'mochila.slot.luva': 'Gloves',
  'mochila.slot.bota': 'Boots',
  'mochila.slot.acessorio': 'Accessory',
  'mochila.slot.skin': 'Skin',
  'mochila.equipamento': 'Gear',
  'mochila.slot.vazio': 'Empty',
  'mochila.semStat': 'A skin changes no numbers — it is looks only.',

  // --- Damage type, affinity and sets ---------------------------------------
  // Set names get their own jokes rather than a word-for-word pass
  // (core, criterion 14): "Nougat Bruiser" keeps the thug, "Biscuit Knight"
  // keeps the crunch.
  'dano.fisico': 'Physical',
  'dano.magico': 'Magic',
  'afinidade.combina': 'Matches your weapon (+20%)',
  'afinidade.naoCombina': 'Does not match your weapon',
  'conjunto.bruxa-caramelo': 'Caramel Witch Set',
  'conjunto.cavaleiro-biscoito': 'Biscuit Knight Set',
  'conjunto.feiticeira-menta': 'Peppermint Sorceress Set',
  'conjunto.brutamontes-nougat': 'Nougat Bruiser Set',
  'conjunto.pecas': '{pecas} of 6 pieces',
  'conjunto.bonus2': '2-piece bonus active',
  'conjunto.bonus3': 'Full set — complete bonus',

  // --- Dungeon --------------------------------------------------------------
  'dungeon.entrar': 'Enter the dungeon',
  'dungeon.entrando': 'Entering…',
  'dungeon.semChave': 'You need a key. They drop in the open world and from mini bosses.',
  'dungeon.venceu': 'Boss down! Rare loot guaranteed.',
  'dungeon.perdeu': 'The boss held on this time. The key is gone, but nothing else is.',
  'dungeon.offline': '{resolvidas} dungeons while you were out',

  // --- Synthesis ------------------------------------------------------------
  'sintese.titulo': 'Synthesis',
  'sintese.explicacao': 'Stack 9 matching items and they become 1 of the tier above. Costs nothing.',
  'sintese.combinar': 'Combine 9',
  'sintese.combinando': 'Combining…',
  'sintese.faltam': '{faltam} more to combine',
  'sintese.erro.ITENS_INSUFICIENTES': "You don't have 9 matching items there.",
  'sintese.erro.TIER_MAXIMO': 'Starfrosted is the top — nothing above it.',
  'sintese.erro.SINTESE_FALHOU': "Couldn't combine right now. Try again?",

  // --- Fortification --------------------------------------------------------
  'fort.titulo': 'Upgrade',
  'fort.nivel': '+{nivel}',
  'fort.chance': '{chance}% to succeed',
  'fort.custo': 'Costs {ouro} gold',
  'fort.pedras': '{fortificacao} forge · {sorte} lucky · {garantia} sure',
  'fort.usarSorte': 'Use a Lucky Stone (+15%)',
  'fort.usarGarantia': 'Use a Sure Thing Stone (guaranteed)',
  'fort.tentar': 'Upgrade',
  'fort.tentando': 'Upgrading…',
  'fort.semPunicao': 'On a miss you lose the materials — the item stays exactly as it was.',
  'fort.sucesso': 'It worked! Now at +{nivel}.',
  'fort.falhou': 'No luck this time. The item is untouched, only the materials are gone.',
  'fort.erro.TETO_ATINGIDO': 'That item is already maxed out.',
  'fort.erro.OURO_INSUFICIENTE': 'Not enough gold for this attempt.',
  'fort.erro.SEM_PEDRA': "You don't have the stone you need.",
  'fort.erro.ITEM_NAO_FORTIFICAVEL': 'That item cannot be upgraded.',
  'fort.erro.FORTIFICACAO_FALHOU': "Couldn't upgrade right now. Try again?",

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

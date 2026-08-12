// Formato dos payloads devolvidos pelas RPCs.
//
// Importante: cada número exibido na tela de retorno existe aqui porque veio
// PRONTO do servidor. O client não recalcula rendimento nem duração a partir
// do relógio local — se o relógio da máquina estiver adiantado, nada na tela
// muda (edge case do core).

export type MotivoRetorno =
  | 'primeira_sessao'
  | 'creditado'
  | 'teto_assinante'
  | 'teto_anuncio'
  | 'sem_desbloqueio'
  | 'assinatura_vencida'

export interface EstadoJogador {
  nivel: number
  xpTotal: number
  xpNoNivel: number
  xpParaProximoNivel: number
  moeda: number
  /**
   * Moeda premium. Ganha derrotando o boss de dungeon e — quando houver
   * gateway — comprada do operador. Nunca volta a ser dinheiro: o único gasto
   * que existe no schema é a loja de ouro.
   */
  diamante: number
  vitalidadeAtual: number
  vitalidadeMaxima: number
  idioma: 'pt' | 'en'
  /** Nome de exibição no ranking. Nulo = jogador não aparece no placar. */
  apelido: string | null
  /** Se a conta anônima já ganhou e-mail/senha (core, 18). */
  temCadastro: boolean
  /**
   * Se o jogador já passou pelo cadastro e pelo gate de idade. Separado de
   * `temCadastro` porque, com confirmação de e-mail ligada, `auth.users.email`
   * só aparece depois do clique no link — e o modal não pode reaparecer para
   * quem já cadastrou.
   */
  identidadeVerificada: boolean
}

export interface EstadoFarm {
  minutosAcumulados: number
  xpPendente: number
  moedaPendente: number
  minutosAnuncioSaldo: number
  /** Quanto ainda dá para desbloquear na janela de 24h corrente. */
  minutosAnuncioRestantes: number
  /**
   * Minutos de AUTO na tela — produto separado do farm offline
   * (`specs/mundo-aberto-e-modo-manual.md`, 3.3). Gastar um não consome o
   * outro, e é por isso que são dois campos e não um.
   */
  minutosAutoSaldo: number
  minutosAutoRestantes: number
  ultimoMotivo: MotivoRetorno
}

export interface EstadoAssinatura {
  ativa: boolean
  status: 'inexistente' | 'ativa' | 'cancelada' | 'vencida'
  expiraEm: string | null
  multiplicadorXp: 1 | 2
  tetoOfflineMinutos: number
}

export interface RetornoOffline {
  houveAusencia: boolean
  minutosDecorridos: number
  minutosCreditados: number
  xpGanho: number
  moedaGanha: number
  ciclosPerdidos?: number
  tetoMinutos: number
  motivo: MotivoRetorno
  /** Dungeons que o servidor resolveu durante a ausência. */
  dungeons?: { resolvidas: number; vitorias: number }
}

export interface ResultadoLote {
  ciclos: number
  ciclosPerdidos?: number
  xpGanho: number
  moedaGanha: number
}

export interface EstadoAtributos {
  forca: number
  inteligencia: number
  vitalidade: number
  sorte: number
  /** Pontos ganhos e ainda não gastos. */
  pontosLivres: number
  /**
   * Se o servidor ainda distribui os pontos novos sozinho. Vira `false` quando
   * o jogador redistribui à mão — senão a auto-alocação desfaria a escolha
   * dele no lote seguinte.
   */
  autoAlocar: boolean
}

export interface LinhaRanking {
  posicao: number
  apelido: string
  nivel: number
  euMesmo: boolean
}

export interface RankingGlobal {
  top: LinhaRanking[]
  /** A própria linha — `null` enquanto o jogador não tiver apelido. */
  eu: LinhaRanking | null
  atualizadoEm: string | null
}

export type TipoItem =
  | 'arma'
  | 'capacete'
  | 'armadura'
  | 'luva'
  | 'bota'
  | 'acessorio'
  | 'skin'
  | 'chave'
  | 'pedra_fortificacao'
  | 'pedra_sorte'
  | 'pedra_garantia'

export interface GrupoInventario {
  tipo: TipoItem
  /** 1 = comum … 10 = cósmico. Decidida no servidor. */
  raridade: number
  quantidade: number
}

/** O slot é sempre igual ao tipo do item — por isso equipar não informa slot. */
export type SlotEquipamento = Exclude<
  TipoItem,
  'chave' | 'pedra_fortificacao' | 'pedra_sorte' | 'pedra_garantia'
>
export type TipoDano = 'fisico' | 'magico'

export interface ItemPossuido {
  id: string
  tipo: TipoItem
  raridade: number
  /** Nível de fortificação, de +0 a +15. Nunca decresce. */
  fortificacao: number
  /** Slot ocupado, ou `null` quando está guardado. */
  slot: SlotEquipamento | null
  tipoDano: TipoDano | null
  afinidade: TipoDano | null
  conjuntoId: string | null
}

export interface EstadoPedras {
  fortificacao: number
  sorte: number
  garantia: number
}

export interface ResultadoFortificacao {
  sucesso: boolean
  nivelFinal: number
  custoPago: number
  chanceUsada: number
}

export interface EstadoInventario {
  chaves: number
  /** Pedras de fortificação — só caem jogando, nunca são vendidas. */
  pedras: EstadoPedras
  /** Poder final do loadout, já com sinergia e conjunto — calculado no servidor. */
  poderDeAtaque: number
  loadout: Partial<Record<SlotEquipamento, ItemPossuido>>
  equipaveis: ItemPossuido[]
  porTipoERaridade: GrupoInventario[]
}

/**
 * Um pacote da loja de ouro: X diamantes entregam sempre exatamente Y ouro.
 *
 * Vem do servidor em vez de estar fixo aqui porque o preço tem que aparecer na
 * tela antes da compra e ser o mesmo que o servidor vai cobrar — sem faixa,
 * sem bônus aleatório, sem letra miúda.
 */
export interface PacoteOuro {
  id: string
  diamantes: number
  ouro: number
}

export interface ResultadoCompraOuro {
  pacote: string
  ouroRecebido: number
}

/**
 * Um degrau da trilha do passe.
 *
 * Vem do servidor inteiro, e **sempre** — inclusive para quem ainda não
 * comprou. É o que permite ver exatamente o que se está comprando antes de
 * pagar, e é a diferença entre este passe e uma caixa de recompensa aleatória.
 */
export interface TierDoPasse {
  tier: number
  pontos: number
  tipo: TipoItem
  raridade: number
  /** Recompensa que nenhuma outra rota do jogo concede. */
  exclusiva: boolean
}

export interface EstadoPasse {
  ativo: boolean
  pontos: number
  tier: number
  trilha: TierDoPasse[]
}

export interface ResultadoDungeon {
  resolvida: boolean
  venceu?: boolean
  motivo?: 'SEM_CHAVE'
}

export interface Snapshot {
  existe: boolean
  jogador: EstadoJogador
  atributos: EstadoAtributos
  inventario: EstadoInventario
  /** Catálogo da loja de ouro, publicado pelo servidor. */
  lojaOuro: PacoteOuro[]
  /** Progresso e trilha do passe. A trilha vem completa, com ou sem passe. */
  passe: EstadoPasse
  dungeon?: ResultadoDungeon
  sintese?: { consumidos: number; produziuRaridade: number }
  fortificacao?: ResultadoFortificacao
  compra?: ResultadoCompraOuro
  farm: EstadoFarm
  assinatura: EstadoAssinatura
  retorno?: RetornoOffline
  lote?: ResultadoLote
  coleta?: { xpColetado: number; moedaColetada: number }
}

export interface ResgateAnuncio {
  creditado: boolean
  /** Quantos minutos o SERVIDOR decidiu creditar — nunca o que o client pediu. */
  minutos?: number
  motivo?: string
}

export interface TicketAnuncio {
  emitido: boolean
  ticketId?: string
  minutos?: number
  motivo?: 'ASSINANTE_NAO_PRECISA' | 'TETO_DIARIO_ATINGIDO' | 'SALDO_JA_NO_TETO'
  proximaJanelaEm?: string
}

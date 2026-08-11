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

export type TipoItem = 'arma' | 'acessorio' | 'skin' | 'chave'

export interface GrupoInventario {
  tipo: TipoItem
  /** 1 = comum … 10 = cósmico. Decidida no servidor. */
  raridade: number
  quantidade: number
}

export type SlotEquipamento = 'arma' | 'acessorio1' | 'acessorio2' | 'skin'
export type TipoDano = 'fisico' | 'magico'

export interface ItemPossuido {
  id: string
  tipo: TipoItem
  raridade: number
  /** Slot ocupado, ou `null` quando está guardado. */
  slot: SlotEquipamento | null
  tipoDano: TipoDano | null
  afinidade: TipoDano | null
  conjuntoId: string | null
}

export interface EstadoInventario {
  chaves: number
  /** Poder final do loadout, já com sinergia e conjunto — calculado no servidor. */
  poderDeAtaque: number
  loadout: Partial<Record<SlotEquipamento, ItemPossuido>>
  equipaveis: ItemPossuido[]
  porTipoERaridade: GrupoInventario[]
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
  dungeon?: ResultadoDungeon
  sintese?: { consumidos: number; produziuRaridade: number }
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

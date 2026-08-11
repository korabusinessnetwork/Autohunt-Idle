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
  /** Se a conta anônima já ganhou e-mail/senha (core, 18). */
  temCadastro: boolean
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
}

export interface ResultadoLote {
  ciclos: number
  ciclosPerdidos?: number
  xpGanho: number
  moedaGanha: number
}

export interface Snapshot {
  existe: boolean
  jogador: EstadoJogador
  farm: EstadoFarm
  assinatura: EstadoAssinatura
  retorno?: RetornoOffline
  lote?: ResultadoLote
  coleta?: { xpColetado: number; moedaColetada: number }
}

export interface TicketAnuncio {
  emitido: boolean
  ticketId?: string
  minutos?: number
  motivo?: 'ASSINANTE_NAO_PRECISA' | 'TETO_DIARIO_ATINGIDO' | 'SALDO_JA_NO_TETO'
  proximaJanelaEm?: string
}

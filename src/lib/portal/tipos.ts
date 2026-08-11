// Contrato do canal de distribuição.
//
// Tudo que muda entre "rodar na CrazyGames", "rodar na Poki" e "rodar em
// domínio próprio" passa por aqui. O resto do jogo não sabe em que canal está
// — e é isso que permite publicar nos três ao mesmo tempo, que é justamente o
// que `docs/01_ARQUITETURA/publicacao-portais.md` diz ser permitido (nenhum
// dos dois portais exige exclusividade).

export type Canal = 'dominio-proprio' | 'crazygames' | 'poki'

export type DesfechoAnuncio = 'concluido' | 'interrompido' | 'erro'

/** Contrato que qualquer SDK de anúncio recompensado precisa satisfazer. */
export interface ProvedorAnuncio {
  nome: string
  /**
   * Se dá para pedir um anúncio agora. Checado em runtime porque o SDK do
   * portal é carregado pela página que hospeda o jogo — pode simplesmente não
   * estar lá (teste local, domínio próprio, script que não subiu).
   */
  disponivel(): boolean
  /**
   * Exibe o anúncio recompensado e resolve quando ele termina.
   * O `ticketId` foi emitido pelo servidor antes de o anúncio começar.
   */
  exibir(ticketId: string): Promise<DesfechoAnuncio>
}

export interface Portal {
  canal: Canal
  /**
   * Se o canal permite qualquer elemento de compra dentro do jogo. A Poki
   * proíbe sem exceção; a CrazyGames só libera por convite, via Xsolla
   * (`memory/restrictions.md`).
   */
  permiteCompraNoJogo: boolean
  provedorAnuncio: ProvedorAnuncio | null

  /** Progresso de carregamento, de 0 a 1. */
  aoCarregarProgresso(fracao: number): void
  /** O jogador está de fato jogando — o mundo começou a rodar. */
  aoIniciarJogo(): void
  /** O jogo saiu de foco: aba escondida, modal por cima, anúncio em exibição. */
  aoPausarJogo(): void
}

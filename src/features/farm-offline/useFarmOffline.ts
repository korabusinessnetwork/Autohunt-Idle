import { useCallback, useEffect, useState } from 'react'

import { useSessao } from '../../context/SessaoContext'
import type { RetornoOffline } from '../../lib/tipos'

// Decide quando a tela "enquanto você tava fora" aparece e cuida da coleta.
//
// Todo número exibido vem do bloco `retorno` que o servidor montou — este hook
// não calcula rendimento nem duração, e não existe `Date.now()` no caminho.

export interface FarmOffline {
  retorno: RetornoOffline | null
  visivel: boolean
  coletando: boolean
  temGanho: boolean
  fechar: () => void
  coletarEFechar: () => Promise<void>
}

export function useFarmOffline(): FarmOffline {
  const { snapshot, coletar } = useSessao()
  const [dispensada, setDispensada] = useState(false)
  const [coletando, setColetando] = useState(false)

  const retorno = snapshot?.retorno ?? null

  // Um retorno novo (outra ausência) precisa reabrir a tela mesmo que a
  // anterior tenha sido dispensada.
  useEffect(() => {
    setDispensada(false)
  }, [retorno?.minutosDecorridos, retorno?.motivo])

  const relevante = Boolean(
    retorno && (retorno.houveAusencia || retorno.motivo === 'assinatura_vencida'),
  )

  const fechar = useCallback(() => setDispensada(true), [])

  const coletarEFechar = useCallback(async () => {
    setColetando(true)
    try {
      await coletar()
      setDispensada(true)
    } finally {
      setColetando(false)
    }
  }, [coletar])

  return {
    retorno,
    visivel: relevante && !dispensada,
    coletando,
    temGanho: (snapshot?.farm.xpPendente ?? 0) > 0 || (snapshot?.farm.moedaPendente ?? 0) > 0,
    fechar,
    coletarEFechar,
  }
}

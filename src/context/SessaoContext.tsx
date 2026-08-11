import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { criarTradutor, idiomaInicial, salvarIdioma, type Idioma, type Tradutor } from '../lib/i18n'
import type { ErroServico } from '../lib/envelope'
import { garantirSessao } from '../lib/services/authService'
import {
  coletarFarmOffline,
  encerrarSessao,
  estadoJogador,
  iniciarSessao,
  validarLote,
} from '../lib/services/farmService'
import { configuracaoCompleta } from '../lib/supabaseClient'
import type { Snapshot } from '../lib/tipos'

// Estado global da sessão. É o único lugar que fala com a camada de serviços —
// nenhum componente chama o SDK do Supabase direto
// (`docs/01_ARQUITETURA/padroes.md`).

export type EstadoApp = 'carregando' | 'erro' | 'pronto'

interface ValorSessao {
  estado: EstadoApp
  erro: ErroServico | null
  snapshot: Snapshot | null
  idioma: Idioma
  t: Tradutor
  /** Ciclos que o servidor reportou como perdidos no último lote. */
  ciclosPerdidosNoLote: number
  trocarIdioma: (idioma: Idioma) => void
  conectar: () => Promise<void>
  pedirValidacaoDeLote: () => void
  coletar: () => Promise<void>
  /** Relê o estado do servidor sem reabrir a sessão (ex.: após um anúncio). */
  recarregarEstado: () => Promise<void>
  atualizarSnapshot: (snapshot: Snapshot) => void
}

const SessaoContext = createContext<ValorSessao | null>(null)

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoApp>('carregando')
  const [erro, setErro] = useState<ErroServico | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [idioma, setIdioma] = useState<Idioma>(() => idiomaInicial())
  const [ciclosPerdidosNoLote, setCiclosPerdidos] = useState(0)

  // Evita duas validações de lote em voo ao mesmo tempo (aba lenta, rede ruim).
  const validando = useRef(false)

  const t = useMemo(() => criarTradutor(idioma), [idioma])

  const trocarIdioma = useCallback((novo: Idioma) => {
    setIdioma(novo)
    salvarIdioma(novo)
  }, [])

  const conectar = useCallback(async () => {
    setEstado('carregando')
    setErro(null)

    if (!configuracaoCompleta) {
      setErro({
        codigo: 'CONFIGURACAO_AUSENTE',
        mensagem: 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes (ver .env.example).',
      })
      setEstado('erro')
      return
    }

    // Conta anônima real, criada em silêncio no primeiro segundo (core, 17).
    const sessao = await garantirSessao()
    if (sessao.error) {
      setErro(sessao.error)
      setEstado('erro')
      return
    }

    const inicio = await iniciarSessao()
    if (inicio.error || !inicio.data) {
      setErro(inicio.error ?? { codigo: 'SESSAO_FALHOU', mensagem: '' })
      setEstado('erro')
      return
    }

    setSnapshot(inicio.data)
    setEstado('pronto')
  }, [])

  const pedirValidacaoDeLote = useCallback(() => {
    if (validando.current) return
    validando.current = true

    void validarLote()
      .then((resposta) => {
        if (resposta.data) {
          setSnapshot(resposta.data)
          setCiclosPerdidos(resposta.data.lote?.ciclosPerdidos ?? 0)
        }
        // Falha de lote não derruba o jogo: o servidor guarda `last_seen_at` e
        // credita o intervalo na próxima chamada que der certo.
      })
      .finally(() => {
        validando.current = false
      })
  }, [])

  const coletar = useCallback(async () => {
    const resposta = await coletarFarmOffline()
    if (resposta.data) setSnapshot(resposta.data)
    else if (resposta.error) setErro(resposta.error)
  }, [])

  const recarregarEstado = useCallback(async () => {
    const resposta = await estadoJogador()
    if (!resposta.data) return
    // `estado_jogador` não traz bloco `retorno`; preservar o anterior evita que
    // a tela de retorno suma no meio da leitura do jogador.
    setSnapshot((anterior) => ({
      ...(resposta.data as Snapshot),
      ...(anterior?.retorno ? { retorno: anterior.retorno } : {}),
    }))
  }, [])

  useEffect(() => {
    void conectar()
  }, [conectar])

  // Idioma do documento acompanha o do jogo (acessibilidade e leitor de tela).
  useEffect(() => {
    document.documentElement.setAttribute('lang', idioma)
  }, [idioma])

  // Fim da sessão ao vivo. Best-effort de propósito: se o navegador for morto
  // antes de a requisição sair, o servidor chega no mesmo resultado porque
  // `last_seen_at` simplesmente para de avançar (core, 2).
  useEffect(() => {
    function aoMudarVisibilidade() {
      if (document.visibilityState === 'hidden') {
        void encerrarSessao()
      } else {
        void conectar()
      }
    }

    function aoSair() {
      void encerrarSessao()
    }

    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    window.addEventListener('pagehide', aoSair)
    return () => {
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      window.removeEventListener('pagehide', aoSair)
    }
  }, [conectar])

  const valor = useMemo<ValorSessao>(
    () => ({
      estado,
      erro,
      snapshot,
      idioma,
      t,
      ciclosPerdidosNoLote,
      trocarIdioma,
      conectar,
      pedirValidacaoDeLote,
      coletar,
      recarregarEstado,
      atualizarSnapshot: setSnapshot,
    }),
    [
      estado,
      erro,
      snapshot,
      idioma,
      t,
      ciclosPerdidosNoLote,
      trocarIdioma,
      conectar,
      pedirValidacaoDeLote,
      coletar,
      recarregarEstado,
    ],
  )

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>
}

export function useSessao(): ValorSessao {
  const valor = useContext(SessaoContext)
  if (!valor) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>')
  return valor
}

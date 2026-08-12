import { useCallback, useEffect, useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { TelaCarregando, TelaErro, TelaVazia } from '../../components/shared/EstadoTela'
import { useSessao } from '../../context/SessaoContext'
import type { ChaveI18n } from '../../lib/i18n'
import { lerLogOperacional, type EventoDoLog } from '../../lib/services/logService'
import './LogOperacional.css'

// O rastro que o console deixa — e, quando o mercado existir, o rastro dos
// trades (`docs/11_SEGURANCA/plano-mercado-p2p.md` §4.6).
//
// DUAS DECISÕES QUE NÃO SÃO LAYOUT:
//
//   · **a lista de tipos aparece na tela.** O log é recortado de propósito
//     (presença e progressão ficam fora), e um recorte invisível engana mais do
//     que log nenhum. Quem lê precisa saber o que NÃO está vendo;
//   · **a tela não pede o log para quem não é admin.** Não é proteção — a RPC
//     recusa de qualquer jeito — é evitar que carregar uma URL vire uma linha
//     de recusa no banco. Chamada deliberada é registrada; abrir a página, não.

const ERRO: Record<string, ChaveI18n> = {
  NAO_AUTORIZADO: 'console.erro.NAO_AUTORIZADO',
  LOG_NAO_CARREGOU: 'console.log.erro',
  CONFIGURACAO_AUSENTE: 'console.erro.CONFIGURACAO_AUSENTE',
}

/** Quantos eventos por página. O servidor trava em 200; 50 é o que se lê. */
const POR_PAGINA = 50

/**
 * O `dados` de cada evento é `jsonb` sem esquema — cada tipo carrega o que faz
 * sentido para ele. Renderizar `chave: valor` genérico é o que permite um tipo
 * novo (um `mercado.comprado`, por exemplo) aparecer legível **sem tocar nesta
 * tela**.
 */
function detalhes(dados: Record<string, unknown>): string {
  return Object.entries(dados)
    .map(([chave, valor]) => `${chave}: ${typeof valor === 'object' ? JSON.stringify(valor) : String(valor)}`)
    .join(' · ')
}

/** Apelido quando existe; senão o começo do uuid, que é o suficiente para agrupar. */
function quem(evento: EventoDoLog): string {
  return evento.apelido ?? evento.jogador.slice(0, 8)
}

export function LogOperacional() {
  const { t, idioma, snapshot } = useSessao()

  const [eventos, setEventos] = useState<EventoDoLog[] | null>(null)
  const [tipos, setTipos] = useState<string[]>([])
  const [filtro, setFiltro] = useState<string | null>(null)
  const [erro, setErro] = useState<ChaveI18n | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [acabou, setAcabou] = useState(false)

  const ehAdmin = snapshot?.jogador.admin ?? false

  const carregar = useCallback(
    async (opcoes?: { antes?: string; tipo?: string | null }) => {
      const continuando = Boolean(opcoes?.antes)
      setCarregando(true)
      try {
        const resposta = await lerLogOperacional({
          tipos: opcoes?.tipo ? [opcoes.tipo] : undefined,
          limite: POR_PAGINA,
          antes: opcoes?.antes ?? null,
        })

        if (resposta.error) {
          setErro(ERRO[resposta.error.codigo] ?? 'console.log.erro')
          return
        }
        const pagina = resposta.data!
        if (!pagina.permitido) {
          setErro(ERRO[pagina.motivo ?? ''] ?? 'console.erro.NAO_AUTORIZADO')
          return
        }

        setErro(null)
        setTipos(pagina.tipos)
        setAcabou(pagina.eventos.length < POR_PAGINA)
        setEventos((anteriores) =>
          continuando ? [...(anteriores ?? []), ...pagina.eventos] : pagina.eventos,
        )
      } finally {
        setCarregando(false)
      }
    },
    [],
  )

  useEffect(() => {
    // Só admin chega a pedir. Ver o comentário do topo: é para não transformar
    // um carregamento de página em linha de recusa no banco.
    if (ehAdmin) void carregar()
  }, [carregar, ehAdmin])

  function trocarFiltro(tipo: string | null) {
    setFiltro(tipo)
    setEventos(null)
    void carregar({ tipo })
  }

  if (!ehAdmin) {
    return (
      <p className="console__negado" role="status">
        <strong>{t('console.negado.titulo')}</strong> {t('console.log.negado')}
      </p>
    )
  }

  if (erro) {
    return (
      <div className="console__estado">
        <TelaErro
          titulo={t('console.log.titulo')}
          mensagem={t(erro)}
          rotuloAcao={t('app.erro.tentarDeNovo')}
          aoTentarDeNovo={() => void carregar({ tipo: filtro })}
        />
      </div>
    )
  }

  if (eventos === null) {
    return (
      <div className="console__estado">
        <TelaCarregando mensagem={t('console.log.carregando')} />
      </div>
    )
  }

  return (
    <section className="log">
      <p className="console__explicacao">{t('console.log.explicacao')}</p>

      <div className="log__filtros" role="group" aria-label={t('console.log.filtrar')}>
        <button
          type="button"
          className={`log__filtro ${filtro === null ? 'log__filtro--ativo' : ''}`.trim()}
          onClick={() => trocarFiltro(null)}
        >
          {t('console.log.todos')}
        </button>
        {tipos.map((tipo) => (
          <button
            key={tipo}
            type="button"
            className={`log__filtro ${filtro === tipo ? 'log__filtro--ativo' : ''}`.trim()}
            onClick={() => trocarFiltro(tipo)}
          >
            {tipo}
          </button>
        ))}
      </div>

      {eventos.length === 0 ? (
        <TelaVazia titulo={t('console.log.vazio.titulo')} mensagem={t('console.log.vazio.mensagem')} />
      ) : (
        <ol className="log__lista">
          {eventos.map((evento) => (
            <li className="log__item" key={evento.id}>
              <div className="log__cabecalho">
                <span className="log__tipo">{evento.tipo}</span>
                <time className="log__quando" dateTime={evento.em}>
                  {new Date(evento.em).toLocaleString(idioma === 'pt' ? 'pt-BR' : 'en-US')}
                </time>
              </div>
              <p className="log__quem">{quem(evento)}</p>
              {Object.keys(evento.dados).length > 0 && (
                <p className="log__dados">{detalhes(evento.dados)}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      {!acabou && eventos.length > 0 && (
        <Botao
          variante="discreta"
          disabled={carregando}
          onClick={() => void carregar({ antes: eventos.at(-1)!.em, tipo: filtro })}
        >
          {t('console.log.carregarMais')}
        </Botao>
      )}

      {/* O recorte, escrito. Sem isto o log parece completo e não é. */}
      <p className="console__rodape">{t('console.log.recorte')}</p>
    </section>
  )
}

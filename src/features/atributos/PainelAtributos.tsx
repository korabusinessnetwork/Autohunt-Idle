import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import {
  ATRIBUTOS,
  custoDoProximoNivel,
  pontosDisponiveis,
  validarAlocacao,
  type Atributo,
  type Atributos,
} from '../../game/regrasAtributos'
import type { ChaveI18n } from '../../lib/i18n'
import { reativarAutoAlocacao, redistribuirAtributos } from '../../lib/services/atributoService'
import './PainelAtributos.css'

// Painel de atributos.
//
// Regra de produto que molda esta tela: os pontos já foram distribuídos
// sozinhos (Princípio nº1) — mexer aqui é opcional, e a tela diz isso em vez de
// exigir uma decisão. E como o respec é grátis, sem penalidade e sem limite
// (`specs/ranking-global.md`, critério 10), não existe confirmação de "tem
// certeza?": não há nada a perder.

const ROTULO: Record<Atributo, ChaveI18n> = {
  forca: 'atributos.forca',
  inteligencia: 'atributos.inteligencia',
  vitalidade: 'atributos.vitalidade',
  sorte: 'atributos.sorte',
}

const EFEITO: Record<Atributo, ChaveI18n> = {
  forca: 'atributos.forca.efeito',
  inteligencia: 'atributos.inteligencia.efeito',
  vitalidade: 'atributos.vitalidade.efeito',
  sorte: 'atributos.sorte.efeito',
}

const ERRO: Record<string, ChaveI18n> = {
  PONTOS_INSUFICIENTES: 'atributos.erro.PONTOS_INSUFICIENTES',
  ATRIBUTO_INVALIDO: 'atributos.erro.ATRIBUTO_INVALIDO',
  ATRIBUTO_FALHOU: 'atributos.erro.ATRIBUTO_FALHOU',
}

export function PainelAtributos({ aoFechar }: { aoFechar: () => void }) {
  const { t, snapshot, atualizarSnapshot } = useSessao()

  const salvos: Atributos = {
    forca: snapshot?.atributos.forca ?? 0,
    inteligencia: snapshot?.atributos.inteligencia ?? 0,
    vitalidade: snapshot?.atributos.vitalidade ?? 0,
    sorte: snapshot?.atributos.sorte ?? 0,
  }
  const nivel = snapshot?.jogador.nivel ?? 1
  const autoAlocar = snapshot?.atributos.autoAlocar ?? true

  const [rascunho, setRascunho] = useState<Atributos>(salvos)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<ChaveI18n | null>(null)

  const livres = pontosDisponiveis(rascunho, nivel)
  const alterado = ATRIBUTOS.some((chave) => rascunho[chave] !== salvos[chave])

  function subir(chave: Atributo) {
    const custo = custoDoProximoNivel(rascunho[chave])
    if (custo > livres) return
    setRascunho({ ...rascunho, [chave]: rascunho[chave] + 1 })
    setErro(null)
  }

  function descer(chave: Atributo) {
    if (rascunho[chave] <= 0) return
    setRascunho({ ...rascunho, [chave]: rascunho[chave] - 1 })
    setErro(null)
  }

  function zerar() {
    setRascunho({ forca: 0, inteligencia: 0, vitalidade: 0, sorte: 0 })
    setErro(null)
  }

  async function voltarAoAutomatico() {
    setSalvando(true)
    setErro(null)
    try {
      const resposta = await reativarAutoAlocacao()
      if (resposta.error) {
        setErro(ERRO[resposta.error.codigo] ?? 'atributos.erro.ATRIBUTO_FALHOU')
        return
      }
      if (resposta.data) atualizarSnapshot(resposta.data)
      aoFechar()
    } finally {
      setSalvando(false)
    }
  }

  async function salvar() {
    const validacao = validarAlocacao(rascunho, nivel)
    if (!validacao.valida) {
      setErro(ERRO[validacao.erro] ?? 'atributos.erro.ATRIBUTO_FALHOU')
      return
    }

    setSalvando(true)
    setErro(null)
    try {
      const resposta = await redistribuirAtributos(rascunho)
      if (resposta.error) {
        setErro(ERRO[resposta.error.codigo] ?? 'atributos.erro.ATRIBUTO_FALHOU')
        return
      }
      if (resposta.data) atualizarSnapshot(resposta.data)
      aoFechar()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="atributos" role="dialog" aria-modal="true" aria-labelledby="atributos-titulo">
      <div className="atributos__cartao">
        <h2 className="atributos__titulo" id="atributos-titulo">
          {t('atributos.titulo')}
        </h2>
        <p className="atributos__explicacao">
          {t(autoAlocar ? 'atributos.autoAlocado' : 'atributos.manual')}
        </p>
        <p className="atributos__pontos">{t('atributos.pontosLivres', { pontos: livres })}</p>

        <ul className="atributos__lista">
          {ATRIBUTOS.map((chave) => {
            const custo = custoDoProximoNivel(rascunho[chave])
            return (
              <li key={chave} className="atributos__linha">
                <div className="atributos__info">
                  <strong>{t(ROTULO[chave])}</strong>
                  <span className="atributos__efeito">{t(EFEITO[chave])}</span>
                </div>

                <div className="atributos__controles">
                  <button
                    type="button"
                    className="atributos__passo"
                    onClick={() => descer(chave)}
                    disabled={rascunho[chave] <= 0 || salvando}
                    aria-label={t('atributos.descer', { atributo: t(ROTULO[chave]) })}
                  >
                    −
                  </button>
                  <span className="atributos__valor">{rascunho[chave]}</span>
                  <button
                    type="button"
                    className="atributos__passo"
                    onClick={() => subir(chave)}
                    disabled={custo > livres || salvando}
                    aria-label={t('atributos.subir', { atributo: t(ROTULO[chave]) })}
                  >
                    +
                  </button>
                </div>

                <span className="atributos__custo">{t('atributos.custoProximo', { custo })}</span>
              </li>
            )
          })}
        </ul>

        {erro ? (
          <p className="atributos__erro" role="alert">
            {t(erro)}
          </p>
        ) : null}

        <div className="atributos__acoes">
          <Botao onClick={() => void salvar()} disabled={!alterado || salvando}>
            {salvando ? t('atributos.salvando') : t('atributos.salvar')}
          </Botao>
          <Botao variante="discreta" onClick={zerar} disabled={salvando}>
            {t('atributos.zerar')}
          </Botao>
          {/*
            Só aparece para quem assumiu o controle: é a porta de volta. Sem
            ela, quem redistribui uma vez fica manual para sempre.
          */}
          {!autoAlocar ? (
            <Botao
              variante="discreta"
              onClick={() => void voltarAoAutomatico()}
              disabled={salvando}
            >
              {t('atributos.voltarAoAutomatico')}
            </Botao>
          ) : null}
          <Botao variante="discreta" onClick={aoFechar} disabled={salvando}>
            {t('config.fechar')}
          </Botao>
        </div>

        {!alterado ? <p className="atributos__dica">{t('atributos.semAlteracao')}</p> : null}
      </div>
    </div>
  )
}

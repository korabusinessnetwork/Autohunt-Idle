import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import { IDIOMAS, type ChaveI18n } from '../../lib/i18n'
import { sair } from '../../lib/services/authService'
import {
  baixarExportacao,
  excluirMinhaConta,
  exportarMeusDados,
} from '../../lib/services/contaService'
import './PainelConfiguracoes.css'

// Troca manual de idioma (core, 13) e os dois direitos do titular dos dados.
//
// Exportar e excluir ficam aqui, e não escondidos num link de rodapé, porque
// `docs/11_SEGURANCA/README.md` trata os dois como direito exercível — e
// direito atrás de labirinto é dark pattern, que `memory/restrictions.md`
// proíbe pelo mesmo motivo que proíbe dificultar o cancelamento.
//
// A exclusão pede uma confirmação explícita, e o texto diz o que ela faz antes
// de fazer: prevenção de erro é melhor que mensagem de erro.

export function PainelConfiguracoes({ aoFechar }: { aoFechar: () => void }) {
  const { t, idioma, trocarIdioma, conectar } = useSessao()

  const [ocupado, setOcupado] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [aviso, setAviso] = useState<ChaveI18n | null>(null)

  async function exportar() {
    setOcupado(true)
    setAviso(null)
    try {
      const resposta = await exportarMeusDados()
      if (resposta.error || !resposta.data) {
        setAviso('dados.erro.EXPORTACAO_FALHOU')
        return
      }
      baixarExportacao(resposta.data)
      setAviso('dados.exportado')
    } finally {
      setOcupado(false)
    }
  }

  async function excluir() {
    setOcupado(true)
    setAviso(null)
    try {
      const resposta = await excluirMinhaConta()
      if (resposta.error) {
        setAviso('dados.erro.EXCLUSAO_FALHOU')
        return
      }
      // A conta não existe mais: encerrar a sessão local e reconectar abre uma
      // conta anônima nova. Sem isso o jogo ficaria com um token apontando
      // para um jogador apagado — e a tela de erro seria a primeira notícia.
      await sair()
      await conectar()
      aoFechar()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="config" role="dialog" aria-modal="true" aria-labelledby="config-titulo">
      <div className="config__cartao">
        <h2 className="config__titulo" id="config-titulo">
          {t('config.titulo')}
        </h2>

        <fieldset className="config__grupo">
          <legend>{t('config.idioma')}</legend>
          {IDIOMAS.map((codigo) => (
            <label key={codigo} className="config__opcao">
              <input
                type="radio"
                name="idioma"
                value={codigo}
                checked={idioma === codigo}
                onChange={() => trocarIdioma(codigo)}
              />
              <span>{t(codigo === 'pt' ? 'config.idioma.pt' : 'config.idioma.en')}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="config__grupo">
          <legend>{t('dados.titulo')}</legend>

          <p className="config__nota">{t('dados.explicacao')}</p>

          <Botao onClick={() => void exportar()} disabled={ocupado}>
            {ocupado ? t('dados.exportando') : t('dados.exportar')}
          </Botao>

          {confirmandoExclusao ? (
            <>
              <p className="config__alerta">{t('dados.excluir.confirmacao')}</p>
              {/*
                O aviso da assinatura é prevenção de erro, não letra miúda:
                apagar a conta aqui não cancela a cobrança que vive no gateway.
              */}
              <p className="config__nota">{t('dados.excluir.avisoAssinatura')}</p>
              <Botao variante="discreta" onClick={() => void excluir()} disabled={ocupado}>
                {ocupado ? t('dados.excluindo') : t('dados.excluir.confirmar')}
              </Botao>
              <Botao onClick={() => setConfirmandoExclusao(false)} disabled={ocupado}>
                {t('dados.excluir.cancelar')}
              </Botao>
            </>
          ) : (
            <Botao variante="discreta" onClick={() => setConfirmandoExclusao(true)}>
              {t('dados.excluir')}
            </Botao>
          )}

          {aviso ? (
            <p className="config__nota" role="status">
              {t(aviso)}
            </p>
          ) : null}
        </fieldset>

        <Botao variante="discreta" onClick={aoFechar}>
          {t('config.fechar')}
        </Botao>
      </div>
    </div>
  )
}

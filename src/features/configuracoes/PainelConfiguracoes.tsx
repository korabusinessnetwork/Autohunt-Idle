import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import { IDIOMAS } from '../../lib/i18n'
import './PainelConfiguracoes.css'

// Troca manual de idioma (core, 13). A detecção automática pelo navegador
// acontece na primeira abertura; aqui o jogador sobrepõe, e a escolha fica
// guardada.

export function PainelConfiguracoes({ aoFechar }: { aoFechar: () => void }) {
  const { t, idioma, trocarIdioma } = useSessao()

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

        <Botao variante="discreta" onClick={aoFechar}>
          {t('config.fechar')}
        </Botao>
      </div>
    </div>
  )
}

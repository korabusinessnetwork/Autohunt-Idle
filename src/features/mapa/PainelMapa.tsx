import { Botao } from '../../components/shared/Botao'
import { Paginacao, usePaginacao } from '../../components/shared/ListaPaginada'
import { useSessao } from '../../context/SessaoContext'
import {
  MAPAS,
  NIVEL_DA_ULTIMA_LEVA,
  mapaLiberado,
  niveisParaLiberar,
} from '../../game/mapas'
import { formatarNumero } from '../../utils/formato'
import './PainelMapa.css'

// O painel de mapa — implementa `specs/mapas-instanciados-combate-e-hud.md` (2).
//
// A regra de produto que molda esta tela: mapa é CENÁRIO. Um mapa avançado não
// rende mais nada — o servidor credita por tempo × poder e não sabe onde o
// herói está. Por isso a tela não promete recompensa maior em lugar nenhum: ela
// vende lugar novo, que é o que de fato entrega.
//
// E por isso mesmo o cadeado aqui não protege coisa alguma: ele existe para dar
// ritmo de descoberta, não para impedir trapaça. Forçar o mapa 8 no nível 1
// mostraria o cenário do endgame e creditaria exatamente o mesmo.
//
// Mapa bloqueado DIZ o que falta, com número, em vez de só apagar o botão:
// prevenção de erro vale mais que mensagem de erro (CLAUDE.md).

interface Props {
  mapaAtual: number
  aoViajar: (mapaId: number) => void
  aoFechar: () => void
}

export function PainelMapa({ mapaAtual, aoViajar, aoFechar }: Props) {
  const { t, idioma, snapshot } = useSessao()
  const nivel = snapshot?.jogador.nivel ?? 1

  // Numa tela larga os oito mapas cabem todos na grade e o controle de página
  // nem aparece. No celular em pé cabem dois ou três — e aí vira página, nunca
  // rolagem. A lista abre onde o herói está.
  const paginado = usePaginacao(
    MAPAS,
    Math.max(
      0,
      MAPAS.findIndex((mapa) => mapa.id === mapaAtual),
    ),
  )

  return (
    <div className="mapa" role="dialog" aria-modal="true" aria-labelledby="mapa-titulo">
      <div className="mapa__cartao">
        <h2 className="mapa__titulo" id="mapa-titulo">
          {t('mapa.titulo')}
        </h2>
        <p className="mapa__explicacao">{t('mapa.explicacao')}</p>

        <ul className="mapa__lista lista-paginada" ref={paginado.alvo}>
          {paginado.itensDaPagina.map((mapa) => {
            const liberado = mapaLiberado(mapa, nivel)
            const aqui = mapa.id === mapaAtual
            const faltam = niveisParaLiberar(mapa, nivel)

            return (
              <li
                key={mapa.id}
                className={`mapa__item ${aqui ? 'mapa__item--aqui' : ''} ${
                  liberado ? '' : 'mapa__item--bloqueado'
                }`.trim()}
              >
                {/*
                  A miniatura é a cor do bioma, não uma imagem: os tokens
                  `--bioma-N-*` já são a identidade visual de cada zona, e um PNG
                  por mapa custaria oito arquivos no orçamento de portal para
                  dizer a mesma coisa.
                */}
                <span
                  className={`mapa__amostra mapa__amostra--${mapa.bioma.token}`}
                  aria-hidden="true"
                />

                <div className="mapa__info">
                  <strong className="mapa__nome">{t(mapa.bioma.nome)}</strong>
                  <span className="mapa__faixa">
                    {t('mapa.faixaDeNivel', {
                      de: formatarNumero(mapa.nivelMinimo, idioma),
                      ate: formatarNumero(mapa.nivelMinimo + 9, idioma),
                    })}
                  </span>
                </div>

                {aqui ? (
                  <span className="mapa__aqui">{t('mapa.vocEstaAqui')}</span>
                ) : liberado ? (
                  <Botao onClick={() => aoViajar(mapa.id)}>{t('mapa.viajar')}</Botao>
                ) : (
                  <span className="mapa__bloqueio">
                    {t('mapa.faltamNiveis', { niveis: formatarNumero(faltam, idioma) })}
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        <Paginacao pagina={paginado.pagina} paginas={paginado.paginas} irPara={paginado.irPara} />

        {/*
          O jogador de nível alto precisa saber que o teto é de CONTEÚDO, e não
          do personagem dele. Sem esta linha, chegar ao 81 e não ver mapa novo
          lê como bug.
        */}
        {nivel > NIVEL_DA_ULTIMA_LEVA ? (
          <p className="mapa__aviso">
            {t('mapa.alemDaUltimaLeva', {
              nivel: formatarNumero(NIVEL_DA_ULTIMA_LEVA, idioma),
            })}
          </p>
        ) : null}

        <Botao variante="discreta" onClick={aoFechar}>
          {t('config.fechar')}
        </Botao>
      </div>
    </div>
  )
}

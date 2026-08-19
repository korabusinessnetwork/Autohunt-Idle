import type { CSSProperties } from 'react'

import { Botao } from '../../components/shared/Botao'
import { Paginacao, usePaginacao } from '../../components/shared/ListaPaginada'
import { useSessao } from '../../context/SessaoContext'
import { QUADROS_CENA, arteDaCenaAnimada, arteDoCenario, urlDaArte } from '../../game/atlas'
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

/**
 * A folha animada da zona, quando ela existe. Só a fábrica morta tem.
 *
 * Envolvido numa função para o JSX não chamar `arteDaCenaAnimada` duas vezes
 * por item — uma para decidir a classe, outra para montar a URL.
 */
function cenaAnimada(token: number): string | null {
  return arteDaCenaAnimada(token)
}

/**
 * As duas variáveis que a miniatura precisa: a imagem e quantos quadros ela
 * tem.
 *
 * VAI COMO CUSTOM PROPERTY, e não como `background-image` inline. O JSX entrega
 * o DADO (qual arquivo, quantos quadros) e o CSS decide o que fazer com ele —
 * enquadramento, animação, o degradê por baixo. É o que mantém o estilo
 * desacoplado da marcação (CLAUDE.md) sem duplicar em CSS os caminhos de
 * arquivo que `atlas.ts` existe para ser o único a conhecer.
 */
function miniatura(token: number): CSSProperties {
  const viva = cenaAnimada(token)
  const caminho = viva ?? arteDoCenario(token)
  return {
    ['--cena' as string]: `url("${urlDaArte(caminho)}")`,
    ['--cena-quadros' as string]: viva ? QUADROS_CENA : 1,
  }
}

interface Props {
  mapaAtual: number
  aoViajar: (mapaId: number) => void
  aoFechar: () => void
}

export function PainelMapa({ mapaAtual, aoViajar, aoFechar }: Props) {
  const { t, idioma, snapshot } = useSessao()
  const nivel = snapshot?.jogador.nivel ?? 1

  // Numa tela larga os mapas cabem todos na grade e o controle de página
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
                  A miniatura é O LUGAR, e não mais só a cor dele.
                  
                  Ela era um degradê dos tokens `--bioma-N-*` porque, na época,
                  um PNG por mapa custaria arquivos no orçamento de portal para
                  dizer a mesma coisa. Duas coisas mudaram: os PNGs passaram a
                  existir de qualquer forma (o motor já os baixa para desenhar o
                  mundo), e com dezesseis zonas a cor parou de bastar — há
                  biomas com o mesmo fundo e a mesma assinatura, cujos degradês
                  saem indistinguíveis lado a lado.
                  
                  E esta é a tela que "vende lugar novo": mostrar o lugar é
                  literalmente a função dela.
                  
                  A cor fica por baixo, no CSS, e continua aparecendo enquanto o
                  PNG não chega — mesma promessa de sempre: arte melhor quando
                  existe, tela inteira quando não.
                */}
                <span
                  className={`mapa__amostra mapa__amostra--${mapa.bioma.token} ${
                    cenaAnimada(mapa.bioma.token) ? 'mapa__amostra--viva' : ''
                  }`.trim()}
                  style={miniatura(mapa.bioma.token)}
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

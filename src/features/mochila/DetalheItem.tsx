import { Botao } from '../../components/shared/Botao'
import { IconeItem } from '../../components/shared/IconeItem'
import { useSessao } from '../../context/SessaoContext'
import { poderDoItem } from '../../game/regrasEquipamento'
import { bonusDeFortificacao, FORTIFICACAO_MAXIMA } from '../../game/regrasFortificacao'
import { nomeDaRaridade } from '../../game/regrasLoot'
import type { ChaveI18n } from '../../lib/i18n'
import type { ItemPossuido, TipoDano } from '../../lib/tipos'
import { formatarNumero } from '../../utils/formato'
import { nomeDoItem } from './nomeDoItem'
import { chaveDaRaridade } from './rotulos'
import './DetalheItem.css'

// "Ver atributos" de UMA peça (pedido do dono, 2026-08-13).
//
// Antes, o que a peça valia aparecia como uma frase única — "Épico · +3 ·
// Mágico · Combina com sua arma" — e daquilo não dá para responder a única
// pergunta que importa na hora de trocar: *quanto* essa peça soma. O número
// saiu de dentro da frase e virou a primeira linha.
//
// É um diálogo por cima da mochila, e não um trecho que abre dentro da linha,
// por causa da regra de que nenhum menu rola: crescer a linha empurra outra
// peça para fora da página, e o jogador perde de vista exatamente aquilo com
// que ele estava comparando.
//
// O poder sai de `poderDoItem`, a MESMA função que o cálculo de combate usa —
// não uma fórmula paralela só para mostrar na tela. Número de tela que diverge
// do número de jogo é pior do que número nenhum.

const ROTULO_DANO: Record<TipoDano, ChaveI18n> = {
  fisico: 'dano.fisico',
  magico: 'dano.magico',
}

const ROTULO_CONJUNTO: Record<string, ChaveI18n> = {
  'bruxa-caramelo': 'conjunto.bruxa-caramelo',
  'cavaleiro-biscoito': 'conjunto.cavaleiro-biscoito',
  'feiticeira-menta': 'conjunto.feiticeira-menta',
  'brutamontes-nougat': 'conjunto.brutamontes-nougat',
}

interface Props {
  item: ItemPossuido
  /** Arma equipada agora — é ela que decide se a afinidade da peça vale. */
  armaEquipada: ItemPossuido | null
  aoEquipar: (item: ItemPossuido) => void
  aoFechar: () => void
  ocupado: boolean
}

export function DetalheItem({ item, armaEquipada, aoEquipar, aoFechar, ocupado }: Props) {
  const { t, idioma } = useSessao()

  const equipada = item.slot !== null
  // Skin é o único equipável que não entra em `poderDoItem`, e essa ausência é
  // estrutural (`regrasEquipamento.ts`): cosmético não muda número, ponto.
  const ehSkin = item.tipo === 'skin'
  const poder = ehSkin ? 0 : poderDoItem(item.raridade, item.fortificacao)
  const ganhoDaFortificacao = Math.round((bonusDeFortificacao(item.fortificacao) - 1) * 100)

  return (
    <div
      className="detalhe-item"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detalhe-item-titulo"
    >
      <div className="detalhe-item__cartao">
        <div className="detalhe-item__topo">
          <span className={`detalhe-item__moldura detalhe-item__moldura--${nomeDaRaridade(item.raridade)}`}>
            <IconeItem
              tipo={item.tipo}
              raridade={item.raridade}
              id={item.id}
              tipoDano={item.tipoDano}
              tamanho={48}
            />
          </span>
          <div className="detalhe-item__identidade">
            <h3 className="detalhe-item__titulo" id="detalhe-item-titulo">
              {nomeDoItem(item, t)}
              {item.fortificacao > 0 ? ` ${t('fort.nivel', { nivel: item.fortificacao })}` : ''}
            </h3>
            <span className={`detalhe-item__tier detalhe-item__tier--${nomeDaRaridade(item.raridade)}`}>
              {t(chaveDaRaridade(item.raridade))}
            </span>
          </div>
        </div>

        {ehSkin ? (
          <p className="detalhe-item__aviso">{t('mochila.semStat')}</p>
        ) : (
          <p className="detalhe-item__poder">
            {t('item.detalhe.poder', { poder: formatarNumero(poder, idioma) })}
          </p>
        )}

        <ul className="detalhe-item__linhas">
          {!ehSkin ? (
            <li className="detalhe-item__linha">
              {item.fortificacao > 0
                ? t('item.detalhe.fortificacao', {
                    nivel: item.fortificacao,
                    ganho: ganhoDaFortificacao,
                  })
                : t('item.detalhe.semFortificacao', { teto: FORTIFICACAO_MAXIMA })}
            </li>
          ) : null}

          {item.tipoDano ? (
            <li className="detalhe-item__linha">
              {t('item.detalhe.dano', { dano: t(ROTULO_DANO[item.tipoDano]) })}
            </li>
          ) : null}

          {item.afinidade ? (
            <li className="detalhe-item__linha">
              {t('item.detalhe.afinidade', { dano: t(ROTULO_DANO[item.afinidade]) })} ·{' '}
              {t(
                armaEquipada?.tipoDano === item.afinidade
                  ? 'afinidade.combina'
                  : 'afinidade.naoCombina',
              )}
            </li>
          ) : null}

          {item.conjuntoId && ROTULO_CONJUNTO[item.conjuntoId] ? (
            <li className="detalhe-item__linha">
              {t('item.detalhe.conjunto', { conjunto: t(ROTULO_CONJUNTO[item.conjuntoId]!) })}
            </li>
          ) : null}
        </ul>

        <div className="detalhe-item__acoes">
          {equipada ? (
            <p className="detalhe-item__emUso">{t('mochila.equipada')}</p>
          ) : (
            <Botao onClick={() => aoEquipar(item)} disabled={ocupado}>
              {t('mochila.equipar')}
            </Botao>
          )}
          <Botao variante="discreta" onClick={aoFechar}>
            {t('config.fechar')}
          </Botao>
        </div>
      </div>
    </div>
  )
}

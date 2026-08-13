import { IconeItem } from '../../components/shared/IconeItem'
import { useSessao } from '../../context/SessaoContext'
import { arteDoHeroi, urlDaArte } from '../../game/atlas'
import { formatarNumero } from '../../utils/formato'
import './RetratoDoHeroi.css'

// O retrato do herói — canto inferior esquerdo, com nível, XP e vitalidade.
//
// Estes três números moravam num painel de texto no alto da tela. Viraram um
// cartão com a CARA do personagem porque é assim que o gênero comunica "este
// aqui é você": o jogador olha o canto e reconhece o boneco, não lê um rótulo.
//
// O retrato acompanha o que está vestido — a skin equipada decide o desenho, e
// a arma equipada aparece no canto do cartão. É a mesma arte que o canvas usa
// (`arteDoHeroi`), então retrato e boneco nunca divergem: trocar de skin muda os
// dois no mesmo quadro.
//
// Nada aqui credita nada. Skin não muda número (é a regra que o painel de
// equipamento avisa em texto), e a vitalidade desta barra é a VISUAL, movida
// pela simulação local — quem decide ciclo perdido é o servidor.

export function RetratoDoHeroi({ vida }: { vida: number }) {
  const { t, idioma, snapshot } = useSessao()

  const jogador = snapshot?.jogador
  const loadout = snapshot?.inventario.loadout ?? {}
  const skin = loadout.skin?.raridade ?? null
  const arma = loadout.arma

  const proporcaoXp = jogador?.xpParaProximoNivel
    ? Math.min(1, jogador.xpNoNivel / jogador.xpParaProximoNivel)
    : 0

  return (
    <div className="retrato">
      <div className="retrato__moldura">
        <img
          className="retrato__foto"
          src={urlDaArte(arteDoHeroi('parado', skin))}
          alt={t('hud.retrato')}
          draggable={false}
        />
        <span className="retrato__nivel" aria-label={t('hud.nivel')}>
          {formatarNumero(jogador?.nivel ?? 1, idioma)}
        </span>

        {/* A arma equipada no canto do retrato: é a peça da build que muda o
            combate na tela, e a única que o jogador troca o tempo todo. */}
        {arma ? (
          <span className="retrato__arma">
            <IconeItem
              tipo="arma"
              raridade={arma.raridade}
              id={arma.id}
              tipoDano={arma.tipoDano}
              tamanho={26}
            />
          </span>
        ) : null}
      </div>

      <div className="retrato__barras">
        <div
          className="retrato__barra retrato__barra--vida"
          role="progressbar"
          aria-label={t('hud.vitalidade')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(vida * 100)}
        >
          <div className="retrato__preenchida" style={{ width: `${vida * 100}%` }} />
        </div>

        <div className="retrato__barra retrato__barra--xp" aria-hidden="true">
          <div className="retrato__preenchida" style={{ width: `${proporcaoXp * 100}%` }} />
        </div>

        <span className="retrato__xp">
          {t('hud.xpParaProximo', {
            atual: formatarNumero(jogador?.xpNoNivel ?? 0, idioma),
            alvo: formatarNumero(jogador?.xpParaProximoNivel ?? 0, idioma),
          })}
        </span>
      </div>
    </div>
  )
}

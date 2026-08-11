import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import { nomeDaRaridade } from '../../game/regrasLoot'
import { checkoutDisponivel } from '../../lib/services/subscriptionService'
import { chaveDaRaridade, ROTULO_TIPO } from '../mochila/rotulos'
import { formatarNumero } from '../../utils/formato'
import './PainelPasse.css'

// A trilha do passe.
//
// A tela mostra a trilha INTEIRA — cada tier, cada recompensa, quantos pontos
// faltam — com ou sem passe comprado. Não é generosidade de UI: um passe pago
// cuja recompensa é desconhecida na hora da compra é recompensa aleatória
// paga, que é restrição CRÍTICA permanente (`memory/restrictions.md`). Ver a
// trilha antes de pagar é o que separa uma coisa da outra.
//
// E não existe contagem regressiva, prazo nem "última chance": a trilha não
// expira, por decisão de produto registrada em `specs/passe-de-recompensas.md`.
// A ausência de urgência aqui é a feature.

export function PainelPasse({ aoFechar }: { aoFechar: () => void }) {
  const { t, idioma, snapshot } = useSessao()

  const passe = snapshot?.passe
  const ativo = passe?.ativo ?? false
  const pontos = passe?.pontos ?? 0
  const tierAtual = passe?.tier ?? 0
  const trilha = passe?.trilha ?? []

  const proximo = trilha.find((degrau) => degrau.tier > tierAtual)
  const faltam = proximo ? Math.max(0, proximo.pontos - pontos) : 0
  // Progresso dentro do degrau atual, para a barra não recomeçar do zero
  // absoluto a cada tier.
  const base = trilha.find((degrau) => degrau.tier === tierAtual)?.pontos ?? 0
  const proporcao =
    proximo && proximo.pontos > base
      ? Math.min(1, Math.max(0, (pontos - base) / (proximo.pontos - base)))
      : 1

  return (
    <div className="passe" role="dialog" aria-modal="true" aria-labelledby="passe-titulo">
      <div className="passe__cartao">
        <h2 className="passe__titulo" id="passe-titulo">
          {t('passe.titulo')}
        </h2>

        <p className="passe__estado">
          {ativo ? t('passe.ativo') : t('passe.inativo')}
        </p>

        {ativo ? (
          <>
            <div className="passe__barra" aria-hidden="true">
              <div className="passe__barra-preenchida" style={{ width: `${proporcao * 100}%` }} />
            </div>
            <p className="passe__detalhe">
              {proximo
                ? t('passe.faltam', {
                    pontos: formatarNumero(faltam, idioma),
                    tier: proximo.tier,
                  })
                : t('passe.completa')}
            </p>
          </>
        ) : (
          <p className="passe__detalhe">{t('passe.explicacao')}</p>
        )}

        {/* A promessa que substitui a contagem regressiva. */}
        <p className="passe__detalhe passe__detalhe--calmo">{t('passe.semPrazo')}</p>

        <ol className="passe__trilha">
          {trilha.map((degrau) => {
            const destravado = degrau.tier <= tierAtual
            return (
              <li
                key={degrau.tier}
                className={`passe__degrau ${destravado ? 'passe__degrau--destravado' : ''}`}
              >
                <span className="passe__tier">{t('passe.tier', { tier: degrau.tier })}</span>
                <span
                  className={`passe__raridade passe__raridade--${nomeDaRaridade(degrau.raridade)}`}
                >
                  {t(chaveDaRaridade(degrau.raridade))}
                </span>
                <span className="passe__premio">
                  {t(ROTULO_TIPO[degrau.tipo])}
                  {degrau.exclusiva ? (
                    <span className="passe__exclusiva">{t('passe.exclusiva')}</span>
                  ) : null}
                </span>
                <span className="passe__pontos">
                  {destravado
                    ? t('passe.destravado')
                    : t('passe.custa', { pontos: formatarNumero(degrau.pontos, idioma) })}
                </span>
              </li>
            )
          })}
        </ol>

        {!ativo ? (
          <>
            {/*
              Sem gateway contratado não há checkout para abrir, e um botão que
              não leva a lugar nenhum é pior que um botão ausente. O motivo
              aparece escrito, como no painel de assinatura.
            */}
            <Botao variante="recompensa" disabled={!checkoutDisponivel()}>
              {t('passe.comprar')}
            </Botao>
            {!checkoutDisponivel() ? (
              <p className="passe__detalhe">{t('passe.indisponivel')}</p>
            ) : null}
          </>
        ) : null}

        <Botao variante="discreta" onClick={aoFechar}>
          {t('config.fechar')}
        </Botao>
      </div>
    </div>
  )
}

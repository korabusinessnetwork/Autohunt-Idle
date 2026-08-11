import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { TelaVazia } from '../../components/shared/EstadoTela'
import { useSessao } from '../../context/SessaoContext'
import type { ChaveI18n } from '../../lib/i18n'
import { comprarOuro } from '../../lib/services/lojaService'
import type { PacoteOuro } from '../../lib/tipos'
import { formatarNumero } from '../../utils/formato'
import './PainelLoja.css'

// Loja de ouro: troca diamante por ouro em quantidade fixa.
//
// Três coisas nesta tela não são escolha de layout, são regra:
//
//   · o preço e a quantidade aparecem INTEIROS no cartão, antes do botão —
//     "X diamantes → Y de ouro". Sem faixa, sem "até", sem bônus surpresa
//     (critérios 3 e 4 da spec, e a restrição ética de transparência);
//   · a linha que diz de onde vem diamante fica sempre visível, porque o
//     caminho gratuito precisa ser óbvio e não uma nota de rodapé;
//   · não existe botão de vender, sacar ou converter nada em dinheiro — e não
//     é omissão de UI: essa rota não existe no servidor.

const ERRO_COMPRA: Record<string, ChaveI18n> = {
  DIAMANTE_INSUFICIENTE: 'loja.erro.DIAMANTE_INSUFICIENTE',
  PACOTE_INDISPONIVEL: 'loja.erro.PACOTE_INDISPONIVEL',
  COMPRA_FALHOU: 'loja.erro.COMPRA_FALHOU',
}

/** Nome amigável do pacote. O id vem do servidor; sem tradução, cai no ouro. */
const ROTULO_PACOTE: Record<string, ChaveI18n> = {
  punhado: 'loja.pacote.punhado',
  saco: 'loja.pacote.saco',
  bau: 'loja.pacote.bau',
}

export function PainelLoja({ aoFechar }: { aoFechar: () => void }) {
  const { t, idioma, snapshot, atualizarSnapshot } = useSessao()

  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ chave: ChaveI18n; ouro?: string } | null>(null)

  const diamante = snapshot?.jogador.diamante ?? 0
  const pacotes = snapshot?.lojaOuro ?? []

  async function trocar(pacote: PacoteOuro) {
    setOcupado(true)
    setAviso(null)
    try {
      const resposta = await comprarOuro(pacote.id)
      if (resposta.error) {
        setAviso({ chave: ERRO_COMPRA[resposta.error.codigo] ?? 'loja.erro.COMPRA_FALHOU' })
        return
      }
      if (resposta.data) {
        atualizarSnapshot(resposta.data)
        setAviso({
          chave: 'loja.comprou',
          ouro: formatarNumero(resposta.data.compra?.ouroRecebido ?? pacote.ouro, idioma),
        })
      }
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="loja" role="dialog" aria-modal="true" aria-labelledby="loja-titulo">
      <div className="loja__cartao">
        <h2 className="loja__titulo" id="loja-titulo">
          {t('loja.titulo')}
        </h2>

        <p className="loja__saldo">
          {t('hud.diamante')}: {formatarNumero(diamante, idioma)}
        </p>

        <p className="loja__explicacao">{t('loja.explicacao')}</p>
        <p className="loja__explicacao">{t('loja.comoGanhar')}</p>

        {pacotes.length === 0 ? (
          <TelaVazia titulo={t('loja.titulo')} mensagem={t('loja.vazia')} />
        ) : (
          <ul className="loja__lista">
            {pacotes.map((pacote) => (
              <li key={pacote.id} className="loja__linha">
                <span className="loja__nome">
                  {ROTULO_PACOTE[pacote.id] ? t(ROTULO_PACOTE[pacote.id]!) : pacote.id}
                </span>
                <span className="loja__ouro">
                  {t('loja.ouro', { ouro: formatarNumero(pacote.ouro, idioma) })}
                </span>
                <span className="loja__preco">
                  {t('loja.preco', { diamantes: formatarNumero(pacote.diamantes, idioma) })}
                </span>
                <Botao
                  onClick={() => void trocar(pacote)}
                  disabled={ocupado || diamante < pacote.diamantes}
                >
                  {ocupado ? t('loja.comprando') : t('loja.comprar')}
                </Botao>
              </li>
            ))}
          </ul>
        )}

        {aviso ? (
          <p className="loja__aviso" role="status">
            {t(aviso.chave, aviso.ouro !== undefined ? { ouro: aviso.ouro } : undefined)}
          </p>
        ) : null}

        <Botao variante="discreta" onClick={aoFechar}>
          {t('config.fechar')}
        </Botao>
      </div>
    </div>
  )
}

import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { TelaVazia } from '../../components/shared/EstadoTela'
import { useSessao } from '../../context/SessaoContext'
import { ITENS_POR_SINTESE, nomeDaRaridade, TIER_MAXIMO } from '../../game/regrasLoot'
import type { ChaveI18n } from '../../lib/i18n'
import { iniciarDungeon, sintetizar } from '../../lib/services/itemService'
import type { GrupoInventario } from '../../lib/tipos'
import { chaveDaRaridade, ROTULO_TIPO } from './rotulos'
import './PainelMochila.css'

// Mochila: inventário, dungeon e síntese numa tela só.
//
// Duas regras de produto moldam o que aparece aqui:
//   · síntese não custa nada além dos próprios itens (critério 13 da spec de
//     origem) — então não há preço em lugar nenhum desta tela;
//   · perder a dungeon não tira nada além da chave, e o texto diz isso, porque
//     o tom nunca é punitivo (`memory/identity.md`).

const ERRO_SINTESE: Record<string, ChaveI18n> = {
  ITENS_INSUFICIENTES: 'sintese.erro.ITENS_INSUFICIENTES',
  TIER_MAXIMO: 'sintese.erro.TIER_MAXIMO',
  SINTESE_FALHOU: 'sintese.erro.SINTESE_FALHOU',
}

export function PainelMochila({ aoFechar }: { aoFechar: () => void }) {
  const { t, snapshot, atualizarSnapshot } = useSessao()

  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<ChaveI18n | null>(null)

  const inventario = snapshot?.inventario
  const chaves = inventario?.chaves ?? 0
  const grupos = inventario?.porTipoERaridade ?? []

  async function entrarNaDungeon() {
    setOcupado(true)
    setAviso(null)
    try {
      const resposta = await iniciarDungeon()
      if (resposta.error || !resposta.data) {
        setAviso('sintese.erro.SINTESE_FALHOU')
        return
      }
      atualizarSnapshot(resposta.data)

      const resultado = resposta.data.dungeon
      if (!resultado?.resolvida) setAviso('dungeon.semChave')
      else setAviso(resultado.venceu ? 'dungeon.venceu' : 'dungeon.perdeu')
    } finally {
      setOcupado(false)
    }
  }

  async function combinar(grupo: GrupoInventario) {
    if (grupo.tipo === 'chave') return
    setOcupado(true)
    setAviso(null)
    try {
      const resposta = await sintetizar(grupo.tipo, grupo.raridade)
      if (resposta.error) {
        setAviso(ERRO_SINTESE[resposta.error.codigo] ?? 'sintese.erro.SINTESE_FALHOU')
        return
      }
      if (resposta.data) atualizarSnapshot(resposta.data)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mochila" role="dialog" aria-modal="true" aria-labelledby="mochila-titulo">
      <div className="mochila__cartao">
        <h2 className="mochila__titulo" id="mochila-titulo">
          {t('mochila.titulo')}
        </h2>

        <p className="mochila__chaves">{t('mochila.chaves', { quantidade: chaves })}</p>

        <Botao variante="recompensa" onClick={() => void entrarNaDungeon()} disabled={ocupado}>
          {ocupado ? t('dungeon.entrando') : t('dungeon.entrar')}
        </Botao>

        {aviso ? (
          <p className="mochila__aviso" role="status">
            {t(aviso)}
          </p>
        ) : null}

        <h3 className="mochila__subtitulo">{t('sintese.titulo')}</h3>
        <p className="mochila__explicacao">{t('sintese.explicacao')}</p>

        {grupos.length === 0 ? (
          <TelaVazia titulo={t('mochila.vazia.titulo')} mensagem={t('mochila.vazia.mensagem')} />
        ) : (
          <ul className="mochila__lista">
            {grupos.map((grupo) => {
              const podeCombinar =
                grupo.quantidade >= ITENS_POR_SINTESE && grupo.raridade < TIER_MAXIMO
              const faltam = Math.max(0, ITENS_POR_SINTESE - grupo.quantidade)

              return (
                <li key={`${grupo.tipo}-${grupo.raridade}`} className="mochila__linha">
                  <span className={`mochila__tier mochila__tier--${nomeDaRaridade(grupo.raridade)}`}>
                    {t(chaveDaRaridade(grupo.raridade))}
                  </span>
                  <span className="mochila__tipo">{t(ROTULO_TIPO[grupo.tipo])}</span>
                  <span className="mochila__quantidade">
                    {t('mochila.quantidade', { quantidade: grupo.quantidade })}
                  </span>

                  {podeCombinar ? (
                    <Botao onClick={() => void combinar(grupo)} disabled={ocupado}>
                      {ocupado ? t('sintese.combinando') : t('sintese.combinar')}
                    </Botao>
                  ) : (
                    <span className="mochila__faltam">
                      {grupo.raridade >= TIER_MAXIMO
                        ? t('sintese.erro.TIER_MAXIMO')
                        : t('sintese.faltam', { faltam })}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <Botao variante="discreta" onClick={aoFechar}>
          {t('config.fechar')}
        </Botao>
      </div>
    </div>
  )
}

import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { TelaVazia } from '../../components/shared/EstadoTela'
import { IconeItem } from '../../components/shared/IconeItem'
import { Paginacao, usePaginacao } from '../../components/shared/ListaPaginada'
import { useSessao } from '../../context/SessaoContext'
import { ITENS_POR_SINTESE, nomeDaRaridade, TIER_MAXIMO } from '../../game/regrasLoot'
import type { ChaveI18n } from '../../lib/i18n'
import { sintetizar } from '../../lib/services/itemService'
import type { GrupoInventario } from '../../lib/tipos'
import { nomeDoItem } from './nomeDoItem'
import { chaveDaRaridade } from './rotulos'
import './PainelSintese.css'

// Síntese — agora atrás de um botão (pedido do dono, 2026-08-13).
//
// Ela morava DENTRO da lista de itens da mochila, e era ela que decidia o
// formato daquela lista: para combinar é preciso ver PILHAS ("Arma comum ×9"),
// então o inventário mostrava pilhas, e o jogador que só queria vestir uma peça
// pagava por uma tela desenhada para outra coisa. Pior: a síntese ficava
// visível o tempo todo, mesmo nas horas — a maioria delas — em que não havia
// nove de nada para combinar.
//
// Agora a mochila lista peças, com nome; a síntese tem quadro próprio e só
// aparece quando alguém abre. É a mesma mecânica, sem o imposto de atenção.
//
// Duas regras de produto continuam moldando esta tela:
//   · síntese não custa nada além dos próprios itens (critério 13 da spec de
//     origem) — por isso não há preço em lugar nenhum aqui;
//   · o que está pronto vem primeiro. Numa lista paginada, deixar as pilhas
//     completas espalhadas no meio das incompletas obriga a trocar de página
//     procurando o que dá para fazer (Princípio nº 1).

const ERRO_SINTESE: Record<string, ChaveI18n> = {
  ITENS_INSUFICIENTES: 'sintese.erro.ITENS_INSUFICIENTES',
  TIER_MAXIMO: 'sintese.erro.TIER_MAXIMO',
  SINTESE_FALHOU: 'sintese.erro.SINTESE_FALHOU',
}

/** Pronta primeiro; depois, quem está mais perto de ficar pronta. */
function ordenar(grupos: readonly GrupoInventario[]): GrupoInventario[] {
  return [...grupos].sort((a, b) => {
    const prontaA = a.quantidade >= ITENS_POR_SINTESE && a.raridade < TIER_MAXIMO ? 1 : 0
    const prontaB = b.quantidade >= ITENS_POR_SINTESE && b.raridade < TIER_MAXIMO ? 1 : 0
    if (prontaA !== prontaB) return prontaB - prontaA
    if (a.quantidade !== b.quantidade) return b.quantidade - a.quantidade
    if (a.raridade !== b.raridade) return b.raridade - a.raridade
    return a.tipo < b.tipo ? -1 : a.tipo > b.tipo ? 1 : 0
  })
}

export function PainelSintese({ aoFechar }: { aoFechar: () => void }) {
  const { t, snapshot, atualizarSnapshot } = useSessao()

  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<ChaveI18n | null>(null)

  // Chave fica de fora: não se combina, e a linha dela só existia aqui porque a
  // lista era o inventário inteiro. O botão que ela ganhava não fazia nada.
  const grupos = ordenar(
    (snapshot?.inventario?.porTipoERaridade ?? []).filter((grupo) => grupo.tipo !== 'chave'),
  )

  const paginado = usePaginacao<GrupoInventario>(grupos)

  async function combinar(grupo: GrupoInventario) {
    // A lista já filtra chave; esta guarda é o que o tipo de `sintetizar` cobra,
    // e ela vale como documentação: chave não se combina.
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
    <div className="sintese" role="dialog" aria-modal="true" aria-labelledby="sintese-titulo">
      <div className="sintese__cartao">
        <h2 className="sintese__titulo" id="sintese-titulo">
          {t('sintese.titulo')}
        </h2>
        <p className="sintese__explicacao">{t('sintese.explicacao')}</p>

        {aviso ? (
          <p className="sintese__aviso" role="status">
            {t(aviso)}
          </p>
        ) : null}

        {grupos.length === 0 ? (
          <TelaVazia titulo={t('sintese.vazia.titulo')} mensagem={t('sintese.vazia.mensagem')} />
        ) : (
          <ul className="sintese__lista lista-paginada" ref={paginado.alvo}>
            {paginado.itensDaPagina.map((grupo) => {
              const podeCombinar =
                grupo.quantidade >= ITENS_POR_SINTESE && grupo.raridade < TIER_MAXIMO
              const faltam = Math.max(0, ITENS_POR_SINTESE - grupo.quantidade)

              return (
                <li key={`${grupo.tipo}-${grupo.raridade}`} className="sintese__linha">
                  <span className="sintese__icone">
                    <IconeItem tipo={grupo.tipo} raridade={grupo.raridade} tamanho={36} />
                  </span>
                  <span
                    className={`sintese__tier sintese__tier--${nomeDaRaridade(grupo.raridade)}`}
                  >
                    {t(chaveDaRaridade(grupo.raridade))}
                  </span>
                  {/*
                    A pilha é nomeada SEM id, de propósito: nove armas comuns são
                    nove armas diferentes, e chamar a pilha de "Adaga comum"
                    porque a primeira peça é uma adaga seria mentira. Ver
                    `nomeDoItem.ts`.
                  */}
                  <span className="sintese__nome">{nomeDoItem(grupo, t)}</span>
                  <span className="sintese__quantidade">
                    {t('mochila.quantidade', { quantidade: grupo.quantidade })}
                  </span>

                  <div className="sintese__acoes">
                    {podeCombinar ? (
                      <Botao onClick={() => void combinar(grupo)} disabled={ocupado}>
                        {ocupado ? t('sintese.combinando') : t('sintese.combinar')}
                      </Botao>
                    ) : (
                      <span className="sintese__faltam">
                        {grupo.raridade >= TIER_MAXIMO
                          ? t('sintese.erro.TIER_MAXIMO')
                          : t('sintese.faltam', { faltam })}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <Paginacao pagina={paginado.pagina} paginas={paginado.paginas} irPara={paginado.irPara} />

        <div className="sintese__rodape">
          <Botao variante="discreta" onClick={aoFechar} disabled={ocupado}>
            {t('config.fechar')}
          </Botao>
        </div>
      </div>
    </div>
  )
}

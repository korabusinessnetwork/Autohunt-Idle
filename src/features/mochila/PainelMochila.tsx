import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { TelaVazia } from '../../components/shared/EstadoTela'
import { Icone } from '../../components/shared/Icone'
import { IconeItem } from '../../components/shared/IconeItem'
import { Paginacao, usePaginacao } from '../../components/shared/ListaPaginada'
import { useSessao } from '../../context/SessaoContext'
import { ITENS_POR_SINTESE, nomeDaRaridade, TIER_MAXIMO } from '../../game/regrasLoot'
import type { ChaveI18n } from '../../lib/i18n'
import { equiparItem, iniciarDungeon, sintetizar } from '../../lib/services/itemService'
import type { GrupoInventario, ItemPossuido } from '../../lib/tipos'
import { formatarNumero } from '../../utils/formato'
import { AbaEquipamento } from './AbaEquipamento'
import { ProvedorDeArraste, useEstadoDeArraste } from './ArrasteDeItem'
import { DetalheItem } from './DetalheItem'
import { melhorDoGrupo } from './selecaoDeItem'
import { chaveDaRaridade, ROTULO_TIPO } from './rotulos'
import './PainelMochila.css'

// Mochila: equipar, dungeon e síntese numa tela só.
//
// REORGANIZADA em 2026-08-13, a pedido do dono. Antes eram DOIS ícones na
// barra — "mochila" e "equipamento" — e a divisão só fazia sentido para quem
// construiu o jogo: a mochila mostrava o que você tem, o equipamento vestia.
// O jogador abre a mochila para vestir. Agora é um lugar só.
//
// E é um lugar LADO A LADO, não empilhado: a primeira versão desta fusão usou
// abas, e abas são a mesma fricção de antes com outro nome — continuava sendo
// preciso clicar para descobrir onde as coisas estão. Agora equipamento e itens
// dividem a largura, e o cartão não rola: as duas listas paginam por dentro,
// quando o inventário cresce além do que cabe.
//
// SEGUNDA RODADA (mesmo dia, mesmo dono): a lista de itens deixou de ser só
// matéria-prima de síntese. Cada pilha agora tem "Equipar", tem "Atributos" e
// pode ser ARRASTADA até o slot do lado — três caminhos para a mesma coisa, de
// propósito. O botão é o caminho que ninguém precisa descobrir; o arraste é o
// atalho de quem já entendeu o jogo. Nenhum dos dois é obrigatório.
//
// O botão de atributos do rodapé é outra coisa: ele abre os atributos do
// PERSONAGEM (força, agilidade…). O da linha abre os da PEÇA. Rótulos
// diferentes de propósito — ver `DetalheItem.tsx`.
//
// Duas regras de produto continuam moldando a lista de itens:
//   · síntese não custa nada além dos próprios itens (critério 13 da spec de
//     origem) — então não há preço em lugar nenhum desta tela;
//   · perder a dungeon não tira nada além da chave, e o texto diz isso, porque
//     o tom nunca é punitivo (`memory/identity.md`).

const ERRO_SINTESE: Record<string, ChaveI18n> = {
  ITENS_INSUFICIENTES: 'sintese.erro.ITENS_INSUFICIENTES',
  TIER_MAXIMO: 'sintese.erro.TIER_MAXIMO',
  SINTESE_FALHOU: 'sintese.erro.SINTESE_FALHOU',
}

export function PainelMochila({
  aoFechar,
  aoVerAtributos,
}: {
  aoFechar: () => void
  aoVerAtributos: () => void
}) {
  const { t, idioma, snapshot, atualizarSnapshot } = useSessao()

  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<ChaveI18n | null>(null)
  const [itemNoDetalhe, setItemNoDetalhe] = useState<ItemPossuido | null>(null)

  const inventario = snapshot?.inventario
  const chaves = inventario?.chaves ?? 0
  const grupos = inventario?.porTipoERaridade ?? []
  const equipaveis = inventario?.equipaveis ?? []

  // Os grupos de síntese crescem com o tempo de jogo (10 tiers × cada tipo).
  // Página em vez de rolagem, como no resto dos menus.
  const paginado = usePaginacao<GrupoInventario>(grupos)

  async function equipar(item: ItemPossuido) {
    setOcupado(true)
    setAviso(null)
    try {
      const resposta = await equiparItem(item.id)
      if (resposta.error) {
        setAviso('mochila.erroAoEquipar')
        return
      }
      if (resposta.data) atualizarSnapshot(resposta.data)
      // Fecha o detalhe: o número que ele mostrava já é passado, e deixá-lo
      // aberto sobre a peça recém-vestida esconde justamente o efeito da troca.
      setItemNoDetalhe(null)
    } finally {
      setOcupado(false)
    }
  }

  // O arraste é criado aqui e consumido nos dois lados: as linhas de item deste
  // arquivo o iniciam, os slots de `AbaEquipamento` o recebem.
  const arraste = useEstadoDeArraste((item) => void equipar(item))

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
    <ProvedorDeArraste valor={arraste}>
      <div className="mochila" role="dialog" aria-modal="true" aria-labelledby="mochila-titulo">
        <div className="mochila__cartao">
          <h2 className="mochila__titulo" id="mochila-titulo">
            {t('mochila.titulo')}
          </h2>

          {/* O poder fica no cabeçalho, acima das colunas: é o número que resume
              a mochila inteira, e some da vista se morar dentro de uma delas. */}
          <p className="mochila__poder">
            {t('mochila.poder', {
              poder: formatarNumero(inventario?.poderDeAtaque ?? 0, idioma),
            })}
          </p>

          <div className="mochila__colunas">
            <section className="mochila__coluna" aria-label={t('mochila.equipamento')}>
              <h3 className="mochila__subtitulo">
                <Icone nome="equipamento" tamanho={20} />
                {t('mochila.equipamento')}
              </h3>
              <AbaEquipamento aoVerDetalhe={setItemNoDetalhe} />
            </section>

            <section className="mochila__coluna" aria-label={t('mochila.aba.itens')}>
              <h3 className="mochila__subtitulo">
                <Icone nome="mochila" tamanho={20} />
                {t('mochila.aba.itens')}
              </h3>

              <p className="mochila__chaves">{t('mochila.chaves', { quantidade: chaves })}</p>

              <Botao
                variante="recompensa"
                onClick={() => void entrarNaDungeon()}
                disabled={ocupado}
              >
                {ocupado ? t('dungeon.entrando') : t('dungeon.entrar')}
              </Botao>

              {aviso ? (
                <p className="mochila__aviso" role="status">
                  {t(aviso)}
                </p>
              ) : null}

              <h4 className="mochila__subtitulo mochila__subtitulo--menor">{t('sintese.titulo')}</h4>
              <p className="mochila__explicacao">{t('sintese.explicacao')}</p>

              {grupos.length === 0 ? (
                <TelaVazia
                  titulo={t('mochila.vazia.titulo')}
                  mensagem={t('mochila.vazia.mensagem')}
                />
              ) : (
                <ul className="mochila__lista lista-paginada" ref={paginado.alvo}>
                  {paginado.itensDaPagina.map((grupo) => {
                    const podeCombinar =
                      grupo.quantidade >= ITENS_POR_SINTESE && grupo.raridade < TIER_MAXIMO
                    const faltam = Math.max(0, ITENS_POR_SINTESE - grupo.quantidade)
                    // A pilha responde pela melhor peça dela — ver
                    // `selecaoDeItem.ts`. `null` em chave e pedras, que não se
                    // equipam e por isso não ganham os dois botões.
                    const peca = melhorDoGrupo(equipaveis, grupo.tipo, grupo.raridade)

                    return (
                      <li
                        key={`${grupo.tipo}-${grupo.raridade}`}
                        className={`mochila__linha ${peca ? 'arrastavel' : ''}`.trim()}
                        onPointerDown={peca ? (e) => arraste.comecar(peca, e) : undefined}
                      >
                        {/* A célula existe mesmo sem arte (as pedras), senão a
                            linha inteira escorrega uma coluna e a lista desalinha. */}
                        <span className="mochila__icone">
                          <IconeItem tipo={grupo.tipo} raridade={grupo.raridade} tamanho={36} />
                        </span>
                        <span
                          className={`mochila__tier mochila__tier--${nomeDaRaridade(grupo.raridade)}`}
                        >
                          {t(chaveDaRaridade(grupo.raridade))}
                        </span>
                        <span className="mochila__tipo">{t(ROTULO_TIPO[grupo.tipo])}</span>
                        <span className="mochila__quantidade">
                          {t('mochila.quantidade', { quantidade: grupo.quantidade })}
                        </span>

                        <div className="mochila__acoes">
                          {peca ? (
                            <>
                              {peca.slot !== null ? (
                                <span className="mochila__emUso">{t('mochila.equipada')}</span>
                              ) : (
                                <Botao onClick={() => void equipar(peca)} disabled={ocupado}>
                                  {t('mochila.equipar')}
                                </Botao>
                              )}
                              <Botao
                                variante="discreta"
                                className="botao--so-icone"
                                onClick={() => setItemNoDetalhe(peca)}
                                title={t('item.detalhe.ver')}
                                aria-label={t('item.detalhe.ver')}
                              >
                                <Icone nome="atributos" tamanho={18} />
                              </Botao>
                            </>
                          ) : null}

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
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              <Paginacao
                pagina={paginado.pagina}
                paginas={paginado.paginas}
                irPara={paginado.irPara}
              />
            </section>
          </div>

          <div className="mochila__rodape">
            <Botao onClick={aoVerAtributos}>{t('mochila.verAtributos')}</Botao>
            <Botao variante="discreta" onClick={aoFechar}>
              {t('config.fechar')}
            </Botao>
          </div>
        </div>
      </div>

      {itemNoDetalhe ? (
        <DetalheItem
          item={itemNoDetalhe}
          armaEquipada={inventario?.loadout.arma ?? null}
          aoEquipar={(item) => void equipar(item)}
          aoFechar={() => setItemNoDetalhe(null)}
          ocupado={ocupado}
        />
      ) : null}

      {arraste.fantasma}
    </ProvedorDeArraste>
  )
}

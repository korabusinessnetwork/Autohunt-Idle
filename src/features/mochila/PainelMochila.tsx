import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { TelaVazia } from '../../components/shared/EstadoTela'
import { Icone } from '../../components/shared/Icone'
import { IconeItem } from '../../components/shared/IconeItem'
import { Paginacao, usePaginacao } from '../../components/shared/ListaPaginada'
import { useSessao } from '../../context/SessaoContext'
import { nomeDaRaridade } from '../../game/regrasLoot'
import type { ChaveI18n } from '../../lib/i18n'
import { equiparItem, iniciarDungeon } from '../../lib/services/itemService'
import type { ItemPossuido } from '../../lib/tipos'
import { formatarNumero } from '../../utils/formato'
import { AbaEquipamento } from './AbaEquipamento'
import { ProvedorDeArraste, useEstadoDeArraste } from './ArrasteDeItem'
import { DetalheItem } from './DetalheItem'
import { nomeDoItem } from './nomeDoItem'
import { PainelSintese } from './PainelSintese'
import { ordenarParaMochila } from './selecaoDeItem'
import { chaveDaRaridade } from './rotulos'
import './PainelMochila.css'

// Mochila: equipar e dungeon numa tela só.
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
// SEGUNDA RODADA (mesmo dia, mesmo dono): cada peça tem "Equipar", tem
// "Atributos" e pode ser ARRASTADA até o slot do lado — três caminhos para a
// mesma coisa, de propósito. O botão é o caminho que ninguém precisa descobrir;
// o arraste é o atalho de quem já entendeu o jogo. Nenhum dos dois é
// obrigatório.
//
// TERCEIRA RODADA (idem): a lista virou o que ela sempre devia ter sido — as
// PEÇAS, uma por uma, cada uma com o nome dela ("Espada lendária", e não
// "Arma"). Ela mostrava pilhas agrupadas por tipo e raridade porque a SÍNTESE
// precisava de pilhas, e a síntese morava aqui dentro, visível o tempo inteiro.
// Ela saiu para `PainelSintese.tsx`, atrás de um botão, e levou as pilhas
// junto. Nome de peça vem de `nomeDoItem.ts`, ordem vem de `selecaoDeItem.ts`.
//
// O botão de atributos do rodapé é outra coisa: ele abre os atributos do
// PERSONAGEM (força, inteligência…). O da linha abre os da PEÇA. Rótulos
// diferentes de propósito — ver `DetalheItem.tsx`.
//
// Regra de tom que continua valendo: perder a dungeon não tira nada além da
// chave, e o texto diz isso, porque o tom nunca é punitivo
// (`memory/identity.md`).

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
  const [sinteseAberta, setSinteseAberta] = useState(false)

  const inventario = snapshot?.inventario
  const chaves = inventario?.chaves ?? 0
  const pecas = ordenarParaMochila(inventario?.equipaveis ?? [])

  // O inventário não tem teto. Página em vez de rolagem, como no resto dos
  // menus (`docs/02_DESIGN_SYSTEM/menus-sem-rolagem.md`).
  const paginado = usePaginacao<ItemPossuido>(pecas)

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

              <div className="mochila__atalhos">
                <Botao
                  variante="recompensa"
                  onClick={() => void entrarNaDungeon()}
                  disabled={ocupado}
                >
                  {ocupado ? t('dungeon.entrando') : t('dungeon.entrar')}
                </Botao>
                <Botao onClick={() => setSinteseAberta(true)} disabled={ocupado}>
                  {t('sintese.abrir')}
                </Botao>
              </div>

              {aviso ? (
                <p className="mochila__aviso" role="status">
                  {t(aviso)}
                </p>
              ) : null}

              {pecas.length === 0 ? (
                <TelaVazia
                  titulo={t('mochila.vazia.titulo')}
                  mensagem={t('mochila.vazia.mensagem')}
                />
              ) : (
                <ul className="mochila__lista lista-paginada" ref={paginado.alvo}>
                  {paginado.itensDaPagina.map((peca) => (
                    <li
                      key={peca.id}
                      className="mochila__linha arrastavel"
                      onPointerDown={(e) => arraste.comecar(peca, e)}
                    >
                      <span className="mochila__icone">
                        <IconeItem
                          tipo={peca.tipo}
                          raridade={peca.raridade}
                          id={peca.id}
                          tipoDano={peca.tipoDano}
                          tamanho={36}
                        />
                      </span>
                      <span
                        className={`mochila__tier mochila__tier--${nomeDaRaridade(peca.raridade)}`}
                      >
                        {t(chaveDaRaridade(peca.raridade))}
                      </span>
                      {/* O nome da peça, não o slot dela — o pedido do dono, e a
                          razão de `nomeDoItem.ts` existir. */}
                      <span className="mochila__nome">{nomeDoItem(peca, t)}</span>
                      <span className="mochila__fort">
                        {peca.fortificacao > 0 ? t('fort.nivel', { nivel: peca.fortificacao }) : ''}
                      </span>

                      <div className="mochila__acoes">
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
                      </div>
                    </li>
                  ))}
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

      {sinteseAberta ? <PainelSintese aoFechar={() => setSinteseAberta(false)} /> : null}

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

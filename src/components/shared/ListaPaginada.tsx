import { useLayoutEffect, useRef, useState } from 'react'

import { useSessao } from '../../context/SessaoContext'
import './ListaPaginada.css'

// Paginação — a resposta do projeto para "menu não rola".
//
// Regra do dono (2026-08-13): NENHUM menu do jogo tem barra de rolagem; tudo
// precisa caber na tela. Para listas de tamanho conhecido isso se resolve no
// CSS (uma grade em vez de uma pilha). Para listas que crescem sem teto —
// inventário, ranking, trilha do passe — não existe CSS que resolva: ou a
// lista rola, ou vira página.
//
// Aqui ela vira página. E o número de itens por página NÃO é uma constante
// chutada, nem uma conta em cima de uma altura de linha escrita à mão: as
// linhas REAIS são medidas depois de desenhadas. Um nome de zona que quebra em
// duas linhas no celular e cabe em uma no monitor muda a conta sozinho, sem
// ninguém atualizar um número mágico.
//
// O laço converge assim: começa mostrando tudo, e a cada quadro
//   · se estourou, estima quantos cabem pela altura média do que foi desenhado
//     (e garante progresso tirando pelo menos um);
//   · se sobrou espaço, cresce até o teto que a última redução estabeleceu.
// O teto é o que impede o pingue-pongue entre n e n+1 quando as linhas têm
// alturas diferentes. Ele é zerado quando o container muda de tamanho, que é a
// única vez em que a resposta certa pode ter mudado.
//
// Para a medida ser estável, o container precisa ser um item flexível com
// `flex: 1; min-height: 0; overflow: hidden` dentro de um cartão de ALTURA
// FIXA. Se o cartão crescer com o conteúdo, paginar encolhe o cartão, que
// encolhe o container, que muda a conta — e a lista fica piscando. Por isso os
// painéis com lista longa ganharam `height` em vez de `max-height`.

/**
 * Divide `itens` em páginas do tamanho que couber em `alvo`.
 *
 * @param indiceEmFoco item que a lista deve mostrar ao abrir. Sem ele a lista
 *   abre na primeira página; com ele abre onde o jogador está (o degrau atual
 *   do passe, por exemplo), até ele mudar de página com o controle.
 */
export function usePaginacao<T, E extends HTMLElement = HTMLUListElement>(
  itens: readonly T[],
  indiceEmFoco = 0,
) {
  const alvo = useRef<E>(null)
  const teto = useRef(Number.POSITIVE_INFINITY)
  const [cabem, setCabem] = useState(0)
  const [paginaPedida, setPaginaPedida] = useState<number | null>(null)

  // Sem lista de dependências de propósito: a conta é refeita a cada quadro até
  // parar de mudar, e é `useLayoutEffect` para o ajuste acontecer antes de o
  // navegador pintar — senão o jogador vê a lista cheia piscar por um quadro.
  useLayoutEffect(() => {
    const elemento = alvo.current
    if (!elemento) return

    const desenhados = elemento.children.length
    const disponivel = elemento.clientHeight
    // Altura 0 é layout ainda não resolvido, não "não cabe nada".
    if (desenhados === 0 || disponivel <= 0) return

    const respiro = Number.parseFloat(getComputedStyle(elemento).rowGap) || 0
    // `scrollHeight` traz n alturas e n-1 respiros; somar um respiro devolve o
    // PASSO médio da lista, que é o que interessa para saber quantos cabem.
    const passo = (elemento.scrollHeight + respiro) / desenhados
    if (passo <= 0) return

    if (elemento.scrollHeight > disponivel + 1) {
      const estimativa = Math.max(1, Math.floor((disponivel + respiro) / passo))
      // `desenhados - 1` garante que cada passada reduza de fato: uma
      // estimativa otimista igual ao que já está na tela travaria o laço.
      const novo = Math.max(1, Math.min(estimativa, desenhados - 1))
      teto.current = novo
      setCabem(novo)
      return
    }

    if (desenhados < itens.length && desenhados < teto.current) {
      const cabemAMais = Math.floor((disponivel - elemento.scrollHeight + respiro) / passo)
      if (cabemAMais >= 1) {
        setCabem(Math.min(desenhados + cabemAMais, itens.length, teto.current))
      }
    }
  })

  useLayoutEffect(() => {
    const elemento = alvo.current
    if (!elemento) return

    // Mudou o tamanho do container (girou o celular, mudou o breakpoint): a
    // resposta antiga não vale mais, então volta a mostrar tudo e recomeça.
    const observador = new ResizeObserver(() => {
      teto.current = Number.POSITIVE_INFINITY
      setCabem(0)
    })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  // `0` é "ainda não sei": mostra tudo. O container tem `overflow: hidden`,
  // então o excedente não aparece, e desenhar a lista cheia é o que dá ao
  // quadro seguinte o que medir.
  const porPagina = cabem || Math.max(1, itens.length)
  const paginas = Math.max(1, Math.ceil(itens.length / porPagina))
  // Derivado, não guardado: a lista encolhe (equipou, sintetizou) e a página
  // pedida vira inválida sozinha. Recortar aqui evita a tela em branco. E
  // enquanto o jogador não pediu página nenhuma, manda o foco.
  const pagina = Math.max(
    0,
    Math.min(paginaPedida ?? Math.floor(indiceEmFoco / porPagina), paginas - 1),
  )

  return {
    alvo,
    pagina,
    paginas,
    itensDaPagina: itens.slice(pagina * porPagina, pagina * porPagina + porPagina),
    irPara: setPaginaPedida,
  }
}

/**
 * O controle de página. Fica invisível quando só existe uma página — ninguém
 * precisa saber que a lista é paginada quando ela cabe inteira.
 *
 * INVISÍVEL, e não ausente: ele reserva a altura dele nos dois casos. Some-lo
 * criaria um ciclo — sem controle sobra mais altura, com mais altura cabem mais
 * itens, com mais itens aparece o controle, que tira a altura de novo. A lista
 * ficava presa no tamanho errado (era um item a mais do que cabia, cortado no
 * pé). Reservar o espaço torna a medida estável no primeiro quadro.
 */
export function Paginacao({
  pagina,
  paginas,
  irPara,
}: {
  pagina: number
  paginas: number
  irPara: (pagina: number) => void
}) {
  const { t } = useSessao()

  const unica = paginas <= 1

  return (
    <div
      className={`paginacao ${unica ? 'paginacao--unica' : ''}`}
      aria-hidden={unica || undefined}
    >
      <button
        type="button"
        className="paginacao__passo"
        aria-label={t('paginacao.anterior')}
        disabled={pagina <= 0}
        onClick={() => irPara(pagina - 1)}
      >
        ‹
      </button>

      <span className="paginacao__contador">
        {t('paginacao.contador', { pagina: pagina + 1, paginas })}
      </span>

      <button
        type="button"
        className="paginacao__passo"
        aria-label={t('paginacao.proxima')}
        disabled={pagina >= paginas - 1}
        onClick={() => irPara(pagina + 1)}
      >
        ›
      </button>
    </div>
  )
}

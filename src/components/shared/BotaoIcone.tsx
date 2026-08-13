import type { ButtonHTMLAttributes } from 'react'

import { Icone, type NomeDoIcone } from './Icone'
import './BotaoIcone.css'

// O botão da barra de ícones que fica SOBRE o canvas.
//
// Existe porque `specs/mapas-instanciados-combate-e-hud.md` (6) fecha um
// problema de intuitividade: os painéis moravam num rodapé de botões de texto
// que empurrava o jogo para cima e, no celular, quebrava em três linhas. O
// jogador tinha que procurar a mochila.
//
// O rótulo NÃO some — ele encolhe. Ícone puro obriga a decorar o desenho, o que
// é exatamente o tutorial invisível que o Princípio nº1 proíbe. Em tela
// estreita o texto sai do fluxo e vira `aria-label`, então o leitor de tela
// continua ouvindo a mesma coisa.
//
// CSS separado do JSX (CLAUDE.md).

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icone: NomeDoIcone
  rotulo: string
  /** Número no cantinho — pontos livres, chaves. `0` não desenha nada. */
  selo?: number
  /** Destaca o botão como "é aqui que está a novidade". */
  destacado?: boolean
}

export function BotaoIcone({
  icone,
  rotulo,
  selo = 0,
  destacado = false,
  className,
  ...resto
}: Props) {
  return (
    <button
      type="button"
      className={`botao-icone ${destacado ? 'botao-icone--destacado' : ''} ${className ?? ''}`.trim()}
      aria-label={rotulo}
      title={rotulo}
      {...resto}
    >
      <Icone nome={icone} />
      <span className="botao-icone__rotulo">{rotulo}</span>
      {selo > 0 ? (
        <span className="botao-icone__selo" aria-hidden="true">
          {selo > 99 ? '99+' : selo}
        </span>
      ) : null}
    </button>
  )
}

import type { ButtonHTMLAttributes, ReactNode } from 'react'

import './Botao.css'

// CSS separado do JSX (CLAUDE.md) — nenhum estilo persistente vive em `style=`.

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primaria' | 'recompensa' | 'discreta'
  children: ReactNode
}

export function Botao({ variante = 'primaria', className, children, ...resto }: Props) {
  return (
    <button className={`botao botao--${variante} ${className ?? ''}`.trim()} {...resto}>
      {children}
    </button>
  )
}

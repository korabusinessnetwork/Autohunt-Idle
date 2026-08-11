import type { ReactNode } from 'react'

import { Botao } from './Botao'
import './EstadoTela.css'

// Os estados obrigatórios de toda tela (CLAUDE.md / patterns.md): carregando,
// erro, vazio e sucesso. Aqui moram os três primeiros, para nenhuma tela
// improvisar o próprio jeito de dizer "deu ruim" ou "não tem nada aqui".

export function TelaCarregando({ mensagem }: { mensagem: string }) {
  return (
    <div className="estado-tela" role="status" aria-live="polite">
      <div className="estado-tela__pulso" aria-hidden="true" />
      <p className="estado-tela__mensagem">{mensagem}</p>
    </div>
  )
}

export function TelaErro({
  titulo,
  mensagem,
  rotuloAcao,
  aoTentarDeNovo,
  detalhe,
}: {
  titulo: string
  mensagem: string
  rotuloAcao: string
  aoTentarDeNovo: () => void
  detalhe?: string
}) {
  return (
    <div className="estado-tela estado-tela--erro" role="alert">
      <h2 className="estado-tela__titulo">{titulo}</h2>
      <p className="estado-tela__mensagem">{mensagem}</p>
      {detalhe ? <code className="estado-tela__detalhe">{detalhe}</code> : null}
      <Botao onClick={aoTentarDeNovo}>{rotuloAcao}</Botao>
    </div>
  )
}

export function TelaVazia({
  titulo,
  mensagem,
  children,
}: {
  titulo: string
  mensagem: string
  children?: ReactNode
}) {
  return (
    <div className="estado-tela estado-tela--vazia">
      <h2 className="estado-tela__titulo">{titulo}</h2>
      <p className="estado-tela__mensagem">{mensagem}</p>
      {children}
    </div>
  )
}

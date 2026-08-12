import type { ReactNode } from 'react'

import { urlDaArte } from '../../game/atlas'

import { Botao } from './Botao'
import './EstadoTela.css'

// Os estados obrigatórios de toda tela (CLAUDE.md / patterns.md): carregando,
// erro, vazio e sucesso. Aqui moram os três primeiros, para nenhuma tela
// improvisar o próprio jeito de dizer "deu ruim" ou "não tem nada aqui".

export function TelaCarregando({ mensagem }: { mensagem: string }) {
  return (
    <div className="estado-tela" role="status" aria-live="polite">
      {/*
        A marca no lugar do círculo pulsante: esta é a primeira tela do jogo, e
        era a única superfície em que o produto não se apresentava. O nome já
        está no `<h1>` invisível do documento e na mensagem ao lado, então a
        imagem é decorativa para o leitor de tela.
      */}
      <img
        className="estado-tela__marca"
        src={urlDaArte('arte/marca/wordmark-dark.png')}
        alt=""
        width={200}
        height={92}
      />
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

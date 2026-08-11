import { useState } from 'react'

import { Botao } from '../components/shared/Botao'
import { TelaCarregando, TelaErro } from '../components/shared/EstadoTela'
import { useSessao } from '../context/SessaoContext'
import { ModalCadastro } from '../features/cadastro/ModalCadastro'
import { PainelConfiguracoes } from '../features/configuracoes/PainelConfiguracoes'
import { PainelDesbloqueio } from '../features/desbloqueio/PainelDesbloqueio'
import { TelaRetorno } from '../features/farm-offline/TelaRetorno'
import { useMotorDeJogo } from '../hooks/useMotorDeJogo'
import { formatarNumero } from '../utils/formato'
import './Jogo.css'

// A tela do jogo. Abre direto no mundo aberto, com o personagem já andando e
// atacando — sem tela de boas-vindas, sem escolha inicial (core, 17 e
// Princípio nº1). Nenhum listener de teclado/clique alimenta o combate: a ação
// principal se explica sozinha em cinco segundos porque acontece sozinha.

type Painel = 'nenhum' | 'desbloqueio' | 'configuracoes' | 'cadastro'

export function Jogo() {
  const { estado, erro, snapshot, t, idioma, conectar, recarregarEstado } = useSessao()
  const [painel, setPainel] = useState<Painel>('nenhum')
  const canvasRef = useMotorDeJogo(estado === 'pronto')

  if (estado === 'carregando') {
    return <TelaCarregando mensagem={t('app.carregando')} />
  }

  if (estado === 'erro') {
    return (
      <TelaErro
        titulo={t('app.erro.titulo')}
        mensagem={t('app.erro.mensagem')}
        rotuloAcao={t('app.erro.tentarDeNovo')}
        detalhe={erro?.codigo}
        aoTentarDeNovo={() => void conectar()}
      />
    )
  }

  const jogador = snapshot?.jogador
  const proporcaoXp = jogador?.xpParaProximoNivel
    ? Math.min(1, jogador.xpNoNivel / jogador.xpParaProximoNivel)
    : 0
  const proporcaoVida = jogador?.vitalidadeMaxima
    ? Math.min(1, jogador.vitalidadeAtual / jogador.vitalidadeMaxima)
    : 0

  /**
   * Ativar farm offline é exatamente o momento em que a identidade permanente
   * passa a ser necessária — então é aqui, e só aqui, que o cadastro é pedido
   * (core, 18).
   */
  function abrirDesbloqueio() {
    setPainel(jogador?.temCadastro ? 'desbloqueio' : 'cadastro')
  }

  return (
    <main className="jogo">
      <header className="jogo__hud">
        <div className="jogo__bloco">
          <span className="jogo__rotulo">{t('hud.nivel')}</span>
          <strong className="jogo__valor">{formatarNumero(jogador?.nivel ?? 1, idioma)}</strong>
          <div className="jogo__barra" aria-hidden="true">
            <div className="jogo__barra-preenchida" style={{ width: `${proporcaoXp * 100}%` }} />
          </div>
          <span className="jogo__detalhe">
            {t('hud.xpParaProximo', {
              atual: formatarNumero(jogador?.xpNoNivel ?? 0, idioma),
              alvo: formatarNumero(jogador?.xpParaProximoNivel ?? 0, idioma),
            })}
          </span>
        </div>

        <div className="jogo__bloco">
          <span className="jogo__rotulo">{t('hud.vitalidade')}</span>
          <div className="jogo__barra jogo__barra--vida" aria-hidden="true">
            <div className="jogo__barra-preenchida" style={{ width: `${proporcaoVida * 100}%` }} />
          </div>
        </div>

        <div className="jogo__bloco jogo__bloco--fim">
          <span className="jogo__rotulo">{t('hud.moeda')}</span>
          <strong className="jogo__valor jogo__valor--moeda">
            {formatarNumero(jogador?.moeda ?? 0, idioma)}
          </strong>
        </div>
      </header>

      <div className="jogo__palco">
        <canvas
          ref={canvasRef}
          className="jogo__canvas"
          role="img"
          aria-label={t('mundo.bioma1')}
        />
        <span className="jogo__aovivo">{t('hud.aoVivo')}</span>
      </div>

      <footer className="jogo__acoes">
        <Botao variante="recompensa" onClick={abrirDesbloqueio}>
          {t('anuncio.assistir', { minutos: 15 })}
        </Botao>
        <Botao variante="discreta" onClick={() => setPainel('configuracoes')}>
          {t('config.titulo')}
        </Botao>
      </footer>

      <TelaRetorno />

      {painel === 'desbloqueio' ? (
        <PainelDesbloqueio aoFechar={() => setPainel('nenhum')} />
      ) : null}

      {painel === 'configuracoes' ? (
        <PainelConfiguracoes aoFechar={() => setPainel('nenhum')} />
      ) : null}

      {painel === 'cadastro' ? (
        <ModalCadastro
          aoFechar={() => setPainel('nenhum')}
          aoConcluir={() => {
            void recarregarEstado()
            setPainel('desbloqueio')
          }}
        />
      ) : null}
    </main>
  )
}

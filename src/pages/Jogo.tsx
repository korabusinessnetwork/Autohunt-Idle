import { useCallback, useEffect, useState } from 'react'

import { Botao } from '../components/shared/Botao'
import { TelaCarregando, TelaErro } from '../components/shared/EstadoTela'
import { useSessao } from '../context/SessaoContext'
import { PainelAtributos } from '../features/atributos/PainelAtributos'
import { ModalCadastro } from '../features/cadastro/ModalCadastro'
import { PainelConfiguracoes } from '../features/configuracoes/PainelConfiguracoes'
import { PainelDesbloqueio } from '../features/desbloqueio/PainelDesbloqueio'
import { TelaRetorno } from '../features/farm-offline/TelaRetorno'
import { PainelEquipamento } from '../features/mochila/PainelEquipamento'
import { PainelMochila } from '../features/mochila/PainelMochila'
import { TelaRanking } from '../features/ranking/TelaRanking'
import { useMotorDeJogo } from '../hooks/useMotorDeJogo'
import { sinalizarJogo } from '../lib/portal'
import { formatarNumero } from '../utils/formato'
import './Jogo.css'

// A tela do jogo. Abre direto no mundo aberto, com o personagem já andando e
// atacando — sem tela de boas-vindas, sem escolha inicial (core, 17 e
// Princípio nº1). Nenhum listener de teclado/clique alimenta o combate: a ação
// principal se explica sozinha em cinco segundos porque acontece sozinha.

type Painel =
  | 'nenhum'
  | 'desbloqueio'
  | 'configuracoes'
  | 'cadastro'
  | 'atributos'
  | 'ranking'
  | 'mochila'
  | 'equipamento'

export function Jogo() {
  const { estado, erro, snapshot, t, idioma, conectar, recarregarEstado } = useSessao()
  const [painel, setPainel] = useState<Painel>('nenhum')
  // De onde o cadastro foi pedido — o jogador volta para lá ao concluir.
  const [origemDoCadastro, setOrigemDoCadastro] = useState<Painel>('desbloqueio')
  const [retornoAberto, setRetornoAberto] = useState(false)
  const canvasRef = useMotorDeJogo(estado === 'pronto')

  // O portal só pode receber `gameplayStart` quando o jogador está de fato
  // jogando — não durante o carregamento, nem com um painel por cima do mundo.
  const jogando = estado === 'pronto' && painel === 'nenhum' && !retornoAberto
  useEffect(() => {
    sinalizarJogo(jogando)
    return () => sinalizarJogo(false)
  }, [jogando])

  const aoMudarVisibilidadeDoRetorno = useCallback((visivel: boolean) => {
    setRetornoAberto(visivel)
  }, [])

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
  // Ponto livre sobrando é raro (a auto-alocação gasta quase tudo), mas quando
  // sobra vale sinalizar — sem transformar em cobrança.
  const pontosLivres = snapshot?.atributos.pontosLivres ?? 0
  // Chave é o que destrava dungeon — vale sinalizar quando o jogador tem uma.
  const chaves = snapshot?.inventario.chaves ?? 0
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
    setOrigemDoCadastro('desbloqueio')
    setPainel(jogador?.identidadeVerificada ? 'desbloqueio' : 'cadastro')
  }

  function pedirCadastroPeloRanking() {
    setOrigemDoCadastro('ranking')
    setPainel('cadastro')
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
          {t('hud.ativarOffline')}
        </Botao>
        <Botao onClick={() => setPainel('atributos')}>
          {t('atributos.titulo')}
          {pontosLivres > 0 ? <span className="jogo__selo">{pontosLivres}</span> : null}
        </Botao>
        <Botao onClick={() => setPainel('mochila')}>
          {t('mochila.titulo')}
          {chaves > 0 ? <span className="jogo__selo">{chaves}</span> : null}
        </Botao>
        <Botao onClick={() => setPainel('equipamento')}>{t('mochila.equipamento')}</Botao>
        <Botao onClick={() => setPainel('ranking')}>{t('ranking.titulo')}</Botao>
        <Botao variante="discreta" onClick={() => setPainel('configuracoes')}>
          {t('config.titulo')}
        </Botao>
      </footer>

      <TelaRetorno aoMudarVisibilidade={aoMudarVisibilidadeDoRetorno} />

      {painel === 'desbloqueio' ? (
        <PainelDesbloqueio aoFechar={() => setPainel('nenhum')} />
      ) : null}

      {painel === 'atributos' ? (
        <PainelAtributos aoFechar={() => setPainel('nenhum')} />
      ) : null}

      {painel === 'mochila' ? <PainelMochila aoFechar={() => setPainel('nenhum')} /> : null}

      {painel === 'equipamento' ? (
        <PainelEquipamento aoFechar={() => setPainel('nenhum')} />
      ) : null}

      {painel === 'ranking' ? (
        <TelaRanking
          aoFechar={() => setPainel('nenhum')}
          aoPedirCadastro={pedirCadastroPeloRanking}
        />
      ) : null}

      {painel === 'configuracoes' ? (
        <PainelConfiguracoes aoFechar={() => setPainel('nenhum')} />
      ) : null}

      {painel === 'cadastro' ? (
        <ModalCadastro
          aoFechar={() => setPainel('nenhum')}
          aoConcluir={() => {
            void recarregarEstado()
            // Volta para onde o cadastro foi pedido: quem veio do placar quer
            // escolher o apelido, não abrir o painel de farm offline.
            setPainel(origemDoCadastro)
          }}
        />
      ) : null}
    </main>
  )
}

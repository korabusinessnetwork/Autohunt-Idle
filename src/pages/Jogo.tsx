import { useCallback, useEffect, useState } from 'react'

import { Botao } from '../components/shared/Botao'
import { TelaCarregando, TelaErro } from '../components/shared/EstadoTela'
import { useSessao } from '../context/SessaoContext'
import { PainelAtributos } from '../features/atributos/PainelAtributos'
import { ModalCadastro } from '../features/cadastro/ModalCadastro'
import { PainelConfiguracoes } from '../features/configuracoes/PainelConfiguracoes'
import { PainelDesbloqueio } from '../features/desbloqueio/PainelDesbloqueio'
import { TelaRetorno } from '../features/farm-offline/TelaRetorno'
import { PainelLoja } from '../features/loja/PainelLoja'
import { PainelEquipamento } from '../features/mochila/PainelEquipamento'
import { PainelMochila } from '../features/mochila/PainelMochila'
import { PainelPasse } from '../features/passe/PainelPasse'
import { TelaRanking } from '../features/ranking/TelaRanking'
import { useMotorDeJogo } from '../hooks/useMotorDeJogo'
import { sinalizarJogo } from '../lib/portal'
import { formatarNumero } from '../utils/formato'
import './Jogo.css'

// A tela do jogo. Abre direto no mundo aberto, sem tela de boas-vindas e sem
// escolha inicial (core, 17 e Princípio nº1).
//
// Desde `specs/mundo-aberto-e-modo-manual.md` o jogo é MANUAL: o jogador anda
// com WASD/setas e mira com o mouse (no toque, joystick e mira automática). O
// auto continua existindo e é o que se vende — quem tem saldo pode largar o
// personagem jogando e ir embora.
//
// O que NÃO mudou: manual e auto creditam exatamente o mesmo. O servidor olha
// tempo × poder e não sabe quem estava no comando.

type Painel =
  | 'nenhum'
  | 'desbloqueio'
  | 'configuracoes'
  | 'cadastro'
  | 'atributos'
  | 'ranking'
  | 'mochila'
  | 'equipamento'
  | 'loja'
  | 'passe'

export function Jogo() {
  const { estado, erro, snapshot, t, idioma, conectar, recarregarEstado } = useSessao()
  const [painel, setPainel] = useState<Painel>('nenhum')
  // De onde o cadastro foi pedido — o jogador volta para lá ao concluir.
  const [origemDoCadastro, setOrigemDoCadastro] = useState<Painel>('desbloqueio')
  const [retornoAberto, setRetornoAberto] = useState(false)
  const { canvasRef, definirModo, biomaNome, ocioso, retomar } = useMotorDeJogo(
    estado === 'pronto',
  )
  const [modo, setModo] = useState<'manual' | 'auto'>('manual')

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

  // Assinante tem auto sem limite; quem não assina gasta o saldo que ganhou
  // assistindo anúncio. São dois produtos distintos do farm offline
  // (`specs/mundo-aberto-e-modo-manual.md`, 3.3).
  const minutosDeAuto = snapshot?.farm.minutosAutoSaldo ?? 0
  const autoDisponivel = (snapshot?.assinatura.ativa ?? false) || minutosDeAuto > 0

  /**
   * Ativar farm offline é exatamente o momento em que a identidade permanente
   * passa a ser necessária — então é aqui, e só aqui, que o cadastro é pedido
   * (core, 18).
   */
  function abrirDesbloqueio() {
    setOrigemDoCadastro('desbloqueio')
    setPainel(jogador?.identidadeVerificada ? 'desbloqueio' : 'cadastro')
  }

  /**
   * Alterna o auto.
   *
   * Ligar exige saldo — e o botão já nasce desabilitado sem ele, então isto é
   * a segunda barreira, não a primeira. Desligar é sempre livre: ninguém fica
   * preso no automático.
   */
  function alternarModo() {
    const proximo = modo === 'auto' ? 'manual' : 'auto'
    if (proximo === 'auto' && !autoDisponivel) {
      abrirDesbloqueio()
      return
    }
    setModo(proximo)
    definirModo(proximo)
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

        <div className="jogo__bloco">
          {/*
            O estado do auto fica SEMPRE visível, nunca escondido atrás de um
            menu: é o produto que se está vendendo, e quem não tem precisa
            saber que existe sem procurar.
          */}
          <span className="jogo__rotulo">{t('hud.modo')}</span>
          <Botao
            variante={modo === 'auto' ? 'recompensa' : 'discreta'}
            disabled={!autoDisponivel && modo === 'manual'}
            onClick={() => alternarModo()}
          >
            {modo === 'auto' ? t('hud.auto.ligado') : t('hud.auto.desligado')}
          </Botao>
          <span className="jogo__detalhe">
            {autoDisponivel ? t('hud.auto.saldo', { minutos: minutosDeAuto }) : t('hud.auto.bloqueado')}
          </span>
        </div>

        <div className="jogo__bloco jogo__bloco--fim">
          <span className="jogo__rotulo">{t('hud.moeda')}</span>
          <strong className="jogo__valor jogo__valor--moeda">
            {formatarNumero(jogador?.moeda ?? 0, idioma)}
          </strong>
          <span className="jogo__rotulo">{t('hud.diamante')}</span>
          <strong className="jogo__valor jogo__valor--diamante">
            {formatarNumero(jogador?.diamante ?? 0, idioma)}
          </strong>
        </div>
      </header>

      <div className="jogo__palco">
        <canvas
          ref={canvasRef}
          className="jogo__canvas"
          role="img"
          aria-label={t(biomaNome)}
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
        <Botao onClick={() => setPainel('loja')}>{t('loja.titulo')}</Botao>
        <Botao onClick={() => setPainel('passe')}>{t('passe.titulo')}</Botao>
        <Botao onClick={() => setPainel('ranking')}>{t('ranking.titulo')}</Botao>
        <Botao variante="discreta" onClick={() => setPainel('configuracoes')}>
          {t('config.titulo')}
        </Botao>
      </footer>

      {/*
        Ficou parado sem auto destravado: a sessão foi encerrada, exatamente
        como se a aba tivesse fechado. O texto não dá bronca e não conta
        regressivo — só diz o que aconteceu e como voltar.
      */}
      {ocioso ? (
        <div className="jogo__ocioso" role="status">
          <p className="jogo__ocioso-titulo">{t('ocioso.titulo')}</p>
          <p className="jogo__ocioso-texto">{t('ocioso.explicacao')}</p>
          <Botao variante="recompensa" onClick={retomar}>
            {t('ocioso.voltar')}
          </Botao>
          <Botao variante="discreta" onClick={abrirDesbloqueio}>
            {t('ocioso.querAuto')}
          </Botao>
        </div>
      ) : null}

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

      {painel === 'loja' ? <PainelLoja aoFechar={() => setPainel('nenhum')} /> : null}

      {painel === 'passe' ? <PainelPasse aoFechar={() => setPainel('nenhum')} /> : null}

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

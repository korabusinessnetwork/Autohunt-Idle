import { useCallback, useEffect, useState } from 'react'

import { Botao } from '../components/shared/Botao'
import { BotaoIcone } from '../components/shared/BotaoIcone'
import { Icone } from '../components/shared/Icone'
import { TelaCarregando, TelaErro } from '../components/shared/EstadoTela'
import { useSessao } from '../context/SessaoContext'
import { PainelAtributos } from '../features/atributos/PainelAtributos'
import { ModalCadastro } from '../features/cadastro/ModalCadastro'
import { PainelConfiguracoes } from '../features/configuracoes/PainelConfiguracoes'
import { ModalLogin } from '../features/conta/ModalLogin'
import { PainelDesbloqueio } from '../features/desbloqueio/PainelDesbloqueio'
import { TelaRetorno } from '../features/farm-offline/TelaRetorno'
import { RetratoDoHeroi } from '../features/hud/RetratoDoHeroi'
import { PainelLoja } from '../features/loja/PainelLoja'
import { PainelMapa } from '../features/mapa/PainelMapa'
import { PainelMochila } from '../features/mochila/PainelMochila'
import { PainelPasse } from '../features/passe/PainelPasse'
import { TelaRanking } from '../features/ranking/TelaRanking'
import { mapaPorId } from '../game/mapas'
import { useMotorDeJogo } from '../hooks/useMotorDeJogo'
import { sinalizarJogo } from '../lib/portal'
import { formatarNumero } from '../utils/formato'
import './Jogo.css'

// A tela do jogo. Abre direto no mundo, sem tela de boas-vindas e sem escolha
// inicial (core, 17 e Princípio nº1).
//
// TRÊS REESCRITAS DE LAYOUT, e a última é o que este arquivo é hoje
// (`specs/mapas-instanciados-combate-e-hud.md`, 5 e 6):
//
//   · o canvas era uma faixa no meio de uma coluna, com HUD em cima e um rodapé
//     de oito botões de texto embaixo. No celular o rodapé quebrava em três
//     linhas e comia metade da tela; o jogo ficava numa tira.
//   · agora o JOGO É A TELA: canvas em tela cheia, HUD flutuando por cima nos
//     cantos, e os painéis alcançáveis por ícone sem o jogador procurar nada.
//
// O que NÃO mudou: manual e auto creditam exatamente o mesmo. O servidor olha
// tempo × poder e não sabe quem estava no comando, nem em qual mapa.

type Painel =
  | 'nenhum'
  | 'desbloqueio'
  | 'configuracoes'
  | 'cadastro'
  | 'login'
  | 'mapa'
  | 'atributos'
  | 'ranking'
  | 'mochila'
  | 'loja'
  | 'passe'

export function Jogo() {
  const { estado, erro, snapshot, t, idioma, conectar, recarregarEstado } = useSessao()
  const [painel, setPainel] = useState<Painel>('nenhum')
  // De onde o cadastro foi pedido — o jogador volta para lá ao concluir.
  const [origemDoCadastro, setOrigemDoCadastro] = useState<Painel>('desbloqueio')
  // Mesma ideia para os atributos, que agora têm duas portas: o ícone da barra
  // e o botão dentro da mochila.
  const [origemDosAtributos, setOrigemDosAtributos] = useState<Painel>('nenhum')
  const [retornoAberto, setRetornoAberto] = useState(false)
  const { canvasRef, definirModo, mapaId, viajarPara, vida, ocioso, retomar } = useMotorDeJogo(
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
  // Desde que a auto-alocação saiu do jogo (2026-08-13), TODO ponto ganho chega
  // livre e fica parado até o jogador gastar. É este selo que atende o
  // Princípio nº1 no lugar dela: avisa que há o que fazer sem exigir leitura, e
  // ignorá-lo não quebra nada — só deixa ponto guardado.
  const pontosLivres = snapshot?.atributos.pontosLivres ?? 0
  // Chave é o que destrava dungeon — vale sinalizar quando o jogador tem uma.
  const chaves = snapshot?.inventario.chaves ?? 0
  const mapa = mapaPorId(mapaId)

  // Assinante tem auto sem limite; quem não assina gasta o saldo que ganhou
  // assistindo anúncio. São dois produtos distintos do farm offline
  // (`specs/mundo-aberto-e-modo-manual.md`, 3.3).
  const minutosDeAuto = snapshot?.farm.minutosAutoSaldo ?? 0
  const autoDisponivel = (snapshot?.assinatura.ativa ?? false) || minutosDeAuto > 0
  const cadastrado = jogador?.identidadeVerificada ?? false

  /**
   * Ativar farm offline é exatamente o momento em que a identidade permanente
   * passa a ser necessária — então é aqui, e só aqui, que o cadastro é pedido
   * (core, 18).
   */
  function abrirDesbloqueio() {
    setOrigemDoCadastro('desbloqueio')
    setPainel(cadastrado ? 'desbloqueio' : 'cadastro')
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
      {/*
        O canvas é o FUNDO da tela inteira, e não um bloco no meio de uma
        coluna. Tudo o que vem depois flutua por cima dele.
      */}
      <canvas ref={canvasRef} className="jogo__canvas" role="img" aria-label={t(mapa.bioma.nome)} />

      {/*
        Nível, XP e vitalidade saíram daqui: viraram o retrato do herói, no
        canto de baixo à esquerda. Ler três rótulos no alto da tela não é como
        o jogador reconhece o próprio personagem — a cara dele é.
      */}
      <header className="jogo__hud">
        <div className="jogo__painel jogo__painel--direita">
          {/*
            Os dois saldos perderam o rótulo escrito quando a HUD virou painel
            flutuante — não cabia, e a cor já separa ouro de diamante de
            relance. O rótulo continua existindo para quem lê a tela por áudio:
            sem ele, os dois números sairiam como dois números.
          */}
          <div className="jogo__linha">
            <span className="jogo__moeda jogo__moeda--ouro" aria-label={t('hud.moeda')}>
              {formatarNumero(jogador?.moeda ?? 0, idioma)}
            </span>
            <span className="jogo__moeda jogo__moeda--diamante" aria-label={t('hud.diamante')}>
              {formatarNumero(jogador?.diamante ?? 0, idioma)}
            </span>
          </div>

          {/*
            O botão de conta. Faltava a porta de entrada: quem cadastrou e abriu
            o jogo noutro navegador não tinha como voltar para a própria conta.
          */}
          <button
            type="button"
            className="jogo__conta"
            onClick={() => setPainel(cadastrado ? 'configuracoes' : 'login')}
          >
            <Icone nome="conta" tamanho={16} />
            <span>{cadastrado ? (jogador?.apelido ?? t('login.minhaConta')) : t('login.entrar')}</span>
          </button>
        </div>
      </header>

      {/*
        O estado do auto fica SEMPRE visível, nunca escondido atrás de um menu:
        é o produto que se está vendendo, e quem não tem precisa saber que
        existe sem procurar.
      */}
      <div className="jogo__modo" role="group" aria-label={t('hud.modo')}>
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

      <span className="jogo__aovivo">{t('hud.aoVivo')}</span>

      {/*
        O retrato. Fica no canto oposto ao do auto, no mesmo recuo, para os dois
        cantos de baixo lerem como um par — e acima da barra de ícones, que é a
        única coisa que não pode ser coberta.
      */}
      <div className="jogo__retrato">
        <RetratoDoHeroi vida={vida} />
      </div>

      {/*
        A barra de ícones. Nenhum painel fica escondido — era o pedido literal
        ("pro cara não precisar procurar o inventário").
      */}
      <nav className="jogo__acoes" aria-label={t('hud.acoes')}>
        <BotaoIcone
          icone="offline"
          rotulo={t('hud.ativarOffline')}
          destacado
          onClick={abrirDesbloqueio}
        />
        <BotaoIcone icone="mapa" rotulo={t('mapa.titulo')} onClick={() => setPainel('mapa')} />
        {/*
          Um ícone só para mochila E equipamento. Eram dois, e a divisão só
          fazia sentido para quem construiu o jogo — quem joga abre a mochila
          para vestir o que caiu.
        */}
        <BotaoIcone
          icone="mochila"
          rotulo={t('mochila.titulo')}
          selo={chaves}
          onClick={() => setPainel('mochila')}
        />
        <BotaoIcone
          icone="atributos"
          rotulo={t('atributos.titulo')}
          selo={pontosLivres}
          onClick={() => {
            setOrigemDosAtributos('nenhum')
            setPainel('atributos')
          }}
        />
        <BotaoIcone icone="loja" rotulo={t('loja.titulo')} onClick={() => setPainel('loja')} />
        <BotaoIcone icone="passe" rotulo={t('passe.titulo')} onClick={() => setPainel('passe')} />
        <BotaoIcone
          icone="ranking"
          rotulo={t('ranking.titulo')}
          onClick={() => setPainel('ranking')}
        />
        <BotaoIcone
          icone="config"
          rotulo={t('config.titulo')}
          onClick={() => setPainel('configuracoes')}
        />
      </nav>

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

      {painel === 'mapa' ? (
        <PainelMapa
          mapaAtual={mapaId}
          aoViajar={(destino) => {
            viajarPara(destino)
            setPainel('nenhum')
          }}
          aoFechar={() => setPainel('nenhum')}
        />
      ) : null}

      {painel === 'desbloqueio' ? (
        <PainelDesbloqueio aoFechar={() => setPainel('nenhum')} />
      ) : null}

      {/*
        Fechar os atributos volta para de onde eles foram abertos. Quem clicou
        "ver atributos" dentro da mochila estava no meio de trocar de arma —
        cair no mundo aberto obrigaria a refazer o caminho inteiro.
      */}
      {painel === 'atributos' ? (
        <PainelAtributos aoFechar={() => setPainel(origemDosAtributos)} />
      ) : null}

      {painel === 'mochila' ? (
        <PainelMochila
          aoFechar={() => setPainel('nenhum')}
          aoVerAtributos={() => {
            setOrigemDosAtributos('mochila')
            setPainel('atributos')
          }}
        />
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

      {painel === 'login' ? (
        <ModalLogin
          aoFechar={() => setPainel('nenhum')}
          aoEntrar={() => {
            setPainel('nenhum')
            // Entrar troca de conta: a sessão inteira precisa ser relida, e não
            // só o snapshot — o `user.id` mudou.
            void conectar()
          }}
          aoPedirCadastro={() => {
            setOrigemDoCadastro('nenhum')
            setPainel('cadastro')
          }}
        />
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

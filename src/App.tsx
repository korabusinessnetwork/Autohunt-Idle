import { useEffect, useState } from 'react'

import { ProvedorSessao } from './context/SessaoContext'
import { ConsoleAjuste } from './features/console/ConsoleAjuste'
import { Jogo } from './pages/Jogo'

// O jogo tem uma tela só, e continua tendo: não existe roteador aqui, porque um
// roteador para duas rotas é dependência a mais para manter.
//
// `/console` é a tela do dono (`specs/console-de-ajuste.md`). Ela vai no mesmo
// bundle que todo jogador baixa, e é deliberado: esconder a rota seria
// segurança por obscuridade, e obscuridade não é controle. Quem protege é o
// banco — a tabela `ajuste` não tem grant de escrita para o client, e
// `definir_ajuste` confere quem é a cada chamada.
const ROTA_CONSOLE = '/console'

function ehRotaConsole(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.replace(/\/+$/, '') === ROTA_CONSOLE
}

export function App() {
  const [noConsole, setNoConsole] = useState(ehRotaConsole)

  // Voltar/avançar do navegador precisam sair do console — senão o botão de
  // voltar não faz nada e a tela parece travada.
  useEffect(() => {
    function aoNavegar() {
      setNoConsole(ehRotaConsole())
    }
    window.addEventListener('popstate', aoNavegar)
    return () => window.removeEventListener('popstate', aoNavegar)
  }, [])

  function fecharConsole() {
    window.history.pushState({}, '', '/')
    setNoConsole(false)
  }

  return (
    <ProvedorSessao>
      {/*
        O jogo continua montado por baixo: fechar o console volta para a sessão
        que já estava rodando, sem recarregar nem perder o lote em voo.
      */}
      <Jogo />
      {noConsole && <ConsoleAjuste aoFechar={fecharConsole} />}
    </ProvedorSessao>
  )
}

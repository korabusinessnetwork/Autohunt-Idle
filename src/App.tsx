import { ProvedorSessao } from './context/SessaoContext'
import { Jogo } from './pages/Jogo'

export function App() {
  return (
    <ProvedorSessao>
      <Jogo />
    </ProvedorSessao>
  )
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { idiomaInicial } from './lib/i18n'
import './styles/global.css'

// O idioma detectado precisa chegar no `<html lang>` antes da primeira pintura,
// para leitor de tela e hifenização não começarem no idioma errado.
document.documentElement.setAttribute('lang', idiomaInicial())

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Elemento #root não encontrado em index.html')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

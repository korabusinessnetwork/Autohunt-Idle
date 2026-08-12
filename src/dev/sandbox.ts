// Sandbox do mundo — só o motor, o mundo e o renderizador.
//
// POR QUE EXISTE: o jogo completo precisa de um projeto Supabase para abrir
// (conta anônima, snapshot, tudo). Enquanto não houver um, não dá para ver o
// mundo rodando — e "ver rodando" é justamente o que a inversão de premissa
// exige, porque agora a sensação de jogar é o produto.
//
// Este arquivo monta a camada visual sozinha: sem React, sem rede, sem sessão.
// Serve para calibrar velocidade, alcance, densidade e escala de mundo — os
// números que hoje são chute meu (D4) e precisam de mão humana.
//
// NÃO ENTRA NO BUNDLE DO JOGO: só é carregado por `sandbox.html`, que existe
// fora do fluxo de produção.

import { criarEntrada } from '../game/entrada'
import { criarMotor } from '../game/motor'
import { biomaAtual, definirModo, type ModoDeJogo } from '../game/mundo'
import { criarRenderizadorCanvas } from '../game/renderizador'
import '../styles/tokens.css'

const canvas = document.querySelector<HTMLCanvasElement>('#mundo')!
const placar = document.querySelector<HTMLElement>('#placar')!
const botaoModo = document.querySelector<HTMLButtonElement>('#modo')!

// O sandbox não tem i18n: mostra a chave crua, que é o suficiente para saber
// se o inimigo certo apareceu na região certa.
const renderizador = criarRenderizadorCanvas(canvas, (chave) => chave)
const entrada = criarEntrada(canvas, (x, y) => renderizador.paraCoordenadaDoMundo(x, y))

const motor = criarMotor({
  renderizador,
  // Sem servidor, validar lote não faz nada — e é exatamente o ponto: o mundo
  // roda sem depender de crédito nenhum.
  aoValidarLote: () => {},
  entrada,
})

let modo: ModoDeJogo = 'manual'
botaoModo.addEventListener('click', () => {
  modo = modo === 'manual' ? 'auto' : 'manual'
  motor.definirModo(modo)
  definirModo(motor.estado, modo)
  botaoModo.textContent = modo === 'auto' ? 'Automático' : 'Você no comando'
})

window.addEventListener('resize', () => renderizador.redimensionar())

motor.iniciar()

// Painel de diagnóstico: é o que transforma "parece estranho" em "a densidade
// está em 11 e devia estar em 7".
window.setInterval(() => {
  const { heroiX, heroiY, inimigos, projeteis } = motor.estado
  const zona = biomaAtual(motor.estado)
  placar.textContent = [
    `região ${zona.id} · ${zona.nome}`,
    `x ${Math.round(heroiX)} · y ${Math.round(heroiY)}`,
    `${inimigos.length} inimigos · ${projeteis.length} tiros`,
    `assinatura: ${zona.assinatura.forma}`,
  ].join('   |   ')
}, 200)

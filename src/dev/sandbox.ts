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
import { biomaAtual, definirModo, poseDoHeroi, type ModoDeJogo } from '../game/mundo'
import { criarRenderizadorCanvas } from '../game/renderizador'
import '../styles/tokens.css'

const canvas = document.querySelector<HTMLCanvasElement>('#mundo')!
const placar = document.querySelector<HTMLElement>('#placar')!
const botaoModo = document.querySelector<HTMLButtonElement>('#modo')!
const botaoSkin = document.querySelector<HTMLButtonElement>('#skin')!

/**
 * Uma raridade por skin desenhada, mais o "sem skin".
 *
 * POR QUE ESTE CONTROLE EXISTE: até 2026-08-14 o sandbox passava só dois
 * argumentos ao renderizador e caía no padrão, que devolve skin nula — ou seja,
 * a ferramenta feita para calibrar sensação NÃO CONSEGUIA reproduzir o defeito
 * mais visível do boneco ("equipei a skin e ele travou"). Ciclar a raridade é o
 * que põe o caso na mão de quem calibra.
 *
 * Os números não são 1..10: `arteDaSkin` agrupa os 10 tiers em 8 desenhos, e
 * estes são um representante de cada. Ciclar tier a tier faria dois cliques
 * seguidos não mudarem nada, o que lê como botão quebrado.
 */
const RARIDADES_DE_SKIN: readonly (number | null)[] = [null, 1, 3, 4, 5, 6, 8, 9, 10]
let indiceDaSkin = 0
const raridadeDaSkin = (): number | null => RARIDADES_DE_SKIN[indiceDaSkin] ?? null

// O sandbox não tem i18n: mostra a chave crua, que é o suficiente para saber
// se o inimigo certo apareceu na região certa.
const renderizador = criarRenderizadorCanvas(canvas, (chave) => chave, raridadeDaSkin)
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

function rotularSkin(): void {
  const raridade = raridadeDaSkin()
  botaoSkin.textContent = raridade === null ? 'Sem skin' : `Skin ${raridade}`
}

botaoSkin.addEventListener('click', () => {
  indiceDaSkin = (indiceDaSkin + 1) % RARIDADES_DE_SKIN.length
  rotularSkin()
})
rotularSkin()

window.addEventListener('resize', () => renderizador.redimensionar())

motor.iniciar()

// Painel de diagnóstico: é o que transforma "parece estranho" em "a densidade
// está em 11 e devia estar em 7". Tudo sai por aqui, e nunca por `console.*`:
// log de client é invisível para quem calibra e proibido em `src/`.
window.setInterval(() => {
  const { heroiX, heroiY, inimigos, projeteis, faseDoPasso } = motor.estado
  const zona = biomaAtual(motor.estado)
  placar.textContent = [
    `região ${zona.id} · ${zona.nome}`,
    `x ${Math.round(heroiX)} · y ${Math.round(heroiY)}`,
    `${inimigos.length} inimigos · ${projeteis.length} tiros`,
    `assinatura: ${zona.assinatura.forma}`,
    // O par que responde "o boneco travou?": a pose escolhida e onde está o
    // ciclo de passo. Com skin equipada a pose repete o mesmo PNG, e é a fase
    // que precisa continuar girando.
    `pose ${poseDoHeroi(motor.estado)} · passo ${faseDoPasso.toFixed(2)}`,
  ].join('   |   ')
}, 200)

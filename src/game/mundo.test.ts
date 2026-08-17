import { beforeEach, describe, expect, it } from 'vitest'

import { PERFIS_DE_ARMA, PERFIL_PUNHO } from './armas'
import { redefinirAjustesVisuais } from './ajustes'
import { ALTURA_MAPA, LARGURA_MAPA, MAPAS, entradaDoMapa } from './mapas'
import {
  avancarMundo,
  camera,
  criarMundo,
  definirArma,
  definirIntencao,
  definirMapa,
  definirModo,
  definirVitalidadeMaxima,
  mapaAtual,
  ninhosDoMapa,
  poseDoHeroi,
  progressoDaPose,
  proporcaoDeVida,
  type EstadoMundo,
  type Inimigo,
} from './mundo'

beforeEach(redefinirAjustesVisuais)

/** Corre o mundo por `segundos`, em passos de quadro. */
function correr(estado: EstadoMundo, segundos: number, passo = 1 / 60): void {
  for (let t = 0; t < segundos; t += passo) avancarMundo(estado, passo)
}

/** Põe um inimigo colado no herói, para exercitar o golpe do inimigo. */
function encostarInimigoNoHeroi(estado: EstadoMundo): Inimigo {
  const inimigo = estado.inimigos[0]
  if (!inimigo) throw new Error('o mundo nasceu sem inimigo')
  inimigo.x = estado.heroiX + 4
  inimigo.y = estado.heroiY
  inimigo.recargaAtaque = 0
  return inimigo
}

describe('o mundo nasce jogável', () => {
  it('o herói entra no centro do mapa, vivo e com inimigo por perto', () => {
    const estado = criarMundo(7, 1)
    expect(estado.heroiX).toBe(entradaDoMapa().x)
    expect(estado.heroiY).toBe(entradaDoMapa().y)
    expect(proporcaoDeVida(estado)).toBe(1)
    expect(estado.inimigos.length).toBeGreaterThan(0)
  })

  it('a mesma semente dá o mesmo mundo', () => {
    const a = criarMundo(42, 3)
    const b = criarMundo(42, 3)
    expect(a.inimigos.map((i) => [i.x, i.y, i.especie.forma])).toEqual(
      b.inimigos.map((i) => [i.x, i.y, i.especie.forma]),
    )
  })

  it('nenhum ninho nasce em cima da entrada', () => {
    // Abrir o mapa já cercado é o oposto de "o herói é quem procura".
    const entrada = entradaDoMapa()
    for (const mapa of MAPAS) {
      for (const ninho of ninhosDoMapa(mapa.id)) {
        expect(
          Math.hypot(ninho.x - entrada.x, ninho.y - entrada.y),
          `mapa ${mapa.id}, ninho ${ninho.id}`,
        ).toBeGreaterThanOrEqual(260)
      }
    }
  })

  it('todo ninho fica dentro do mapa', () => {
    for (const mapa of MAPAS) {
      for (const ninho of ninhosDoMapa(mapa.id)) {
        expect(ninho.x).toBeGreaterThan(0)
        expect(ninho.x).toBeLessThan(LARGURA_MAPA)
        expect(ninho.y).toBeGreaterThan(0)
        expect(ninho.y).toBeLessThan(ALTURA_MAPA)
      }
    }
  })
})

describe('o monstro dá dano', () => {
  it('encostar no herói tira vitalidade', () => {
    // O defeito relatado, em um teste. Antes desta rodada o combate só tinha uma
    // direção: o inimigo encostava e não acontecia nada.
    const estado = criarMundo(3, 1)
    encostarInimigoNoHeroi(estado)

    const antes = estado.heroiVida
    avancarMundo(estado, 1 / 60)
    expect(estado.heroiVida).toBeLessThan(antes)
  })

  it('o dano aparece na tela como número', () => {
    const estado = criarMundo(3, 1)
    encostarInimigoNoHeroi(estado)
    avancarMundo(estado, 1 / 60)

    const aviso = estado.avisos.find((a) => a.alvo === 'heroi')
    expect(aviso).toBeDefined()
    expect(aviso!.valor).toBeGreaterThan(0)
  })

  it('nenhum dano é NaN — inclusive vindo do inimigo assinatura', () => {
    // Uma espécie sem `dano` daria `NaN`, e `NaN` não tira vida de ninguém: o
    // defeito voltaria calado.
    for (const mapa of MAPAS) {
      const estado = criarMundo(mapa.id * 11, mapa.id)
      for (const inimigo of estado.inimigos) {
        expect(Number.isFinite(inimigo.especie.dano), inimigo.especie.forma).toBe(true)
        expect(inimigo.especie.dano, inimigo.especie.forma).toBeGreaterThan(0)
      }
    }
  })

  it('há invulnerabilidade entre um golpe e o seguinte', () => {
    // Sem i-frames, um inimigo colado zeraria a barra em quadros — e o jogador
    // veria a vitalidade sumir sem entender o que aconteceu.
    const estado = criarMundo(3, 1)
    const inimigo = encostarInimigoNoHeroi(estado)
    avancarMundo(estado, 1 / 60)

    const depoisDoPrimeiro = estado.heroiVida
    inimigo.recargaAtaque = 0
    inimigo.x = estado.heroiX + 4
    inimigo.y = estado.heroiY
    avancarMundo(estado, 1 / 60)

    expect(estado.heroiVida).toBe(depoisDoPrimeiro)
    expect(estado.invulneravel).toBeGreaterThan(0)
  })

  it('zerar a vitalidade não tira nada do jogador — só devolve à entrada', () => {
    // A decisão de produto: não existe tela de morte, cooldown nem perda. Quem
    // decide ciclo perdido é o servidor, e nada disto é comunicado a ele.
    const estado = criarMundo(3, 1)
    const inimigo = encostarInimigoNoHeroi(estado)
    estado.heroiVida = 1

    avancarMundo(estado, 1 / 60)

    expect(proporcaoDeVida(estado)).toBe(1)
    expect(estado.heroiX).toBe(entradaDoMapa().x)
    expect(estado.heroiY).toBe(entradaDoMapa().y)
    expect(estado.reinicioCiclo).toBeGreaterThan(0)
    expect(estado.invulneravel).toBeGreaterThan(0)
    // O inimigo continua vivo: nada foi "cobrado" de ninguém.
    expect(inimigo.vida).toBeGreaterThan(0)
  })

  it('a vitalidade volta sozinha depois de um tempo sem apanhar', () => {
    const estado = criarMundo(3, 1)
    estado.inimigos = []
    estado.heroiVida = estado.heroiVidaMaxima * 0.5

    const antes = estado.heroiVida
    correr(estado, 6)
    expect(estado.heroiVida).toBeGreaterThan(antes)
    expect(proporcaoDeVida(estado)).toBeLessThanOrEqual(1)
  })

  it('a barra nunca sai do intervalo 0–1', () => {
    const estado = criarMundo(3, 1)
    estado.heroiVida = -50
    expect(proporcaoDeVida(estado)).toBe(0)
    estado.heroiVida = estado.heroiVidaMaxima * 3
    expect(proporcaoDeVida(estado)).toBe(1)
  })
})

describe('a barra segue a Vitalidade do servidor', () => {
  it('subir o máximo preserva a proporção — não cura de graça nem tira vida', () => {
    const estado = criarMundo(3, 1)
    estado.heroiVida = estado.heroiVidaMaxima / 2
    const proporcao = proporcaoDeVida(estado)

    definirVitalidadeMaxima(estado, 400)

    expect(estado.heroiVidaMaxima).toBe(400)
    expect(proporcaoDeVida(estado)).toBeCloseTo(proporcao, 2)
  })

  it('valor inválido do servidor é ignorado em vez de zerar a barra', () => {
    const estado = criarMundo(3, 1)
    const maxima = estado.heroiVidaMaxima
    for (const valor of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      definirVitalidadeMaxima(estado, valor)
      expect(estado.heroiVidaMaxima, `${valor}`).toBe(maxima)
    }
  })
})

describe('o monstro não persegue o herói pelo mapa', () => {
  it('inimigo longe fica em volta do ninho', () => {
    // O pedido literal: "no meio do mapa o boneco deve encontrar monstros, não
    // eles virem atrás do boneco".
    const estado = criarMundo(9, 1)
    const inimigo = estado.inimigos[0]!
    const ninho = estado.ninhos.find((n) => n.id === inimigo.ninhoId)!

    // Herói bem longe, e parado.
    estado.heroiX = 40
    estado.heroiY = 40
    correr(estado, 5)

    // O inimigo pode ter sido descartado por distância; se sobreviveu, está em
    // casa — nunca a caminho do herói.
    const ainda = estado.inimigos.find((i) => i.id === inimigo.id)
    if (ainda) {
      expect(Math.hypot(ainda.x - ninho.x, ainda.y - ninho.y)).toBeLessThanOrEqual(120)
    }
  })

  it('o inimigo não fica mais perto do herói distante com o tempo', () => {
    const estado = criarMundo(11, 2)
    estado.heroiX = 60
    estado.heroiY = 60

    const alvo = estado.inimigos.find(
      (i) => Math.hypot(i.x - estado.heroiX, i.y - estado.heroiY) > 400,
    )
    if (!alvo) return

    const antes = Math.hypot(alvo.x - estado.heroiX, alvo.y - estado.heroiY)
    correr(estado, 4)
    const depois = Math.hypot(alvo.x - estado.heroiX, alvo.y - estado.heroiY)

    // Passeio pode variar um pouco; o que não pode é ele CAMINHAR até o herói.
    expect(depois).toBeGreaterThan(antes - 120)
  })

  it('inimigo perto avança — senão o mapa vira museu', () => {
    // O contrapeso do teste acima: "não persegue" não pode virar "não reage".
    const estado = criarMundo(5, 1)
    const inimigo = estado.inimigos[0]!
    inimigo.x = estado.heroiX + 120
    inimigo.y = estado.heroiY
    inimigo.recargaAtaque = 99

    const antes = Math.hypot(inimigo.x - estado.heroiX, inimigo.y - estado.heroiY)
    correr(estado, 0.5)
    const depois = Math.hypot(inimigo.x - estado.heroiX, inimigo.y - estado.heroiY)

    expect(depois).toBeLessThan(antes)
  })
})

describe('a arma decide o ataque', () => {
  function atacarComArma(familia: keyof typeof PERFIS_DE_ARMA): EstadoMundo {
    const estado = criarMundo(4, 1)
    definirArma(estado, PERFIS_DE_ARMA[familia])
    estado.inimigos = []
    definirIntencao(estado, {
      dx: 0,
      dy: 0,
      miraX: estado.heroiX + 100,
      miraY: estado.heroiY,
      atirando: true,
    })
    avancarMundo(estado, 1 / 60)
    return estado
  }

  it('espada, adaga e martelo não soltam bolinha nenhuma', () => {
    for (const familia of ['espada', 'adaga', 'martelo'] as const) {
      const estado = atacarComArma(familia)
      expect(estado.projeteis, familia).toHaveLength(0)
      expect(estado.golpes.length, familia).toBeGreaterThan(0)
    }
  })

  it('o arco solta flecha; cajado e varinha soltam magia', () => {
    expect(atacarComArma('arco').projeteis[0]?.tipo).toBe('flecha')
    expect(atacarComArma('cajado').projeteis[0]?.tipo).toBe('magia')
    expect(atacarComArma('varinha').projeteis[0]?.tipo).toBe('magia')
    for (const familia of ['arco', 'cajado', 'varinha'] as const) {
      expect(atacarComArma(familia).golpes, familia).toHaveLength(0)
    }
  })

  it('o projétil morre no fim do alcance — longe, não infinito', () => {
    // Sem isto, "atirar" seria mirar de qualquer canto do mapa, e a seção 4 da
    // spec (o herói é quem procura) deixaria de existir na prática.
    for (const familia of ['arco', 'cajado', 'varinha'] as const) {
      const estado = atacarComArma(familia)
      expect(estado.projeteis, familia).toHaveLength(1)

      // Solta o gatilho antes de correr o relógio: com o dedo preso, cada
      // quadro criaria um projétil novo e o teste nunca veria a lista esvaziar.
      definirIntencao(estado, { dx: 0, dy: 0, miraX: null, miraY: null, atirando: false })
      correr(estado, 6)

      expect(estado.projeteis, `${familia} atravessou o mapa`).toHaveLength(0)
    }
  })

  it('o punho tem alcance curto — mas mata', () => {
    const estado = criarMundo(4, 1)
    definirArma(estado, PERFIL_PUNHO)
    const inimigo = estado.inimigos[0]!
    inimigo.x = estado.heroiX + 10
    inimigo.y = estado.heroiY
    const vidaAntes = inimigo.vida

    definirIntencao(estado, {
      dx: 0,
      dy: 0,
      miraX: estado.heroiX + 50,
      miraY: estado.heroiY,
      atirando: true,
    })
    avancarMundo(estado, 1 / 60)

    expect(inimigo.vida).toBeLessThan(vidaAntes)
  })

  it('o golpe de corpo só pega quem está no arco à frente', () => {
    const estado = criarMundo(4, 1)
    definirArma(estado, PERFIS_DE_ARMA.espada)

    const frente = estado.inimigos[0]!
    const costas = estado.inimigos[1]!
    frente.x = estado.heroiX + 30
    frente.y = estado.heroiY
    costas.x = estado.heroiX - 30
    costas.y = estado.heroiY
    const vidaCostas = costas.vida

    definirIntencao(estado, {
      dx: 0,
      dy: 0,
      miraX: estado.heroiX + 200,
      miraY: estado.heroiY,
      atirando: true,
    })
    avancarMundo(estado, 1 / 60)

    expect(frente.vida).toBeLessThan(frente.especie.vida)
    expect(costas.vida).toBe(vidaCostas)
  })

  it('a recarga da arma limita a cadência', () => {
    const estado = criarMundo(4, 1)
    definirArma(estado, PERFIS_DE_ARMA.martelo)
    estado.inimigos = []
    definirIntencao(estado, {
      dx: 0,
      dy: 0,
      miraX: estado.heroiX + 100,
      miraY: estado.heroiY,
      atirando: true,
    })

    avancarMundo(estado, 1 / 60)
    avancarMundo(estado, 1 / 60)
    // Dois quadros, um golpe só: o martelo é o mais lento da tabela.
    expect(estado.golpes).toHaveLength(1)
  })
})

describe('trocar de mapa', () => {
  it('leva o herói para a entrada, com a arena nova e a barra cheia', () => {
    const estado = criarMundo(2, 1)
    estado.heroiX = 100
    estado.heroiY = 100
    estado.heroiVida = 1

    definirMapa(estado, 5)

    expect(mapaAtual(estado).id).toBe(5)
    expect(estado.heroiX).toBe(entradaDoMapa().x)
    expect(proporcaoDeVida(estado)).toBe(1)
    expect(estado.projeteis).toHaveLength(0)
    expect(estado.golpes).toHaveLength(0)
  })

  it('trocar para o mesmo mapa não reposiciona o herói', () => {
    // Tocar no mapa em que já se está não pode teleportar ninguém.
    const estado = criarMundo(2, 3)
    estado.heroiX = 100
    definirMapa(estado, 3)
    expect(estado.heroiX).toBe(100)
  })

  it('mapa inválido cai no primeiro em vez de quebrar', () => {
    const estado = criarMundo(2, 1)
    definirMapa(estado, 99)
    expect(mapaAtual(estado).id).toBe(1)
  })
})

describe('a câmera acompanha a tela, não o contrário', () => {
  it('nunca mostra fora do mapa em tela normal', () => {
    const estado = criarMundo(6, 1)
    estado.heroiX = 10
    estado.heroiY = 10
    const canto = camera(estado, 640, 360)
    expect(canto.x).toBeGreaterThanOrEqual(0)
    expect(canto.y).toBeGreaterThanOrEqual(0)

    estado.heroiX = LARGURA_MAPA - 10
    estado.heroiY = ALTURA_MAPA - 10
    const outro = camera(estado, 640, 360)
    expect(outro.x).toBeLessThanOrEqual(LARGURA_MAPA - 640)
    expect(outro.y).toBeLessThanOrEqual(ALTURA_MAPA - 360)
  })

  it('vista maior que o mapa centraliza em vez de encostar num canto', () => {
    // Monitor ultrawide: sem isto, o mapa ficaria colado à esquerda com vazio à
    // direita.
    const estado = criarMundo(6, 1)
    const canto = camera(estado, LARGURA_MAPA + 400, ALTURA_MAPA + 200)
    expect(canto.x).toBe(-200)
    expect(canto.y).toBe(-100)
  })
})

describe('o auto continua sendo auto', () => {
  it('ligado, ele caça sozinho e ignora a intenção do jogador', () => {
    const estado = criarMundo(8, 1)
    definirModo(estado, 'auto')
    definirIntencao(estado, { dx: 1, dy: 0, miraX: null, miraY: null, atirando: false })
    expect(estado.intencao.dx).toBe(0)

    definirArma(estado, PERFIS_DE_ARMA.arco)

    // Observa o mundo enquanto ele roda, em vez de comparar duas fotos: o auto
    // escolhe o alvo mais próximo a cada quadro, então perseguir UM inimigo
    // específico testaria a escolha dele, não o fato de ele estar caçando.
    let acertou = false
    for (let t = 0; t < 8; t += 1 / 60) {
      avancarMundo(estado, 1 / 60)
      if (estado.avisos.some((a) => a.alvo === 'inimigo')) acertou = true
    }

    expect(acertou).toBe(true)
  })

  it('o ciclo de passo avança nos DOIS modos', () => {
    // O caso que regride calado: a fase é o que anima o boneco, e enganchá-la
    // na intenção do jogador funcionaria em todo teste manual e falharia no
    // auto — que é o modo vendido —, porque `definirModo` força intenção parada
    // e `definirIntencao` recusa input enquanto o auto está ligado.
    for (const modo of ['manual', 'auto'] as const) {
      const estado = criarMundo(8, 1)
      definirModo(estado, modo)
      // A mesma intenção nos dois: no manual ela move o herói, no auto ela é
      // recusada de propósito e quem move é o piloto.
      definirIntencao(estado, { dx: 1, dy: 0, miraX: null, miraY: null, atirando: false })

      let balancou = false
      for (let t = 0; t < 3; t += 1 / 60) {
        avancarMundo(estado, 1 / 60)
        if (estado.faseDoPasso > 0) balancou = true
      }

      expect(balancou, modo).toBe(true)
    }
  })
})

describe('o boneco anda quando anda, e para quando para', () => {
  /** Um mapa vazio: sem inimigo, ninguém empurra nem fere o herói. */
  function mundoSemNinguem(): EstadoMundo {
    const estado = criarMundo(8, 1)
    estado.inimigos = []
    estado.ninhos = []
    return estado
  }

  const PARADA = { dx: 0, dy: 0, miraX: null, miraY: null, atirando: false }

  it('parar no meio da passada assenta o ciclo no zero', () => {
    // Sem isto o herói ficaria permanentemente alguns pixels no ar, numa altura
    // diferente a cada vez que parasse — e "parado" deixaria de ser uma pose só.
    const estado = mundoSemNinguem()
    definirIntencao(estado, { dx: 1, dy: 0, miraX: null, miraY: null, atirando: false })
    correr(estado, 0.5)
    expect(estado.faseDoPasso, 'o herói nem chegou a andar').toBeGreaterThan(0)

    definirIntencao(estado, PARADA)
    correr(estado, 2)

    expect(estado.faseDoPasso).toBe(0)
  })

  it('empurrar a parede não faz o herói andar no lugar', () => {
    // `mover` continua sendo chamado todo quadro contra a borda: é o `limitar`
    // que trava a posição, não o chamador. Se a fase avançasse pela intenção em
    // vez do deslocamento real, o boneco pisaria eternamente no canto do mapa.
    const estado = mundoSemNinguem()
    estado.heroiX = 16
    estado.heroiY = 16
    definirIntencao(estado, { dx: -1, dy: -1, miraX: null, miraY: null, atirando: false })

    correr(estado, 2)

    expect(estado.faseDoPasso).toBe(0)
    expect(estado.heroiX).toBe(16)
    expect(estado.heroiY).toBe(16)
  })

  it('morrer não dispara um ciclo de caminhada', () => {
    // Zerar a vitalidade devolve o herói à entrada. Um ciclo de passo derivado
    // de delta de posição entre quadros leria esse teleporte como uma corrida
    // gigante, e o boneco surtaria justamente no quadro da volta.
    const estado = criarMundo(3, 1)
    definirIntencao(estado, PARADA)
    encostarInimigoNoHeroi(estado)
    estado.heroiVida = 1

    avancarMundo(estado, 1 / 60)

    expect(estado.heroiX).toBe(entradaDoMapa().x)
    expect(estado.faseDoPasso).toBe(0)
  })

  it('trocar de mapa chega parado', () => {
    const estado = mundoSemNinguem()
    definirIntencao(estado, { dx: 1, dy: 0, miraX: null, miraY: null, atirando: false })
    correr(estado, 0.5)
    expect(estado.faseDoPasso).toBeGreaterThan(0)

    definirMapa(estado, 4)

    expect(estado.faseDoPasso).toBe(0)
  })

  it('o tempo restante da pose acompanha a pose escolhida', () => {
    // Duas verdades sobre o mesmo tempo é o defeito que esta função existe para
    // impedir: quem desenha não pode repetir as durações por conta própria.
    const estado = criarMundo(4, 1)
    expect(progressoDaPose(estado)).toBe(0)

    estado.poseComemoracao = 0.5
    expect(progressoDaPose(estado)).toBeCloseTo(1, 5)

    // Ataque em cima de comemoração: a precedência é a mesma de `poseDoHeroi`,
    // senão o desenho misturaria o tempo de uma pose com o gesto da outra.
    estado.poseAtaque = 0.09
    expect(poseDoHeroi(estado)).toBe('atacando')
    expect(progressoDaPose(estado)).toBeCloseTo(0.5, 5)

    // E nunca passa de 1, mesmo com um temporizador maior que a duração.
    estado.poseAtaque = 99
    expect(progressoDaPose(estado)).toBe(1)
  })
})

describe('o herói fica dentro do mapa', () => {
  it('andar contra a borda não sai da arena', () => {
    const estado = criarMundo(10, 1)
    definirIntencao(estado, { dx: -1, dy: -1, miraX: null, miraY: null, atirando: false })
    correr(estado, 30)

    expect(estado.heroiX).toBeGreaterThanOrEqual(0)
    expect(estado.heroiY).toBeGreaterThanOrEqual(0)

    definirIntencao(estado, { dx: 1, dy: 1, miraX: null, miraY: null, atirando: false })
    correr(estado, 40)

    expect(estado.heroiX).toBeLessThanOrEqual(LARGURA_MAPA)
    expect(estado.heroiY).toBeLessThanOrEqual(ALTURA_MAPA)
  })
})

import { describe, expect, it } from 'vitest'

import {
  ARMAS_DESTREZA,
  ARMAS_FISICAS,
  ARMAS_MAGICAS,
  PERFIS_DE_ARMA,
  PERFIL_PUNHO,
  embaralhar,
  familiaDaArma,
  perfilDaArma,
  type FamiliaArma,
} from './armas'
import { arteDoItem } from './atlas'
import type { TipoDano } from '../lib/tipos'

const IDS = Array.from({ length: 400 }, (_, i) => `item-${i}`)

/** Os três canais. Escrito à mão porque o teste precisa reprovar se um sumir. */
const CANAIS: readonly TipoDano[] = ['fisico', 'destreza', 'magico']

describe('a tabela que o dono pediu', () => {
  it('espada, adaga e martelo são corpo — e não soltam bolinha nenhuma', () => {
    // O pedido literal: "sem soltar aquelas bolinhas". Antes desta rodada TODA
    // arma disparava o mesmo projétil, inclusive o martelo.
    for (const familia of ['espada', 'adaga', 'martelo'] as const) {
      expect(PERFIS_DE_ARMA[familia].corpo, familia).toBe(true)
      expect(PERFIS_DE_ARMA[familia].projetil, familia).toBeNull()
    }
  })

  it('a espada tem alcance médio: maior que adaga e martelo, menor que qualquer arma de longe', () => {
    const { espada, adaga, martelo, arco, cajado, varinha } = PERFIS_DE_ARMA
    expect(espada.alcance).toBeGreaterThan(adaga.alcance)
    expect(espada.alcance).toBeGreaterThan(martelo.alcance)
    for (const longe of [arco, cajado, varinha]) {
      expect(espada.alcance).toBeLessThan(longe.alcance)
    }
  })

  it('o arco solta flecha; cajado e varinha soltam magia', () => {
    expect(PERFIS_DE_ARMA.arco.projetil).toBe('flecha')
    expect(PERFIS_DE_ARMA.cajado.projetil).toBe('magia')
    expect(PERFIS_DE_ARMA.varinha.projetil).toBe('magia')
    for (const familia of ['arco', 'cajado', 'varinha'] as const) {
      expect(PERFIS_DE_ARMA[familia].corpo, familia).toBe(false)
    }
  })

  it('alcance longo, não infinito', () => {
    // A outra metade do pedido, e a que some sem teste: um projétil sem fim
    // atravessaria o mapa e transformaria "procurar monstro" em "mirar de
    // qualquer lugar", desmontando a seção 4 da spec.
    for (const familia of ['arco', 'cajado', 'varinha'] as const) {
      const { alcance } = PERFIS_DE_ARMA[familia]
      expect(alcance, familia).toBeGreaterThan(0)
      expect(Number.isFinite(alcance), familia).toBe(true)
      // 1920 = largura do mapa; o alcance é multiplicador sobre 210px.
      expect(alcance * 210, familia).toBeLessThan(1920 / 2)
    }
  })

  it('toda arma tem número utilizável — nenhum NaN, nenhum zero de cadência', () => {
    for (const perfil of [...Object.values(PERFIS_DE_ARMA), PERFIL_PUNHO]) {
      expect(perfil.alcance, perfil.familia).toBeGreaterThan(0)
      expect(perfil.recarga, perfil.familia).toBeGreaterThan(0)
      expect(perfil.dano, perfil.familia).toBeGreaterThan(0)
      expect(Number.isFinite(perfil.arco), perfil.familia).toBe(true)
    }
  })

  it('quem bate devagar bate mais forte', () => {
    // A troca que faz as seis armas serem escolhas e não uma escada. Martelo é o
    // extremo lento/forte; adaga o extremo rápido/fraco.
    const { martelo, adaga } = PERFIS_DE_ARMA
    expect(martelo.recarga).toBeGreaterThan(adaga.recarga)
    expect(martelo.dano).toBeGreaterThan(adaga.dano)
    expect(martelo.arco).toBeGreaterThan(adaga.arco)
  })

  it('só arma de corpo tem arco de golpe', () => {
    for (const perfil of Object.values(PERFIS_DE_ARMA)) {
      if (!perfil.corpo) expect(perfil.arco, perfil.familia).toBe(0)
      else expect(perfil.arco, perfil.familia).toBeGreaterThan(0)
    }
  })
})

describe('família da arma', () => {
  it('é estável: o mesmo id devolve sempre a mesma família', () => {
    for (const id of IDS.slice(0, 50)) {
      expect(familiaDaArma(id, 'fisico')).toBe(familiaDaArma(id, 'fisico'))
      expect(embaralhar(id)).toBe(embaralhar(id))
    }
  })

  it('cada canal só produz arma do próprio canal', () => {
    const doCanal: Record<TipoDano, Set<string>> = {
      fisico: new Set<string>(ARMAS_FISICAS),
      destreza: new Set<string>(ARMAS_DESTREZA),
      magico: new Set<string>(ARMAS_MAGICAS),
    }

    for (const id of IDS) {
      for (const canal of CANAIS) {
        expect(doCanal[canal].has(familiaDaArma(id, canal)), `${id}/${canal}`).toBe(true)
      }
      // `null` (item sem tipo de dano vindo do servidor) cai no físico.
      expect(doCanal.fisico.has(familiaDaArma(id, null)), id).toBe(true)
    }
  })

  it('as três listas são disjuntas — nenhuma família serve a dois canais', () => {
    // Sem isto, `arco` poderia ficar nas listas de destreza E de física durante
    // uma edição malfeita: o teste acima continuaria verde, e o jogador teria um
    // arco escalando com Força. A soma dos três tamanhos contra o tamanho da
    // união é o que prova a disjunção.
    const todas = [...ARMAS_FISICAS, ...ARMAS_DESTREZA, ...ARMAS_MAGICAS]
    expect(new Set(todas).size).toBe(todas.length)
  })

  it('as seis famílias aparecem', () => {
    const vistas = new Set<FamiliaArma>()
    for (const id of IDS) {
      for (const canal of CANAIS) vistas.add(familiaDaArma(id, canal))
    }
    // Os três somados. Antes eram só físicas + mágicas — e quando arco e adaga
    // mudaram de canal, essa soma caiu de 6 para 4 e o teste continuou VERDE
    // tendo parado de enxergar duas famílias.
    expect(vistas.size).toBe(ARMAS_FISICAS.length + ARMAS_DESTREZA.length + ARMAS_MAGICAS.length)
    expect(vistas.size).toBe(6)
  })
})

describe('o canal de destreza não pode trocar a arma de ninguém', () => {
  /**
   * A tabela física de ANTES do canal de destreza, na ordem exata em que estava
   * em `armas.ts`. É o oráculo: para todo item já concedido, `familiaDaArma`
   * precisa devolver o que esta linha devolvia.
   */
  const FAMILIA_ANTES = ['espada', 'adaga', 'arco', 'martelo'] as const

  /**
   * O canal que a migration atribui a cada arma já existente: `h % 4` em (1, 2)
   * — adaga e arco — vira `destreza`; o resto continua físico. Precisa ser a
   * mesma condição do `update` do Postgres, e é isso que amarra os dois lados.
   */
  function canalDepois(id: string): TipoDano {
    const h = embaralhar(id) % 4
    return h === 1 || h === 2 ? 'destreza' : 'fisico'
  }

  it('a arma de todo item físico continua exatamente a mesma', () => {
    // O teste central desta rodada. A família sai de `embaralhar(id) % tamanho`,
    // e a lista física encolheu de 4 para 2 — então a ORDEM de `ARMAS_DESTREZA`
    // é carga: `['adaga', 'arco']` em vez de `['arco', 'adaga']` trocaria a arma
    // de metade dos jogadores sem nenhum outro teste reclamar.
    const vistas = new Set<string>()

    for (let i = 0; i < 600; i++) {
      for (const id of [`item-${i}`, `7c9e6679-7425-40de-944b-e07fc1f90a${i % 10}${i % 7}`]) {
        const antes = FAMILIA_ANTES[embaralhar(id) % 4]!
        expect(familiaDaArma(id, canalDepois(id)), id).toBe(antes)
        vistas.add(antes)
      }
    }

    // Se a amostra não exercitasse as quatro, a prova valeria pouco.
    expect(vistas).toEqual(new Set(FAMILIA_ANTES))
  })

  it('arma mágica não é tocada — a lista dela não mudou', () => {
    // O `2` é literal de propósito: acrescentar uma terceira família mágica
    // mudaria `% familias.length` e trocaria o cajado de quem já tem um. É uma
    // decisão de produto, e é aqui que ela precisa aparecer.
    expect(ARMAS_MAGICAS).toHaveLength(2)
    for (const id of IDS) {
      expect(familiaDaArma(id, 'magico'), id).toBe(ARMAS_MAGICAS[embaralhar(id) % 2])
    }
  })

  it('adaga e arco saíram do canal físico, espada e martelo ficaram', () => {
    // A outra metade da conta: `h % 2 = (h % 4) % 2`. Escrito como asserção para
    // que reordenar `ARMAS_FISICAS` também precise passar por aqui.
    expect([...ARMAS_FISICAS]).toEqual(['espada', 'martelo'])
    expect([...ARMAS_DESTREZA]).toEqual(['arco', 'adaga'])
  })
})

describe('o ícone não pode mentir sobre o combate', () => {
  it('a arma que aparece na mochila é a que ataca', () => {
    // O motivo de `armas.ts` existir. Enquanto o ícone saía de `atlas.ts` e o
    // combate de `mundo.ts`, nada impedia um item de MOSTRAR espada e ATIRAR
    // como cajado — e o jogador descobriria antes de nós.
    for (const id of IDS) {
      for (const tipoDano of [...CANAIS, null]) {
        const familia = familiaDaArma(id, tipoDano)
        const caminho = arteDoItem('arma', 5, id, tipoDano)
        expect(caminho, `${id}/${tipoDano}`).toContain(`w-${familia}-`)
        expect(perfilDaArma({ id, tipoDano }).familia, `${id}/${tipoDano}`).toBe(familia)
      }
    }
  })
})

describe('sem arma equipada', () => {
  it('o herói soca — não fica desarmado', () => {
    // Jogador novo abre o jogo com o loadout vazio. Se `perfilDaArma` devolvesse
    // `null`, os primeiros cinco segundos do produto seriam um boneco que anda e
    // não faz nada.
    expect(perfilDaArma(null)).toBe(PERFIL_PUNHO)
    expect(perfilDaArma(undefined)).toBe(PERFIL_PUNHO)
    expect(PERFIL_PUNHO.corpo).toBe(true)
    expect(PERFIL_PUNHO.projetil).toBeNull()
  })

  it('o punho é pior que qualquer arma — mas serve', () => {
    for (const perfil of Object.values(PERFIS_DE_ARMA)) {
      expect(PERFIL_PUNHO.dano, perfil.familia).toBeLessThan(perfil.dano)
    }
    expect(PERFIL_PUNHO.dano).toBeGreaterThan(0)
  })
})

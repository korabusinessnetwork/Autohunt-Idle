import { describe, expect, it } from 'vitest'

import {
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

const IDS = Array.from({ length: 400 }, (_, i) => `item-${i}`)

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

  it('dano mágico nunca vira arma física, e vice-versa', () => {
    const fisicas = new Set<string>(ARMAS_FISICAS)
    const magicas = new Set<string>(ARMAS_MAGICAS)
    for (const id of IDS) {
      expect(magicas.has(familiaDaArma(id, 'magico')), id).toBe(true)
      expect(fisicas.has(familiaDaArma(id, 'fisico')), id).toBe(true)
      // `null` (item sem tipo de dano vindo do servidor) cai no físico.
      expect(fisicas.has(familiaDaArma(id, null)), id).toBe(true)
    }
  })

  it('as seis famílias aparecem', () => {
    const vistas = new Set<FamiliaArma>()
    for (const id of IDS) {
      vistas.add(familiaDaArma(id, 'fisico'))
      vistas.add(familiaDaArma(id, 'magico'))
    }
    expect(vistas.size).toBe(ARMAS_FISICAS.length + ARMAS_MAGICAS.length)
  })
})

describe('o ícone não pode mentir sobre o combate', () => {
  it('a arma que aparece na mochila é a que ataca', () => {
    // O motivo de `armas.ts` existir. Enquanto o ícone saía de `atlas.ts` e o
    // combate de `mundo.ts`, nada impedia um item de MOSTRAR espada e ATIRAR
    // como cajado — e o jogador descobriria antes de nós.
    for (const id of IDS) {
      for (const tipoDano of ['fisico', 'magico', null] as const) {
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

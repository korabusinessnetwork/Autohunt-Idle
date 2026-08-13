import { describe, expect, it } from 'vitest'

import { ARMAS_FISICAS, ARMAS_MAGICAS, familiaDaArma } from '../../game/armas'
import { RARIDADES } from '../../game/regrasLoot'
import { traduzir, type ChaveI18n, type Idioma } from '../../lib/i18n'
import type { TipoItem } from '../../lib/tipos'
import { baseDoItem, nomeDoItem } from './nomeDoItem'

// Traduz de verdade, com o dicionário real: metade do valor deste módulo está
// nas strings (concordância de gênero), e um `t` falso não provaria nada.
const t = (idioma: Idioma) => (chave: ChaveI18n, valores?: Record<string, string | number>) =>
  traduzir(idioma, chave, valores)

/** Um id que produz a família pedida, achado por força bruta. */
function idComFamilia(familia: string, tipoDano: 'fisico' | 'magico'): string {
  for (let i = 0; i < 10000; i++) {
    const id = `item-${i}`
    if (familiaDaArma(id, tipoDano) === familia) return id
  }
  throw new Error(`nenhum id produz a família ${familia}`)
}

describe('nome da peça', () => {
  it('chama a arma pela família, não pelo slot', () => {
    // O pedido do dono, em uma linha: onde estava escrito "Arma" tem que estar
    // o nome da arma.
    const id = idComFamilia('espada', 'fisico')
    const nome = nomeDoItem({ tipo: 'arma', raridade: 5, id, tipoDano: 'fisico' }, t('pt'))

    expect(nome).toBe('Espada lendária')
  })

  it('concorda em gênero — a mesma raridade muda de forma', () => {
    // "Cajado lendária" é o erro que este módulo existe para não cometer.
    const cajado = idComFamilia('cajado', 'magico')
    const espada = idComFamilia('espada', 'fisico')

    expect(nomeDoItem({ tipo: 'arma', raridade: 5, id: cajado, tipoDano: 'magico' }, t('pt'))).toBe(
      'Cajado lendário',
    )
    expect(nomeDoItem({ tipo: 'arma', raridade: 5, id: espada, tipoDano: 'fisico' }, t('pt'))).toBe(
      'Espada lendária',
    )
  })

  it('nomeia as peças que não são arma pelo tipo, também com concordância', () => {
    expect(nomeDoItem({ tipo: 'capacete', raridade: 10 }, t('pt'))).toBe('Capacete cósmico')
    expect(nomeDoItem({ tipo: 'armadura', raridade: 10 }, t('pt'))).toBe('Armadura cósmica')
    expect(nomeDoItem({ tipo: 'bota', raridade: 3 }, t('pt'))).toBe('Bota rara')
    expect(nomeDoItem({ tipo: 'acessorio', raridade: 3 }, t('pt'))).toBe('Acessório raro')
  })

  it('em inglês o adjetivo vem antes e não concorda', () => {
    const cajado = idComFamilia('cajado', 'magico')
    const espada = idComFamilia('espada', 'fisico')

    expect(nomeDoItem({ tipo: 'arma', raridade: 5, id: cajado, tipoDano: 'magico' }, t('en'))).toBe(
      'Legendary Staff',
    )
    expect(nomeDoItem({ tipo: 'arma', raridade: 5, id: espada, tipoDano: 'fisico' }, t('en'))).toBe(
      'Legendary Sword',
    )
  })

  it('o dano decide de qual conjunto a família sai', () => {
    // Uma arma mágica nunca pode se chamar "Espada": o nome tem de bater com o
    // ícone e com o jeito de atirar, e os três saem do mesmo lugar.
    for (let i = 0; i < 200; i++) {
      const id = `prova-${i}`
      const fisica = baseDoItem({ tipo: 'arma', raridade: 1, id, tipoDano: 'fisico' })
      const magica = baseDoItem({ tipo: 'arma', raridade: 1, id, tipoDano: 'magico' })

      expect(ARMAS_FISICAS.map((f) => `item.base.${f}`)).toContain(fisica.chave)
      expect(ARMAS_MAGICAS.map((f) => `item.base.${f}`)).toContain(magica.chave)
    }
  })

  it('sem id volta a ser o tipo — é o caso da pilha de síntese', () => {
    // Nove armas diferentes numa pilha não têm um nome só. Chamar a pilha de
    // "Adaga comum" porque a primeira peça é uma adaga seria mentira.
    expect(nomeDoItem({ tipo: 'arma', raridade: 1 }, t('pt'))).toBe('Arma comum')
  })

  it('chave e pedra não ganham adjetivo de raridade', () => {
    for (const tipo of [
      'chave',
      'pedra_fortificacao',
      'pedra_sorte',
      'pedra_garantia',
    ] as TipoItem[]) {
      const nome = nomeDoItem({ tipo, raridade: 7 }, t('pt'))
      expect(nome, tipo).not.toMatch(/dourad/)
    }
    expect(nomeDoItem({ tipo: 'chave', raridade: 7 }, t('pt'))).toBe('Chave')
  })

  it('nomeia todo tipo em toda raridade sem deixar buraco', () => {
    // Rede contra o buraco silencioso: chave de tradução que não existe volta
    // como a própria chave, e "item.adj.f.epico" na tela é pior do que um
    // nome feio.
    const TIPOS: TipoItem[] = [
      'arma',
      'capacete',
      'armadura',
      'luva',
      'bota',
      'acessorio',
      'skin',
      'chave',
      'pedra_fortificacao',
      'pedra_sorte',
      'pedra_garantia',
    ]

    for (const idioma of ['pt', 'en'] as Idioma[]) {
      for (const tipo of TIPOS) {
        for (let raridade = 1; raridade <= RARIDADES.length; raridade++) {
          const nome = nomeDoItem({ tipo, raridade, id: 'x-1', tipoDano: 'fisico' }, t(idioma))
          expect(nome, `${idioma} ${tipo} ${raridade}`).not.toMatch(/item\.|raridade\./)
          expect(nome.trim(), `${idioma} ${tipo} ${raridade}`).not.toBe('')
        }
      }
    }
  })
})

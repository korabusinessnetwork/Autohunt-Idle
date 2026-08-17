import { describe, expect, it } from 'vitest'

import { ARMAS_DESTREZA, ARMAS_FISICAS, ARMAS_MAGICAS, familiaDaArma } from '../../game/armas'
import { RARIDADES } from '../../game/regrasLoot'
import { traduzir, type ChaveI18n, type Idioma } from '../../lib/i18n'
import type { TipoDano, TipoItem } from '../../lib/tipos'
import { baseDoItem, nomeDoItem } from './nomeDoItem'

// Traduz de verdade, com o dicionário real: metade do valor deste módulo está
// nas strings (concordância de gênero), e um `t` falso não provaria nada.
const t = (idioma: Idioma) => (chave: ChaveI18n, valores?: Record<string, string | number>) =>
  traduzir(idioma, chave, valores)

// O parâmetro é `TipoDano`, e não a união escrita à mão que estava aqui antes:
// com a união fixa, pedir uma adaga (que passou para o canal de destreza)
// lançaria o erro de força bruta em vez de dar um erro de tipo na hora.
/** Um id que produz a família pedida, achado por força bruta. */
function idComFamilia(familia: string, tipoDano: TipoDano): string {
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
    //
    // Os três canais entram aqui juntos de propósito. Enquanto eram dois, um
    // canal esquecido saltava aos olhos; com três, o esquecido passa calado.
    const conjuntos: Record<TipoDano, readonly string[]> = {
      fisico: ARMAS_FISICAS,
      destreza: ARMAS_DESTREZA,
      magico: ARMAS_MAGICAS,
    }

    for (let i = 0; i < 200; i++) {
      const id = `prova-${i}`
      for (const [canal, familias] of Object.entries(conjuntos) as [
        TipoDano,
        readonly string[],
      ][]) {
        const base = baseDoItem({ tipo: 'arma', raridade: 1, id, tipoDano: canal })
        expect(familias.map((f) => `item.base.${f}`)).toContain(base.chave)
      }
    }
  })

  it('a arma do arqueiro tem nome de arma do arqueiro', () => {
    // O canal de destreza é o que esta rodada criou, e o nome é o primeiro
    // lugar onde o jogador o encontra — antes de qualquer número de dano.
    const arco = idComFamilia('arco', 'destreza')
    const adaga = idComFamilia('adaga', 'destreza')

    expect(nomeDoItem({ tipo: 'arma', raridade: 5, id: arco, tipoDano: 'destreza' }, t('pt'))).toBe(
      'Arco lendário',
    )
    expect(nomeDoItem({ tipo: 'arma', raridade: 5, id: adaga, tipoDano: 'destreza' }, t('pt'))).toBe(
      'Adaga lendária',
    )
    expect(nomeDoItem({ tipo: 'arma', raridade: 5, id: arco, tipoDano: 'destreza' }, t('en'))).toBe(
      'Legendary Bow',
    )
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

import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { RARIDADES, TIER_MAXIMO, TIER_MINIMO } from './regrasLoot'
import type { SlotEquipamento, TipoDano, TipoItem } from '../lib/tipos'
import {
  APELIDO_BIOMA,
  ARTE_DIAMANTE,
  ARTE_INIMIGO,
  ARTE_INIMIGO_DANO,
  ARTE_POSE,
  ARTE_SKIN,
  ARTE_SLOT_VAZIO,
  arteDaSkin,
  arteDoCenario,
  arteDoDanoDoInimigo,
  arteDoHeroi,
  arteDoInimigo,
  arteDoItem,
  arteDoProp,
  imagem,
  urlDaArte,
} from './atlas'
import { BIOMAS, TOTAL_BIOMAS } from './biomas'
import { POOL_INIMIGOS } from './mundo'

// O teste que dá sentido ao atlas.
//
// Um caminho de arte errado não quebra nada em tempo de compilação: o TypeScript
// vê uma string válida, o build passa, e o jogador é quem descobre o buraco.
// Estas verificações são o que transforma "renomearam um PNG" num build
// reprovado em vez de um ícone ausente em produção.

/** Traduz um caminho do atlas para o arquivo correspondente no disco. */
function noDisco(relativo: string): URL {
  return new URL(`../../public/${relativo}`, import.meta.url)
}

function esperarQueExista(relativo: string, contexto: string): void {
  expect(existsSync(noDisco(relativo)), `${contexto}: falta ${relativo}`).toBe(true)
}

const TIPOS: readonly TipoItem[] = [
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

/** Os únicos tipos sem arte no pacote entregue — dívida D16 do backlog. */
const SEM_ARTE: readonly TipoItem[] = ['pedra_fortificacao', 'pedra_sorte', 'pedra_garantia']

const SLOTS: readonly SlotEquipamento[] = [
  'arma',
  'capacete',
  'armadura',
  'luva',
  'bota',
  'acessorio',
  'skin',
]

describe('todo caminho do atlas existe no disco', () => {
  it('as 3 poses do personagem', () => {
    for (const [pose, caminho] of Object.entries(ARTE_POSE)) esperarQueExista(caminho, pose)
  })

  it('as 8 skins', () => {
    expect(ARTE_SKIN).toHaveLength(8)
    for (const caminho of ARTE_SKIN) esperarQueExista(caminho, 'skin')
  })

  it('os 5 inimigos base e as 5 silhuetas de dano', () => {
    for (const [forma, caminho] of Object.entries(ARTE_INIMIGO)) esperarQueExista(caminho, forma)
    for (const [forma, caminho] of Object.entries(ARTE_INIMIGO_DANO)) {
      esperarQueExista(caminho, `${forma} (dano)`)
    }
  })

  it('o cenário, o prop e o inimigo assinatura dos 8 biomas', () => {
    for (const bioma of BIOMAS) {
      esperarQueExista(arteDoCenario(bioma.token), `cenário do bioma ${bioma.id}`)
      esperarQueExista(arteDoProp(bioma.token), `prop do bioma ${bioma.id}`)
      esperarQueExista(arteDoInimigo(bioma.assinatura.forma), `assinatura do bioma ${bioma.id}`)
    }
  })

  it('os ícones de slot vazio e o diamante', () => {
    for (const slot of SLOTS) esperarQueExista(ARTE_SLOT_VAZIO[slot], `slot ${slot}`)
    esperarQueExista(ARTE_DIAMANTE, 'diamante')
  })

  it('todo item que o jogo pode conceder — tipo × raridade × tipo de dano', () => {
    // Exaustivo de propósito. É a combinação que o servidor pode devolver, e
    // basta um sufixo de arquivo fora da faixa para um tier inteiro sumir.
    const danos: readonly (TipoDano | null)[] = ['fisico', 'magico', null]

    for (const tipo of TIPOS) {
      for (let raridade = TIER_MINIMO; raridade <= TIER_MAXIMO; raridade++) {
        for (const dano of danos) {
          // Vários ids: o id escolhe a família, então um só exercitaria uma.
          for (const id of ['', 'a', 'b', 'c', 'd', 'e', 'f', '00000000-0000-4000-8000-000000000001']) {
            const caminho = arteDoItem(tipo, raridade, id, dano)
            if (SEM_ARTE.includes(tipo)) {
              expect(caminho, `${tipo} não deveria ter arte`).toBeNull()
              continue
            }
            expect(caminho, `${tipo}/${raridade}`).not.toBeNull()
            esperarQueExista(caminho!, `${tipo} raridade ${raridade} (${dano}, id "${id}")`)
          }
        }
      }
    }
  })

  it('o sprite do herói em toda combinação de pose e skin', () => {
    for (const pose of ['parado', 'atacando', 'comemorando'] as const) {
      esperarQueExista(arteDoHeroi(pose, null), `herói ${pose} sem skin`)
      for (let raridade = TIER_MINIMO; raridade <= TIER_MAXIMO; raridade++) {
        esperarQueExista(arteDoHeroi(pose, raridade), `herói ${pose} skin ${raridade}`)
      }
    }
  })

  it('a marca referenciada pelo index.html', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    const referencias = [...html.matchAll(/href="\.\/(arte\/[^"]+)"/g)].map((m) => m[1]!)

    expect(referencias.length, 'o index.html deveria referenciar o ícone da marca').toBeGreaterThan(0)
    for (const relativo of referencias) esperarQueExista(relativo, 'index.html')
  })
})

describe('cobertura do mapeamento', () => {
  it('toda forma de inimigo do jogo tem sprite — base e assinatura', () => {
    // A união das duas listas é exatamente `FormaInimigo`. Se alguém acrescentar
    // um inimigo sem arte, é aqui que aparece.
    const formas = [...POOL_INIMIGOS.map((e) => e.forma), ...BIOMAS.map((b) => b.assinatura.forma)]
    expect(formas).toHaveLength(13)

    for (const forma of formas) {
      expect(arteDoInimigo(forma), `forma ${forma}`).toBeTruthy()
      esperarQueExista(arteDoInimigo(forma), `forma ${forma}`)
    }
  })

  it('só os 5 do pool base têm silhueta desenhada à mão', () => {
    // Os 8 assinatura não vieram com `-sil` no pacote; `sprites.ts` gera a
    // silhueta deles. Este teste existe para essa assimetria ser deliberada, e
    // não uma descoberta no meio de um bug de lampejo de dano.
    for (const especie of POOL_INIMIGOS) {
      expect(arteDoDanoDoInimigo(especie.forma), especie.forma).not.toBeNull()
    }
    for (const bioma of BIOMAS) {
      expect(arteDoDanoDoInimigo(bioma.assinatura.forma), `bioma ${bioma.id}`).toBeNull()
    }
  })

  it('há um apelido de arquivo para cada um dos 8 biomas', () => {
    expect(APELIDO_BIOMA).toHaveLength(TOTAL_BIOMAS)
    expect(new Set(APELIDO_BIOMA).size, 'apelido repetido faria dois biomas dividirem o cenário').toBe(
      TOTAL_BIOMAS,
    )
  })

  it('a raridade da skin sobe sem pular e sem voltar', () => {
    const vistos = new Set<string>()
    let anterior = -1

    for (let raridade = TIER_MINIMO; raridade <= TIER_MAXIMO; raridade++) {
      const caminho = arteDaSkin(raridade)
      const indice = ARTE_SKIN.indexOf(caminho)
      expect(indice, `raridade ${raridade} caiu fora da lista`).toBeGreaterThanOrEqual(0)
      expect(indice, `raridade ${raridade} regrediu`).toBeGreaterThanOrEqual(anterior)
      anterior = indice
      vistos.add(caminho)
    }

    // Nenhuma das 8 pode ficar inalcançável — seria arte paga que ninguém vê.
    expect(vistos.size, 'skin inalcançável').toBe(ARTE_SKIN.length)
    expect(arteDaSkin(TIER_MINIMO)).toBe(ARTE_SKIN[0])
    expect(arteDaSkin(TIER_MAXIMO)).toBe(ARTE_SKIN[ARTE_SKIN.length - 1])
  })

  it('raridade fora da faixa não quebra — satura nas pontas', () => {
    // O valor vem do servidor; um tier inesperado não pode virar 404 de ícone.
    for (const invalido of [0, -3, 11, 999, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(ARTE_SKIN).toContain(arteDaSkin(invalido))
      esperarQueExista(arteDoItem('arma', invalido)!, `arma raridade ${invalido}`)
    }
    expect(arteDaSkin(0)).toBe(arteDaSkin(TIER_MINIMO))
    expect(arteDaSkin(99)).toBe(arteDaSkin(TIER_MAXIMO))
  })

  it('bioma fora da faixa cai num cenário que existe', () => {
    for (const invalido of [0, -1, 9, 99, Number.NaN]) {
      esperarQueExista(arteDoCenario(invalido), `cenário do bioma ${invalido}`)
      esperarQueExista(arteDoProp(invalido), `prop do bioma ${invalido}`)
    }
  })
})

describe('regras de desenho do ícone de item', () => {
  it('o mesmo item mostra sempre o mesmo ícone', () => {
    // A família sai de um hash do id. Se não fosse estável, o ícone mudaria
    // quando a lista reordenasse — e o jogador acharia que trocou de item.
    const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
    const primeiro = arteDoItem('arma', 5, id, 'fisico')
    for (let i = 0; i < 50; i++) expect(arteDoItem('arma', 5, id, 'fisico')).toBe(primeiro)
  })

  it('arma mágica nunca usa desenho de arma física', () => {
    // O ícone precisa denunciar o tipo de dano antes do tooltip.
    const MAGICAS = ['cajado', 'varinha']
    const FISICAS = ['espada', 'adaga', 'arco', 'martelo']

    for (let i = 0; i < 200; i++) {
      const id = `item-${i}`
      const magica = arteDoItem('arma', 5, id, 'magico')!
      const fisica = arteDoItem('arma', 5, id, 'fisico')!
      expect(MAGICAS.some((f) => magica.includes(`w-${f}-`)), magica).toBe(true)
      expect(FISICAS.some((f) => fisica.includes(`w-${f}-`)), fisica).toBe(true)
    }
  })

  it('ids diferentes chegam a usar famílias diferentes', () => {
    // Sem isto o hash poderia estar quebrado (sempre a mesma família) e os
    // testes acima continuariam passando.
    const familias = new Set<string>()
    for (let i = 0; i < 200; i++) familias.add(arteDoItem('acessorio', 3, `id-${i}`)!)
    expect(familias.size, 'o hash do id não está variando').toBeGreaterThan(1)
  })

  it('a raridade escolhe o sufixo do arquivo, de 0 a 9', () => {
    for (let raridade = TIER_MINIMO; raridade <= TIER_MAXIMO; raridade++) {
      expect(arteDoItem('arma', raridade, 'x', 'fisico')).toMatch(
        new RegExp(`-${raridade - 1}\\.png$`),
      )
    }
    expect(RARIDADES).toHaveLength(TIER_MAXIMO)
  })
})

describe('o carregador nunca é pré-requisito para jogar', () => {
  it('sem DOM, a imagem é sempre nula em vez de estourar', () => {
    // É o contrato que sustenta o Princípio nº1: quem desenha recebe `null` e
    // cai na silhueta geométrica, em vez de o jogo abrir em branco. Os testes
    // rodam em ambiente `node`, que é exatamente esse cenário.
    expect(typeof Image).toBe('undefined')
    expect(imagem(ARTE_POSE.parado)).toBeNull()
    expect(imagem('arte/nao-existe.png')).toBeNull()
  })

  it('a URL sai do BASE_URL, com exatamente uma barra de junção', () => {
    // Sob o vitest o BASE_URL é `/`; no artefato publicado é `./`. O que este
    // teste garante é a composição — nem barra dobrada, nem barra faltando.
    const url = urlDaArte('arte/marca/ic-32.png')
    expect(url.endsWith('arte/marca/ic-32.png')).toBe(true)
    expect(url).not.toMatch(/\/\/arte/)
  })

  it('o artefato publicado usa caminho relativo — senão o portal abre em branco', () => {
    // Esta é a garantia de verdade, e ela não vive no atlas: vive na config. Os
    // portais servem o jogo de um subdiretório (e a CrazyGames recebe um zip),
    // então uma `base` absoluta faria os assets serem buscados na raiz do
    // domínio deles. Ver `docs/01_ARQUITETURA/publicacao-portais.md`.
    const config = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8')
    expect(config).toMatch(/base:\s*'\.\/'/)
  })
})

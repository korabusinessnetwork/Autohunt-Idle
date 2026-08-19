import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ARMAS_DESTREZA, ARMAS_FISICAS, ARMAS_MAGICAS } from './armas'
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
  QUADROS_CENA,
  QUADROS_IDLE,
  QUADROS_LAMPEJO,
  QUADROS_MORTE,
  VARIANTES_LADRILHO,
  arteDaAnimacaoDoInimigo,
  arteDaAnimacaoDoProp,
  arteDaCenaAnimada,
  arteDaMorteDoInimigo,
  arteDoLampejoDoInimigo,
  arteDaSkin,
  arteDoCenario,
  arteDoDanoDoInimigo,
  arteDoHeroi,
  arteDoInimigo,
  arteDoItem,
  arteDoLadrilho,
  arteDoProp,
  imagem,
  ladrilhosDoBioma,
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

/**
 * Largura e altura de um PNG, lidas do cabeçalho IHDR.
 *
 * São 8 bytes de assinatura, 4 de tamanho de chunk e 4 do nome — e aí vem a
 * largura. Sem depender de biblioteca: o teste roda em `environment: 'node'`, e
 * a alternativa seria trazer um decodificador de imagem para conferir dois
 * números.
 */
function medirPng(relativo: string): { largura: number; altura: number } {
  const bytes = readFileSync(noDisco(relativo))
  return { largura: bytes.readUInt32BE(16), altura: bytes.readUInt32BE(20) }
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
    // Os três canais mais o `null`. Quando o canal de destreza nasceu, esta
    // lista era o que decidia se arco e adaga continuariam sendo conferidos
    // contra o disco — uma lista de dois teria passado verde sem vê-los.
    const danos: readonly (TipoDano | null)[] = ['fisico', 'destreza', 'magico', null]

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

describe('a arte animada dos dezesseis', () => {
  // O arco de 2026-08-19 chegou em seis pacotes e terminou com os DEZESSEIS
  // biomas no mesmo padrão: ladrilho de chão que emenda, e folhas de repouso,
  // dano, morte, prop e cena. A assimetria "só os oito industriais têm" que os
  // pacotes anteriores criaram acabou, e os testes abaixo são o que impede ela
  // de voltar em silêncio quando entrar o bioma 17.
  //
  // Tudo aqui é melhoria e nunca pré-requisito — mas quando o atlas DECLARA que
  // um arquivo existe, ele precisa existir, senão o jogo baixa 404 por quadro.

  const ASSINATURAS = BIOMAS.map((b) => b.assinatura.forma)
  const POOL = POOL_INIMIGOS.map((e) => e.forma)

  it('todo bioma tem as 4 variantes de ladrilho no disco, sem repetir', () => {
    for (const bioma of BIOMAS) {
      const ladrilhos = ladrilhosDoBioma(bioma.token)
      expect(ladrilhos, `bioma ${bioma.id}`).toHaveLength(VARIANTES_LADRILHO)
      expect(new Set(ladrilhos).size, `bioma ${bioma.id} repete variante`).toBe(VARIANTES_LADRILHO)
      for (const caminho of ladrilhos) esperarQueExista(caminho, `ladrilho do bioma ${bioma.id}`)
    }
  })

  it('a variante do ladrilho satura em vez de virar 404', () => {
    // O número vem de um hash sobre a célula. Um valor fora da faixa não pode
    // apagar o chão da tela inteira — e "fora da faixa" inclui NaN.
    const bioma = BIOMAS[0]!.token
    for (const invalido of [0, -3, 99, Number.NaN, Number.POSITIVE_INFINITY]) {
      const caminho = arteDoLadrilho(bioma, invalido)
      expect(caminho, `variante ${invalido}`).toBeTruthy()
      esperarQueExista(caminho, `variante ${invalido}`)
    }
  })

  it('o ladrilho é quadrado e do tamanho nativo que o piso assume', () => {
    // O piso assume 64×64 no arquivo e redesenha em 48 de mundo — 6 de mundo
    // para cada um dos 8×8 pixels de desenho, inteiro, sem reamostragem. Um PNG
    // de outro tamanho quebraria essa conta e borraria o chão em silêncio.
    for (const bioma of BIOMAS) {
      for (const caminho of ladrilhosDoBioma(bioma.token)) {
        const { largura, altura } = medirPng(caminho)
        expect(largura, caminho).toBe(64)
        expect(altura, caminho).toBe(64)
      }
    }
  })

  it('as 21 formas respiram, e as 21 caem', () => {
    // Repouso e morte cobrem TODO bicho que o jogo desenha: 16 assinatura mais
    // os 5 do pool base. É o que faz `desenharInimigo` entrar pelo caminho
    // animado sempre, e nunca mais cair no PNG parado por falta de arte.
    for (const forma of [...ASSINATURAS, ...POOL]) {
      const repouso = arteDaAnimacaoDoInimigo(forma)
      const morte = arteDaMorteDoInimigo(forma)
      expect(repouso, forma).toBeTruthy()
      expect(morte, forma).toBeTruthy()
      esperarQueExista(repouso!, `repouso de ${forma}`)
      esperarQueExista(morte!, `morte de ${forma}`)
    }
  })

  it('a folha de dano é o que separa assinatura de pool base', () => {
    // A ÚNICA assimetria que sobrou do arco, e ela é deliberada: o pool base
    // levou repouso e morte mas não `-hit`, porque o lampejo dele já existia
    // desenhado à mão como `-sil` desde a leva anterior.
    //
    // `sprites.ts` NÃO usa esse `-sil` no caminho animado — o `-sil` casa com a
    // pose do PNG parado, que é o quadro 1 do repouso, e estouraria a pose nos
    // outros três. Lá ele gera a silhueta do quadro corrente. O `-sil` segue
    // valendo no caminho do PNG parado, que é onde o bicho fica enquanto a
    // folha não decodifica.
    for (const forma of ASSINATURAS) {
      const dano = arteDoLampejoDoInimigo(forma)
      expect(dano, forma).toBeTruthy()
      esperarQueExista(dano!, `dano de ${forma}`)
    }
    for (const forma of POOL) {
      expect(arteDoLampejoDoInimigo(forma), forma).toBeNull()
      expect(arteDoDanoDoInimigo(forma), `${forma} perdeu o -sil`).toBeTruthy()
    }
  })

  it('todo bioma tem prop animado e cena animada no disco', () => {
    for (const bioma of BIOMAS) {
      esperarQueExista(arteDaAnimacaoDoProp(bioma.token), `prop animado do bioma ${bioma.id}`)
      esperarQueExista(arteDaCenaAnimada(bioma.token), `cena do bioma ${bioma.id}`)
    }
  })

  it('cada família de folha tem a largura que a SUA contagem de quadros exige', () => {
    // O recorte é `largura / quadros`. Uma folha com número de quadros diferente
    // do declarado não quebra nada visível de imediato: ela desenha um pedaço
    // deslocado, para sempre. É o defeito mais caro de enxergar do lote, então
    // mede-se o PNG.
    //
    // E as famílias NÃO compartilham a contagem: dano tem DOIS quadros e as
    // outras têm quatro. Conferir todas contra 4 deixaria passar exatamente o
    // caso que o dano introduziu.
    const familias = [
      {
        nome: 'repouso',
        quadros: QUADROS_IDLE,
        folhas: [...ASSINATURAS, ...POOL].map((f) => arteDaAnimacaoDoInimigo(f)!),
        total: 21,
      },
      {
        nome: 'morte',
        quadros: QUADROS_MORTE,
        folhas: [...ASSINATURAS, ...POOL].map((f) => arteDaMorteDoInimigo(f)!),
        total: 21,
      },
      {
        nome: 'dano',
        quadros: QUADROS_LAMPEJO,
        folhas: ASSINATURAS.map((f) => arteDoLampejoDoInimigo(f)!),
        total: 16,
      },
      {
        nome: 'prop',
        quadros: QUADROS_IDLE,
        folhas: BIOMAS.map((b) => arteDaAnimacaoDoProp(b.token)),
        total: 16,
      },
      {
        nome: 'cena',
        quadros: QUADROS_CENA,
        folhas: BIOMAS.map((b) => arteDaCenaAnimada(b.token)),
        total: 16,
      },
    ]

    for (const familia of familias) {
      expect(familia.folhas, familia.nome).toHaveLength(familia.total)
      for (const folha of familia.folhas) {
        esperarQueExista(folha, `folha de ${familia.nome}`)
        const { largura, altura } = medirPng(folha)
        expect(
          largura % familia.quadros,
          `${folha}: ${largura}px não divide por ${familia.quadros}`,
        ).toBe(0)
        expect(altura, `${folha}: folha sem altura`).toBeGreaterThan(0)
      }
    }
  })

  it('todo quadro de folha cabe na caixa do PNG parado correspondente', () => {
    // Divisibilidade sozinha não prova contagem: uma folha de 8 quadros de 80px
    // divide por 4 tão bem quanto uma de 4 quadros de 160px, e as duas passam.
    // O que separa uma da outra é a CAIXA — e ela existe desenhada, no PNG
    // parado que veio antes da animação.
    //
    // Aqui houve um palpite antes: "quadro mais largo que alto é sinal de
    // contagem errada". Ele acusou `anim-geleia-prop.png` (144×72), que estava
    // certo — quatro dos props doces são baixos e largos de propósito, poça de
    // geleia e boca de vulcão não têm por que ser altos. Proxy trocado pela
    // medida: comparar com o parado não tem falso positivo nenhum.
    for (const forma of [...ASSINATURAS, ...POOL]) {
      const parado = medirPng(arteDoInimigo(forma))
      for (const [familia, folha, quadros] of [
        ['repouso', arteDaAnimacaoDoInimigo(forma), QUADROS_IDLE],
        ['dano', arteDoLampejoDoInimigo(forma), QUADROS_LAMPEJO],
        ['morte', arteDaMorteDoInimigo(forma), QUADROS_MORTE],
      ] as const) {
        if (!folha) continue
        const { largura, altura } = medirPng(folha)
        expect(largura / quadros, `${familia} de ${forma}`).toBe(parado.largura)
        expect(altura, `${familia} de ${forma}`).toBe(parado.altura)
      }
    }
  })

  it('a cena animada tem o enquadramento do cenário parado', () => {
    // O painel de mapa desenha a cena por cima do degradê do bioma, no mesmo
    // quadro. Enquadramento diferente do cenário faria a tira de miniaturas
    // mudar de proporção no meio, entre um item e o seguinte.
    for (const bioma of BIOMAS) {
      const parado = medirPng(arteDoCenario(bioma.token))
      const animada = medirPng(arteDaCenaAnimada(bioma.token))
      expect(animada.largura / QUADROS_CENA, `bioma ${bioma.id}`).toBe(parado.largura)
      expect(animada.altura, `bioma ${bioma.id}`).toBe(parado.altura)
    }
  })

  it('o prop animado tem o enquadramento do prop parado', () => {
    // Os props doces não têm largura fixa: cada bioma trouxe a sua. O recorte da
    // folha é `largura / 4`, então uma folha montada na medida da fábrica
    // desenharia o prop deslocado em todo bioma cuja medida é outra.
    for (const bioma of BIOMAS) {
      const parado = medirPng(arteDoProp(bioma.token))
      const animado = medirPng(arteDaAnimacaoDoProp(bioma.token))
      expect(animado.largura / QUADROS_IDLE, `bioma ${bioma.id}`).toBe(parado.largura)
      expect(animado.altura, `bioma ${bioma.id}`).toBe(parado.altura)
    }
  })
})

describe('cobertura do mapeamento', () => {
  it('toda forma de inimigo do jogo tem sprite — base e assinatura', () => {
    // A união das duas listas é exatamente `FormaInimigo`. Se alguém acrescentar
    // um inimigo sem arte, é aqui que aparece.
    const formas = [...POOL_INIMIGOS.map((e) => e.forma), ...BIOMAS.map((b) => b.assinatura.forma)]
    // 5 do pool base + 1 assinatura por bioma. Escrito à mão porque derivar de
    // `BIOMAS.length` faria o teste concordar com um catálogo pela metade.
    expect(formas).toHaveLength(21)

    for (const forma of formas) {
      expect(arteDoInimigo(forma), `forma ${forma}`).toBeTruthy()
      esperarQueExista(arteDoInimigo(forma), `forma ${forma}`)
    }
  })

  it('só os 5 do pool base têm silhueta desenhada à mão', () => {
    // Nenhum dos 16 assinatura veio com `-sil` no pacote; `sprites.ts` gera a
    // silhueta deles. Este teste existe para essa assimetria ser deliberada, e
    // não uma descoberta no meio de um bug de lampejo de dano.
    for (const especie of POOL_INIMIGOS) {
      expect(arteDoDanoDoInimigo(especie.forma), especie.forma).not.toBeNull()
    }
    for (const bioma of BIOMAS) {
      expect(arteDoDanoDoInimigo(bioma.assinatura.forma), `bioma ${bioma.id}`).toBeNull()
    }
  })

  it('há um apelido de arquivo para cada bioma, e nenhum repetido', () => {
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

  it('o ícone denuncia o canal de dano — nenhum canal usa desenho de outro', () => {
    // O ícone precisa denunciar o tipo de dano antes do tooltip.
    //
    // As listas vêm IMPORTADAS de `armas.ts`, nunca copiadas: enquanto estavam
    // escritas à mão aqui, mover arco e adaga para o canal de destreza deixava
    // duas cópias divergentes — a de produção certa, a do teste velha — e o
    // teste continuava verde provando a regra antiga.
    const POR_CANAL: Record<TipoDano, readonly string[]> = {
      fisico: ARMAS_FISICAS,
      destreza: ARMAS_DESTREZA,
      magico: ARMAS_MAGICAS,
    }

    for (let i = 0; i < 200; i++) {
      const id = `item-${i}`
      for (const [canal, familias] of Object.entries(POR_CANAL) as [TipoDano, string[]][]) {
        const caminho = arteDoItem('arma', 5, id, canal)!
        expect(familias.some((f) => caminho.includes(`w-${f}-`)), `${canal}: ${caminho}`).toBe(true)

        // E o que o teste antigo não dizia: o desenho de um canal nunca aparece
        // em outro. Sem isto, listas que se sobrepusessem passariam.
        for (const [outro, deOutro] of Object.entries(POR_CANAL) as [TipoDano, string[]][]) {
          if (outro === canal) continue
          expect(deOutro.some((f) => caminho.includes(`w-${f}-`)), `${canal} vestiu ${outro}`).toBe(
            false,
          )
        }
      }
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

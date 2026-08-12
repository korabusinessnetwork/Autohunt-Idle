import { readFileSync, readdirSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  AJUSTES_PADRAO,
  ajusteVisual,
  ajustesVisuaisAtuais,
  aplicarAjustesVisuais,
  redefinirAjustesVisuais,
} from './ajustes'

// Os ajustes visuais são o único pedaço do console que chega ao navegador.
// O que estes testes protegem não é a matemática — é a fronteira: o que entra,
// o que é ignorado, e o que NUNCA aparece aqui.

const SQL = readdirSync(new URL('../../supabase/migrations/', import.meta.url))
  .filter((arquivo) => arquivo.endsWith('.sql'))
  .sort()
  .map((arquivo) =>
    readFileSync(new URL(`../../supabase/migrations/${arquivo}`, import.meta.url), 'utf8'),
  )
  .join('\n')

beforeEach(() => {
  redefinirAjustesVisuais()
})

describe('ajustes visuais', () => {
  it('sem snapshot, vale o padrão — que é o jogo de antes do console', () => {
    expect(ajusteVisual('heroi_velocidade')).toBe(110)
    expect(ajusteVisual('heroi_alcance_tiro')).toBe(210)
    expect(ajusteVisual('inimigos_na_tela')).toBe(8)
  })

  it('aplica o que veio do servidor', () => {
    aplicarAjustesVisuais({ heroi_velocidade: 260, inimigos_na_tela: 20 })
    expect(ajusteVisual('heroi_velocidade')).toBe(260)
    expect(ajusteVisual('inimigos_na_tela')).toBe(20)
  })

  it('chave ausente volta ao padrão em vez de manter o valor antigo', () => {
    // Se a linha sumir da tabela, o jogo precisa voltar ao que era — e não
    // ficar preso no último valor que alguém digitou.
    aplicarAjustesVisuais({ heroi_velocidade: 260 })
    aplicarAjustesVisuais({ inimigos_na_tela: 12 })
    expect(ajusteVisual('heroi_velocidade')).toBe(AJUSTES_PADRAO.heroi_velocidade)
  })

  it('ignora chave desconhecida e valor que não é número', () => {
    aplicarAjustesVisuais({
      heroi_velocidade: Number.NaN,
      inimigos_na_tela: 'muitos',
      chave_que_nao_existe: 999,
    } as Record<string, unknown>)

    // Um NaN escapando para o loop trava o mundo em silêncio, que é pior do
    // que um mundo mal balanceado.
    expect(ajusteVisual('heroi_velocidade')).toBe(AJUSTES_PADRAO.heroi_velocidade)
    expect(ajusteVisual('inimigos_na_tela')).toBe(AJUSTES_PADRAO.inimigos_na_tela)
    expect(ajustesVisuaisAtuais()).not.toHaveProperty('chave_que_nao_existe')
  })

  it('snapshot nulo não derruba nada', () => {
    aplicarAjustesVisuais(null)
    expect(ajustesVisuaisAtuais()).toEqual(AJUSTES_PADRAO)
  })

  it('nenhum número que credita tem representação no client', () => {
    // A prova central do lado do navegador: as chaves econômicas do catálogo
    // não existem aqui. Não é que estejam protegidas — é que não chegam.
    for (const chave of [
      'xp_multiplicador_global',
      'moeda_multiplicador_global',
      'abates_base',
      'xp_por_abate_base',
      'moeda_por_abate_base',
      'dano_por_ciclo_base',
      'ataque_por_abate',
    ]) {
      expect(AJUSTES_PADRAO).not.toHaveProperty(chave)
    }
  })

  it('toda chave visual do servidor tem par aqui, e vice-versa', () => {
    // Sem isto, o servidor poderia publicar um ajuste que o client ignora em
    // silêncio — o dono mexeria no número e nada aconteceria na tela, sem
    // nenhum aviso de que o valor não chegou a lugar nenhum.
    const doServidor = [...SQL.matchAll(/\('(\w+)',[^)]*?'visual'/g)].map(([, chave]) => chave)

    expect(doServidor.length).toBeGreaterThan(0)
    expect([...doServidor].sort()).toEqual(Object.keys(AJUSTES_PADRAO).sort())
  })

  it('o padrão do client repete o valor semeado no servidor', () => {
    for (const [chave, esperado] of Object.entries(AJUSTES_PADRAO)) {
      const achado = new RegExp(`\\('${chave}',\\s*([0-9.]+),`).exec(SQL)
      expect(achado, `${chave} não é semeada no servidor`).not.toBeNull()
      expect(Number(achado![1]), `o padrão de ${chave} diverge do servidor`).toBe(esperado)
    }
  })
})

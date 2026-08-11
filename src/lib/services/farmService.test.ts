import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A prova central do produto: o client não tem como declarar quanto ganhou nem
// quanto tempo passou. Estes testes verificam isso pelo lado do client; o
// contrato do lado do servidor é verificado em `contratoRpc.test.ts`, que lê o
// SQL das migrations.

const chamadas: Array<{ nome: string; parametros: unknown }> = []

vi.mock('../supabaseClient', () => ({
  configuracaoCompleta: true,
  obterSupabase: () => ({
    rpc: (nome: string, parametros: unknown) => {
      chamadas.push({ nome, parametros })
      // O servidor devolve números prontos — repare que nada aqui depende do
      // que o client mandou, porque o client não mandou nada.
      return Promise.resolve({
        data: {
          existe: true,
          retorno: { minutosDecorridos: 90, minutosCreditados: 90, xpGanho: 5400 },
        },
        error: null,
      })
    },
  }),
}))

const { coletarFarmOffline, emitirTicketAnuncio, encerrarSessao, iniciarSessao, validarLote } =
  await import('./farmService')

const CAMPOS_PROIBIDOS = [
  'timestamp',
  'agora',
  'now',
  'tempo',
  'segundos',
  'minutos',
  'duracao',
  'xp',
  'moeda',
  'abates',
  'recompensa',
]

beforeEach(() => {
  chamadas.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('contrato das chamadas de farm', () => {
  it('não envia parâmetro nenhum nas RPCs de sessão e farm', async () => {
    await iniciarSessao()
    await validarLote()
    await encerrarSessao()
    await coletarFarmOffline()
    await emitirTicketAnuncio()

    expect(chamadas.map((c) => c.nome)).toEqual([
      'iniciar_sessao',
      'validar_lote',
      // `encerrar_sessao` é a mesma coisa que um último lote.
      'encerrar_sessao',
      'coletar_farm_offline',
      'emitir_ticket_anuncio',
    ])

    for (const chamada of chamadas) {
      expect(chamada.parametros).toEqual({})
    }
  })

  it('nenhum payload carrega campo de tempo ou de recompensa', async () => {
    await iniciarSessao()
    await validarLote()

    for (const chamada of chamadas) {
      const serializado = JSON.stringify(chamada.parametros).toLowerCase()
      for (const proibido of CAMPOS_PROIBIDOS) {
        expect(serializado).not.toContain(proibido)
      }
    }
  })

  it('adiantar o relógio do client não muda nada do que é enviado', async () => {
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-08-11T12:00:00Z'))
    await iniciarSessao()
    const comHoraReal = JSON.stringify(chamadas)

    chamadas.length = 0

    // Jogador adianta o relógio da máquina em 30 dias para forjar ausência.
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
    await iniciarSessao()
    const comHoraForjada = JSON.stringify(chamadas)

    // Byte a byte igual: não existe canal por onde a mentira passe.
    expect(comHoraForjada).toBe(comHoraReal)
  })

  it('devolve os números que vieram do servidor, sem recalcular', async () => {
    const resposta = await iniciarSessao()

    expect(resposta.data?.retorno?.minutosDecorridos).toBe(90)
    expect(resposta.data?.retorno?.xpGanho).toBe(5400)
    expect(resposta.error).toBeNull()
  })
})

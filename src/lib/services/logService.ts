// Camada de serviço — log operacional do console.
//
// Leitura só, e por RPC: o admin **não** tem grant de leitura em `evento_jogo`.
// A tabela aceita `jsonb` livre do client (dívida D10), então abrir a tabela
// inteira para o admin seria dar acesso a tudo o que qualquer jogador já
// registrou — inclusive o que ainda nem foi inventado. Isso é vigilância, não
// auditoria.
//
// O servidor devolve a lista fechada de tipos junto com os eventos, e a tela
// mostra essa lista: log com recorte invisível engana mais do que log nenhum.

import { deErroSupabase, falha, ok, type Envelope } from '../envelope'
import { configuracaoCompleta, obterSupabase } from '../supabaseClient'

export interface EventoDoLog {
  id: number
  /** ISO 8601, do `now()` do Postgres — nunca do relógio do navegador. */
  em: string
  tipo: string
  jogador: string
  /** Nulo quando a pessoa nunca escolheu apelido — a maioria das contas. */
  apelido: string | null
  dados: Record<string, unknown>
}

export interface PaginaDoLog {
  permitido: boolean
  motivo?: string
  eventos: EventoDoLog[]
  /** A lista fechada do servidor. A tela publica para dizer o que NÃO mostra. */
  tipos: string[]
  limite: number
}

const PAGINA_VAZIA: PaginaDoLog = { permitido: false, eventos: [], tipos: [], limite: 0 }

/**
 * Uma página do rastro, da mais nova para a mais antiga.
 *
 * `antes` é cursor de tempo, não `offset`: o log só cresce pela ponta nova, e
 * um `offset` faria a página 2 repetir linha toda vez que um evento entrasse
 * no meio da leitura.
 */
export async function lerLogOperacional(opcoes?: {
  tipos?: string[]
  limite?: number
  antes?: string | null
}): Promise<Envelope<PaginaDoLog>> {
  if (!configuracaoCompleta) {
    return falha<PaginaDoLog>(
      'CONFIGURACAO_AUSENTE',
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes (ver .env.example).',
    )
  }

  const { data, error } = await obterSupabase().rpc('log_operacional', {
    p_tipos: opcoes?.tipos?.length ? opcoes.tipos : null,
    p_limite: opcoes?.limite ?? 50,
    p_antes: opcoes?.antes ?? null,
  })
  if (error) return deErroSupabase<PaginaDoLog>(error, 'LOG_NAO_CARREGOU')

  const bruto = (data ?? {}) as Partial<PaginaDoLog>
  return ok({
    ...PAGINA_VAZIA,
    ...bruto,
    eventos: bruto.eventos ?? [],
    tipos: bruto.tipos ?? [],
  })
}

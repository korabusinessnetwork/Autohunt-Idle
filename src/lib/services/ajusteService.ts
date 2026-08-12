// Camada de serviço — console de ajuste.
//
// Duas operações, e nada mais: listar o catálogo e gravar um número. O client
// NÃO decide quem pode; ele só pergunta e obedece à resposta.
//
// A leitura é um SELECT com colunas explícitas (`CLAUDE.md`: nunca `select *`).
// Quem filtra o que cada um enxerga é a RLS: um jogador comum recebe só as
// linhas de escopo `visual`; o admin recebe todas. Não existe caminho de
// escrita aqui — a tabela não tem grant de UPDATE para ninguém do lado do
// client, nem para o admin.

import { deErroSupabase, falha, ok, type Envelope } from '../envelope'
import { configuracaoCompleta, obterSupabase } from '../supabaseClient'

export interface LinhaAjuste {
  chave: string
  valor: number
  minimo: number
  maximo: number
  escopo: 'visual' | 'economico'
  categoria: 'heroi' | 'inimigo' | 'mundo' | 'economia'
  descricao: string
  atualizadoEm: string | null
}

export interface ResultadoAjuste {
  aplicado: boolean
  motivo?: string
  de?: number
  para?: number
  minimo?: number
  maximo?: number
}

/**
 * O console é a única tela alcançável por URL direta, então é a única que pode
 * ser aberta antes de o jogo conectar. Sem esta guarda, `obterSupabase()`
 * lançaria e a tela ficaria branca — que é justamente o que o Princípio nº 1
 * proíbe.
 */
function semConfiguracao<T>(): Envelope<T> {
  return falha<T>(
    'CONFIGURACAO_AUSENTE',
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes (ver .env.example).',
  )
}

/** O catálogo que a tela mostra. Vem do servidor com faixa e descrição junto. */
export async function listarAjustes(): Promise<Envelope<LinhaAjuste[]>> {
  if (!configuracaoCompleta) return semConfiguracao<LinhaAjuste[]>()

  const { data, error } = await obterSupabase()
    .from('ajuste')
    .select('chave, valor, minimo, maximo, escopo, categoria, descricao, atualizado_em')
    .order('categoria')
    .order('chave')

  if (error) return deErroSupabase<LinhaAjuste[]>(error, 'AJUSTES_NAO_CARREGARAM')

  const linhas = (data ?? []).map((linha) => ({
    chave: String(linha.chave),
    valor: Number(linha.valor),
    minimo: Number(linha.minimo),
    maximo: Number(linha.maximo),
    escopo: linha.escopo as LinhaAjuste['escopo'],
    categoria: linha.categoria as LinhaAjuste['categoria'],
    descricao: String(linha.descricao),
    atualizadoEm: linha.atualizado_em ?? null,
  }))
  return ok(linhas)
}

/**
 * Grava um número.
 *
 * A validação local é prevenção de erro, não segurança (princípio nº 1:
 * prevenir erro é melhor que avisar depois). Quem de fato recusa é a RPC, que
 * confere admin e faixa de novo — e registra a tentativa.
 */
export async function definirAjuste(
  chave: string,
  valor: number,
): Promise<Envelope<ResultadoAjuste>> {
  if (!configuracaoCompleta) return semConfiguracao<ResultadoAjuste>()
  if (!Number.isFinite(valor)) {
    return falha<ResultadoAjuste>('VALOR_INVALIDO', 'Valor precisa ser um número.')
  }

  const { data, error } = await obterSupabase().rpc('definir_ajuste', {
    p_chave: chave,
    p_valor: valor,
  })
  if (error) return deErroSupabase<ResultadoAjuste>(error, 'AJUSTE_FALHOU')
  return ok(data as ResultadoAjuste)
}

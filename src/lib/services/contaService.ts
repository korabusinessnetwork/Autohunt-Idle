// Camada de serviço — direitos do titular dos dados (LGPD).
//
// As duas RPCs não recebem parâmetro nenhum, e isso é a garantia, não uma
// economia de digitação: sem `player_id` na assinatura, não existe forma de
// exportar ou apagar a conta de outra pessoa. O servidor lê `auth.uid()`.
//
// Ver `docs/11_SEGURANCA/dados-pessoais-lgpd.md`.

import { deErroSupabase, ok, type Envelope } from '../envelope'
import { obterSupabase } from '../supabaseClient'

/**
 * Todo dado que o jogo guarda sobre o jogador, num JSON só.
 *
 * Leitura pura: não coleta o farm pendente, não credita nada e não muda
 * estado — exportar não pode ter efeito colateral no progresso.
 */
export async function exportarMeusDados(): Promise<Envelope<unknown>> {
  const { data, error } = await obterSupabase().rpc('exportar_meus_dados', {})
  if (error) return deErroSupabase<unknown>(error, 'EXPORTACAO_FALHOU')
  return ok(data)
}

/**
 * Apaga a conta e tudo que pende dela. Irreversível.
 *
 * Não existe "desativar": guardar o dado por precaução é exatamente o que a
 * LGPD não aceita. Quem chama isto está pedindo eliminação, não pausa.
 */
export async function excluirMinhaConta(): Promise<Envelope<{ excluida: boolean }>> {
  const { data, error } = await obterSupabase().rpc('excluir_minha_conta', {})
  if (error) return deErroSupabase<{ excluida: boolean }>(error, 'EXCLUSAO_FALHOU')
  return ok(data as { excluida: boolean })
}

/**
 * Entrega o JSON exportado como download.
 *
 * Fica aqui, e não no componente, porque é manipulação de dado — o componente
 * só decide quando chamar. O nome do arquivo não leva id nem e-mail: o
 * arquivo costuma ir parar em pasta compartilhada.
 */
export function baixarExportacao(dados: unknown): void {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'autohunt-meus-dados.json'
  link.click()
  URL.revokeObjectURL(url)
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { obterArmazenamento } from './armazenamento'

// Instância única do client Supabase — nenhum outro arquivo do projeto chama
// createClient() (`docs/01_ARQUITETURA/padroes.md`).
//
// Chaves vêm de `import.meta.env.VITE_*`, nunca hardcoded (CLAUDE.md). Só a
// chave `anon` (pública por natureza) entra no bundle: a `service_role` vive
// exclusivamente nas Edge Functions.

const url = import.meta.env.VITE_SUPABASE_URL
const chaveAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Falha explícita de configuração. Sem isso o jogo abriria com tela branca e
 * um erro incompreensível no console — e "tela branca" é justamente o que o
 * Princípio nº1 proíbe.
 */
export class ConfiguracaoAusenteError extends Error {
  readonly codigo = 'CONFIGURACAO_AUSENTE'
  constructor() {
    super('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidas (ver .env.example).')
  }
}

export const configuracaoCompleta = Boolean(url && chaveAnon)

let instancia: SupabaseClient | null = null

export function obterSupabase(): SupabaseClient {
  if (!configuracaoCompleta) throw new ConfiguracaoAusenteError()
  instancia ??= createClient(url as string, chaveAnon as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // A conta anônima precisa sobreviver ao fechar da aba: é ela que guarda
      // o progresso enquanto o jogador ainda não cadastrou e-mail (core, 17).
      storageKey: 'autohunt.sessao',
      // Em portal o jogo roda num iframe de outro domínio, e a Poki exige
      // funcionar em janela anônima — situações em que tocar em
      // `localStorage` pode lançar exceção. O armazenamento resiliente cai
      // para memória em vez de derrubar a autenticação.
      storage: obterArmazenamento(),
    },
  })
  return instancia
}

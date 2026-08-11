// Envelope de resposta obrigatório da camada de serviços
// (`docs/01_ARQUITETURA/padroes.md`).
//
// Toda função de serviço devolve `{ data, error, meta }` — nunca lança exceção
// silenciosa, nunca devolve objeto nu. Código de erro é string estável, para
// virar chave de tradução e não mudar entre versões.

export interface ErroServico {
  codigo: string
  mensagem: string
}

export interface Envelope<T> {
  data: T | null
  error: ErroServico | null
  meta: { timestamp: string; version: '1' }
}

function agora(): string {
  return new Date().toISOString()
}

export function ok<T>(data: T): Envelope<T> {
  return { data, error: null, meta: { timestamp: agora(), version: '1' } }
}

export function falha<T>(codigo: string, mensagem: string): Envelope<T> {
  return { data: null, error: { codigo, mensagem }, meta: { timestamp: agora(), version: '1' } }
}

/**
 * Normaliza o erro do Supabase para o envelope.
 *
 * O `message` do Postgres carrega o nome da exceção que a RPC levantou
 * (`IDADE_MINIMA_NAO_ATINGIDA`, `NAO_AUTENTICADO`…), e é ele que vira código
 * estável. Nada de dado sensível entra aqui — o corpo da requisição nunca é
 * anexado (CLAUDE.md: nunca logar dado sensível).
 */
export function deErroSupabase<T>(
  erro: { message?: string; code?: string } | null,
  codigoPadrao: string,
): Envelope<T> {
  const bruto = erro?.message ?? ''
  const codigoConhecido = /^[A-Z_]{4,}$/.test(bruto.trim()) ? bruto.trim() : null
  return falha<T>(codigoConhecido ?? codigoPadrao, bruto || codigoPadrao)
}

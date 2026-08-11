// Verificação de assinatura HMAC-SHA256 compartilhada pelos callbacks externos.
//
// Por que HMAC e não "confia no corpo da requisição": o callback de anúncio e o
// webhook de assinatura são as duas únicas portas por onde entra valor
// econômico sem um usuário autenticado do outro lado. Sem prova de origem, a
// URL pública viraria um botão de "me dá 15 minutos" para qualquer um.

/** Compara duas strings em tempo constante (evita vazar o segredo por timing). */
function comparaEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferenca = 0
  for (let i = 0; i < a.length; i++) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diferenca === 0
}

function paraHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Assina um corpo cru com o segredo compartilhado. Formato: hex minúsculo. */
export async function assinarCorpo(corpo: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return paraHex(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)))
}

/**
 * Confere a assinatura recebida contra o corpo cru.
 * Assinatura ausente, malformada ou divergente reprova — nunca há caminho
 * "sem assinatura, deixa passar".
 */
export async function assinaturaValida(
  corpo: string,
  assinaturaRecebida: string | null,
  segredo: string,
): Promise<boolean> {
  if (!assinaturaRecebida || !segredo) return false
  const esperada = await assinarCorpo(corpo, segredo)
  return comparaEmTempoConstante(esperada, assinaturaRecebida.trim().toLowerCase())
}

export function respostaJson(corpo: unknown, status: number): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

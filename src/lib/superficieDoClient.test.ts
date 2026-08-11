import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Auditoria da superfície do CLIENT.
//
// `contratoRpc.test.ts` audita o SQL; este arquivo audita o que vai parar no
// navegador do jogador. Tudo em `src/` é público na prática: o bundle é
// baixado, e o mapa de fonte costuma ir junto.
//
// Cobre as ameaças 9.1 e 9.5 de `docs/11_SEGURANCA/modelo-de-ameacas.md`.

/**
 * Remove linhas de comentário.
 *
 * Necessário porque os comentários do projeto EXPLICAM as regras — e citam
 * `service_role` justamente para dizer que ela não está ali. Auditar o texto
 * cru acusaria a explicação em vez do problema. O que importa é o que o
 * navegador executa.
 *
 * Descarta a linha inteira quando ela é comentário (`//`, `/*`, `*`), em vez
 * de recortar no meio: recortar quebraria `'https://…'` dentro de string.
 */
function semComentarios(codigo: string): string {
  return codigo
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\/\*|\*)/.test(linha))
    .join('\n')
}

function arquivosDeCodigo(pasta: URL): Array<{ caminho: string; conteudo: string }> {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = new URL(`${entrada.name}${entrada.isDirectory() ? '/' : ''}`, pasta)
    if (entrada.isDirectory()) return arquivosDeCodigo(caminho)
    if (!/\.tsx?$/.test(entrada.name)) return []
    return [
      { caminho: caminho.pathname, conteudo: semComentarios(readFileSync(caminho, 'utf8')) },
    ]
  })
}

const CODIGO = arquivosDeCodigo(new URL('../', import.meta.url))
const PRODUCAO = CODIGO.filter(({ caminho }) => !caminho.includes('.test.'))

describe('nada sensível entra no bundle', () => {
  it('encontrou os arquivos de código', () => {
    // Se a varredura devolver vazio por um erro de caminho, todos os testes
    // abaixo passariam sem verificar nada.
    expect(PRODUCAO.length).toBeGreaterThan(20)
  })

  it('a service_role nunca é referenciada no client', () => {
    // Ela ignora RLS e alcança todas as contas. Vive só em `supabase secrets`,
    // do lado das Edge Functions.
    for (const { caminho, conteudo } of PRODUCAO) {
      expect(conteudo, caminho).not.toMatch(/service_?role/i)
    }
  })

  it('nenhuma chave ou URL de API é hardcoded', () => {
    // `CLAUDE.md`: tudo por `import.meta.env.VITE_*`. Um literal de URL do
    // Supabase ou um JWT no código é chave commitada, mesmo que "só de teste".
    for (const { caminho, conteudo } of PRODUCAO) {
      expect(conteudo, `${caminho}: URL de projeto Supabase literal`).not.toMatch(
        /https:\/\/[a-z0-9]+\.supabase\.co/i,
      )
      // Um JWT tem três blocos base64 separados por ponto e começa com `eyJ`.
      expect(conteudo, `${caminho}: parece um JWT literal`).not.toMatch(/\beyJ[\w-]{10,}\./)
    }
  })

  it('não existe console.* no código de produção', () => {
    // Log do client é visível para o jogador e some no ruído. Onde precisa
    // haver registro, ele vai para `evento_jogo`, que é auditável.
    for (const { caminho, conteudo } of PRODUCAO) {
      expect(conteudo, caminho).not.toMatch(/\bconsole\.\w+\(/)
    }
  })

  it('só o client central chama createClient', () => {
    // Uma segunda instância teria armazenamento próprio e a sessão do jogador
    // se partiria em duas — e nenhuma delas passaria pelo armazenamento
    // resiliente que o portal exige.
    const chamam = PRODUCAO.filter(({ conteudo }) => /\bcreateClient\s*\(/.test(conteudo))
    expect(chamam.map(({ caminho }) => caminho.split('/').pop())).toEqual(['supabaseClient.ts'])
  })
})

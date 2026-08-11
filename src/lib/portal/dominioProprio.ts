import type { Portal } from './tipos'

// Canal padrão: o jogo servido do nosso próprio domínio (Vercel, Cloudflare
// Pages, o que for). Sem SDK de portal, sem anúncio, e sem a proibição de
// compra que os portais impõem.
//
// É o padrão de propósito: nenhum SDK de terceiro carrega sem alguém escrever
// `VITE_CANAL` explicitamente.

export function criarPortalDominioProprio(): Portal {
  return {
    canal: 'dominio-proprio',
    permiteCompraNoJogo: true,
    provedorAnuncio: null,
    aoCarregarProgresso() {
      /* sem portal para avisar */
    },
    aoIniciarJogo() {
      /* sem portal para avisar */
    },
    aoPausarJogo() {
      /* sem portal para avisar */
    },
  }
}

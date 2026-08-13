// Os ícones da HUD — SVG inline, desenhados aqui.
//
// Por que inline e não arquivo: `specs/mapas-instanciados-combate-e-hud.md` (6)
// pede botão de mochila e afins DENTRO da tela do jogo. Um PNG por botão seria
// mais uma dúzia de arquivos no orçamento de portal (que é apertado — 8 MB de
// download inicial na Poki) e mais uma dúzia de linhas no `atlas.ts` para
// alguém esquecer de atualizar.
//
// Inline resolve os dois: entra no bundle já minificado, herda a cor do botão
// via `currentColor` (então acompanha estado ativo, desabilitado e a paleta) e
// nunca aparece quebrado por 404.
//
// NENHUM HEX AQUI. `currentColor` é a regra — a cor vem do CSS, que vem dos
// tokens, que são a fonte única da paleta.

export type NomeDoIcone =
  | 'mapa'
  | 'mochila'
  | 'equipamento'
  | 'atributos'
  | 'loja'
  | 'passe'
  | 'ranking'
  | 'config'
  | 'conta'
  | 'offline'
  | 'auto'

/**
 * Os traços de cada ícone.
 *
 * Grade de 24×24, traço de 2, cantos redondos: é o vocabulário mais legível a
 * 22px, que é o tamanho em que estes ícones vivem no celular. Formas simples de
 * propósito — ícone detalhado vira mancha nesse tamanho.
 */
const TRACOS: Record<NomeDoIcone, string> = {
  // Mapa dobrado em três painéis.
  mapa: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
  // Mochila com alça.
  mochila: 'M6 9a6 6 0 0 1 12 0v11H6z M9 9V6a3 3 0 0 1 6 0v3 M9 14h6',
  // Escudo — a peça de corpo que melhor lê como "equipamento".
  equipamento: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  // Seta para cima num degrau: pontos de atributo.
  atributos: 'M12 20V5 M6 11l6-6 6 6 M5 20h14',
  // Sacola de compras.
  loja: 'M5 8h14l-1.2 12H6.2z M9 8V6a3 3 0 0 1 6 0v2',
  // Bilhete com o picote no meio.
  passe: 'M3 8h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z M12 8v2 M12 14v2',
  // Troféu.
  ranking: 'M8 4h8v5a4 4 0 0 1-8 0z M8 5H5v2a3 3 0 0 0 3 3 M16 5h3v2a3 3 0 0 1-3 3 M10 17h4 M12 13v4 M8 20h8',
  // Engrenagem simplificada: círculo mais quatro dentes.
  config: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2',
  // Silhueta de pessoa.
  conta: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21c0-4 3.6-6 8-6s8 2 8 6',
  // Lua — o farm com o jogo fechado.
  offline: 'M20 14A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20 14z',
  // Play em círculo: o automático.
  auto: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M10 8.5l6 3.5-6 3.5z',
}

interface Props {
  nome: NomeDoIcone
  /** Lado do ícone em pixels. */
  tamanho?: number
}

export function Icone({ nome, tamanho = 22 }: Props) {
  return (
    <svg
      className="icone"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorativo: todo botão que usa este ícone já tem rótulo de texto ou
      // `aria-label`. Um `title` aqui faria o leitor de tela ler duas vezes.
      aria-hidden="true"
      focusable="false"
    >
      <path d={TRACOS[nome]} />
    </svg>
  )
}

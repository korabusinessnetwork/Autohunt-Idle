import { criarPortalCrazyGames } from './crazygames'
import { criarPortalDominioProprio } from './dominioProprio'
import { criarPortalPoki } from './poki'
import type { Canal, Portal } from './tipos'

export type { Canal, DesfechoAnuncio, Portal, ProvedorAnuncio } from './tipos'

const FABRICAS: Record<Canal, () => Portal> = {
  'dominio-proprio': criarPortalDominioProprio,
  crazygames: criarPortalCrazyGames,
  poki: criarPortalPoki,
}

export function ehCanalSuportado(valor: string): valor is Canal {
  return valor in FABRICAS
}

/**
 * Resolve o canal a partir do valor configurado.
 *
 * Valor ausente ou desconhecido cai em `dominio-proprio` — o canal que não
 * carrega SDK de terceiro nenhum. Errar para o lado de "não integra com
 * ninguém" é o padrão seguro: um typo em `VITE_CANAL` não pode fazer o jogo
 * tentar falar com um portal que não está lá.
 */
export function resolverCanal(valor: string | undefined): Canal {
  return valor && ehCanalSuportado(valor) ? valor : 'dominio-proprio'
}

let instancia: Portal | null = null

export function obterPortal(): Portal {
  instancia ??= FABRICAS[resolverCanal(import.meta.env.VITE_CANAL)]()
  return instancia
}

let jogoAtivo = false

/**
 * Avisa o portal que o jogador começou ou parou de jogar de fato.
 *
 * Só dispara na transição: a Poki tem regra específica sobre quando
 * `gameplayStart`/`gameplayStop` podem sair, e mandar o mesmo evento repetido
 * a cada render é exatamente o tipo de coisa que reprova na revisão deles.
 */
export function sinalizarJogo(ativo: boolean): void {
  if (ativo === jogoAtivo) return
  jogoAtivo = ativo

  const portal = obterPortal()
  if (ativo) portal.aoIniciarJogo()
  else portal.aoPausarJogo()
}

export function sinalizarCarregamento(fracao: number): void {
  obterPortal().aoCarregarProgresso(fracao)
}

/** Só para teste: descarta o portal memorizado e o estado de ciclo de vida. */
export function reiniciarPortal(): void {
  instancia = null
  jogoAtivo = false
}

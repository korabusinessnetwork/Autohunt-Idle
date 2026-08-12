// Ajustes VISUAIS do mundo — os números que o dono edita no console.
//
// O QUE ESTE ARQUIVO É: um espelho mutável do escopo `visual` da tabela
// `ajuste`. O servidor publica esses valores no snapshot, e a camada de jogo os
// lê a cada quadro em vez de carregar constante fixa.
//
// O QUE ELE NÃO É, e a distinção é a que sustenta o produto inteiro: **nada
// aqui credita**. Velocidade, alcance, dano de projétil e densidade de spawn
// mudam o que aparece na tela, e só. Os números que decidem XP e ouro
// (`xp_por_abate_base`, `dano_por_ciclo_base`, os multiplicadores globais) têm
// escopo `economico` e nunca saem do servidor — não existem neste arquivo, e
// `montar_ajustes_visuais` não os publica.
//
// Consequência prática: um jogador que abra o console do navegador e reescreva
// `atuais.heroi_velocidade` para 4000 vai correr rápido na tela dele e ganhar
// exatamente o mesmo que ganhava. É a mesma razão de `mundo.ts` inteiro poder
// ser adulterado sem consequência — o servidor olha tempo × poder, nunca o que
// aconteceu na tela.

/** As chaves do escopo `visual` da tabela `ajuste`, e nada além delas. */
export interface AjustesVisuais {
  heroi_velocidade: number
  heroi_alcance_tiro: number
  heroi_recarga_tiro: number
  heroi_dano_projetil: number
  projetil_velocidade: number
  inimigos_na_tela: number
  inimigo_vida: number
  inimigo_velocidade: number
  inimigo_tamanho: number
}

/**
 * O que vale antes de qualquer snapshot chegar — e o que continua valendo se a
 * linha sumir da tabela.
 *
 * São exatamente os valores que o jogo usava antes do console existir. Ligar o
 * console não mudou nada; é o dono que muda, quando quiser.
 */
export const AJUSTES_PADRAO: Readonly<AjustesVisuais> = {
  heroi_velocidade: 110,
  heroi_alcance_tiro: 210,
  heroi_recarga_tiro: 0.45,
  heroi_dano_projetil: 12,
  projetil_velocidade: 320,
  inimigos_na_tela: 8,
  inimigo_vida: 1,
  inimigo_velocidade: 1,
  inimigo_tamanho: 1,
}

let atuais: AjustesVisuais = { ...AJUSTES_PADRAO }

/** Lê um ajuste visual. É o que `mundo.ts` chama no lugar da antiga constante. */
export function ajusteVisual(chave: keyof AjustesVisuais): number {
  return atuais[chave]
}

/** Cópia do estado corrente — para diagnóstico e teste, nunca para escrever. */
export function ajustesVisuaisAtuais(): AjustesVisuais {
  return { ...atuais }
}

/**
 * Aplica o que veio no snapshot.
 *
 * Ignora chave desconhecida e valor que não seja número finito. Não é
 * desconfiança do servidor — é que um `NaN` escapando para o loop trava o
 * mundo em silêncio, e um mundo travado é pior que um mundo mal balanceado
 * (mesmo raciocínio do padrão embutido em `ajuste_num`, no SQL).
 */
export function aplicarAjustesVisuais(vindos: Partial<Record<string, unknown>> | null): void {
  if (!vindos) return

  const novos: AjustesVisuais = { ...AJUSTES_PADRAO }
  for (const chave of Object.keys(AJUSTES_PADRAO) as (keyof AjustesVisuais)[]) {
    const bruto = Number(vindos[chave])
    if (Number.isFinite(bruto)) novos[chave] = bruto
  }
  atuais = novos
}

/** Volta tudo ao padrão. Usado pelo sandbox e pelos testes. */
export function redefinirAjustesVisuais(): void {
  atuais = { ...AJUSTES_PADRAO }
}

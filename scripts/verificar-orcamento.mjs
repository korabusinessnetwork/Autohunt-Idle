// Orçamento de tamanho do artefato publicável.
//
// Roda depois do `vite build` e falha o build se estourar. O teto vem da Poki,
// que é o mais apertado dos dois portais: alvo de 8 MB de download inicial,
// contra 50 MB da CrazyGames (`docs/01_ARQUITETURA/publicacao-portais.md`).
// Verificar automaticamente é o que evita descobrir o problema na revisão do
// portal, semanas depois.

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TETO_INICIAL_BYTES = 8 * 1024 * 1024 // Poki
const TETO_TOTAL_BYTES = 250 * 1024 * 1024 // CrazyGames
const TETO_ARQUIVOS = 1500 // CrazyGames

/** Extensões que o navegador baixa para a primeira pintura. */
const EXTENSOES_INICIAIS = new Set(['.html', '.js', '.css'])

function listar(diretorio) {
  return readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(diretorio, entrada.name)
    return entrada.isDirectory() ? listar(caminho) : [caminho]
  })
}

function emMegabytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const destino = 'dist'

let arquivos
try {
  arquivos = listar(destino)
} catch {
  console.error(`✗ orçamento: '${destino}/' não existe — rode o build antes.`)
  process.exit(1)
}

let total = 0
let inicial = 0

for (const arquivo of arquivos) {
  const bytes = statSync(arquivo).size
  total += bytes
  const extensao = arquivo.slice(arquivo.lastIndexOf('.'))
  if (EXTENSOES_INICIAIS.has(extensao)) inicial += bytes
}

const falhas = []
if (inicial > TETO_INICIAL_BYTES) {
  falhas.push(`download inicial ${emMegabytes(inicial)} > ${emMegabytes(TETO_INICIAL_BYTES)} (Poki)`)
}
if (total > TETO_TOTAL_BYTES) {
  falhas.push(`total ${emMegabytes(total)} > ${emMegabytes(TETO_TOTAL_BYTES)} (CrazyGames)`)
}
if (arquivos.length > TETO_ARQUIVOS) {
  falhas.push(`${arquivos.length} arquivos > ${TETO_ARQUIVOS} (CrazyGames)`)
}

if (falhas.length > 0) {
  console.error('✗ orçamento de portal estourado:')
  for (const falha of falhas) console.error(`  · ${falha}`)
  process.exit(1)
}

console.log(
  `✓ orçamento de portal: inicial ${emMegabytes(inicial)} / ${emMegabytes(TETO_INICIAL_BYTES)}, ` +
    `total ${emMegabytes(total)}, ${arquivos.length} arquivos`,
)

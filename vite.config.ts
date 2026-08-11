import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Caminhos relativos: os portais servem o jogo de um subdiretório (e a
  // revisão da CrazyGames chega como zip). Com `base` absoluta, o artefato
  // procuraria os assets na raiz do domínio e abriria em branco.
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})

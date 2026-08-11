/// <reference types="vite/client" />

// Variáveis de ambiente do client, declaradas para o TypeScript reclamar de
// nome errado em vez de entregar `any`. Todas opcionais: o código precisa
// funcionar (ou falhar de forma legível) quando faltam.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** dominio-proprio (padrão) | crazygames | poki */
  readonly VITE_CANAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

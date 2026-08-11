// Camada de serviço — cálculo de farm offline.
//
// Regra inegociável (ver ADR-001, memory/restrictions.md e CLAUDE.md):
// o cálculo SEMPRE roda via RPC `calcularFarmOffline` (SECURITY DEFINER),
// usando now() do Postgres. Este arquivo nunca calcula a recompensa
// localmente nem aceita um timestamp vindo do client.
//
// TODO (Fase 1 — build): implementar quando a RPC existir em supabase/functions/.
export {};

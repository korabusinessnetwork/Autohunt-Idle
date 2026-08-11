// Camada de serviço — estado de assinatura.
//
// Assinante ativo: até 24h/dia de farm automático, sem anúncio.
// Quando a assinatura vence de fato (fim do período pago ou falha
// definitiva de cobrança — nunca no clique de cancelar), o progresso
// acumulado e não coletado é zerado (ver specs/game-idle-farm-core.md).
//
// TODO (Fase 1 — build): integrar gateway (Stripe ou Asaas, ver
// docs/01_ARQUITETURA/tech-stack.md).
export {};

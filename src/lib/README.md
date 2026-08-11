# Camada de serviços

Todo acesso ao backend (Supabase, SDK de anúncio, gateway de pagamento) passa por aqui — nunca direto do componente. Ver `docs/01_ARQUITETURA/padroes.md` pra regras completas.

## Estrutura

- `supabaseClient.ts` — instância única do client Supabase (única cliente que existe no projeto)
- `services/farmService.ts` — chama a RPC `calcularFarmOffline`, nunca calcula localmente
- `services/authService.ts` — cadastro/login, inclui validação de idade no fluxo de cadastro
- `services/subscriptionService.ts` — estado de assinatura, integração com gateway de pagamento
- `services/adService.ts` — crédito de tempo por anúncio assistido, valida callback do SDK

Esboço de estrutura apenas — implementação real é Fase 1 (build), não Fase 3 (fundação).

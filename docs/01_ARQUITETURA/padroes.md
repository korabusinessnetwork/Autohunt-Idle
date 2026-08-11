# Padrões técnicos · Autohunt Idle

## Estrutura de pastas

Organização por **feature**, não por tipo técnico:

```
src/
  components/shared/   # componentes reutilizáveis entre features
  pages/                # telas (Home, TelaRetorno, Configuracoes...)
  context/              # estado global (ex: sessão do jogador)
  hooks/                # hooks customizados
  lib/                  # camada de serviços — ÚNICO ponto de acesso ao backend
  constants/
  styles/               # CSS separado do JSX
  utils/
  game/                 # loop de jogo (canvas/PixiJS) — fora do ciclo do React
```

## Regras obrigatórias

- **Camada de serviços é obrigatória**: nenhum componente chama o SDK do Supabase direto. Tudo passa por `src/lib/services/`.
- **Envelope de resposta consistente**: toda função de serviço retorna `{ data, error, meta }`, nunca lança exceção silenciosa.
- **Erros com código estável** (string, ex. `FARM_CALC_FAILED`) + mensagem legível — nunca só `"erro"`.
- **Eventos de domínio em `dot.case`**, no passado: `farm.calculado`, `assinatura.ativada`, `anuncio.creditado`.
- **Nomenclatura**: nomes de domínio em português (`calcularFarmOffline`), padrões técnicos em inglês (`handleClick`).
- **CSS separado do JSX** — CSS Modules ou `.css` co-localizado, nunca inline style pra estilo persistente.

## Migrations

- `supabase/migrations/YYYYMMDD_descricao.sql` — convenção herdada do padrão GASTROMUNDI/Kora
- Toda tabela nova nasce com RLS ativa por `player_id`/`user_id` — nunca fica sem policy, nem temporariamente

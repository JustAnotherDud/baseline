# Baseline

PWA pessoal, mobile-first e tema escuro: diário nutricional, composição corporal e forma de treino. Sem build, sem framework.

App: https://justanotherdud.github.io/baseline/

## Stack

- HTML, CSS e JS vanilla. Scripts por `<script>`, funções globais, `onclick=` no HTML.
- Supabase JS v2 e Chart.js 4.4.1 por CDN (com SRI).
- GitHub Pages.

## Configuração

Tudo em `localStorage`, preenchido no ecrã de setup ou em Definições.

| Chave | Conteúdo |
|---|---|
| `nt_url`, `nt_key` | URL e publishable key do Supabase |
| `icu_id`, `icu_key` | Athlete ID e API key do Intervals.icu (opcional) |
| `hevy_key` | API key do Hevy (opcional) |
| `icu_enabled`, `hevy_enabled` | `'false'` desliga a integração |

Login obrigatório (Supabase Auth, email e palavra-passe, utilizador único, signups desligados). RLS restrito a `authenticated`: a publishable key sozinha não lê nada. A sessão fica em `localStorage` (supabase-js, refresh automático); sem sessão a app fica no ecrã de login. Logout em Settings.

## Ficheiros

Ordem de carregamento em `index.html`: `config.js`, `nutrition.js`, `db.js`, `ui.js`, `views/*.js`, `app.js` (último, chama `init()`).

- `js/config.js`: `localDate()` e `APP_VERSION`.
- `js/nutrition.js`: `getNutrientColor` (semáforo de aderência), `macroFloorState`, a pesquisa de alimentos (`foodMatchesQuery`), as refeições e o modelo do Histórico.
- `js/db.js`: queries do diário, scores do date picker.
- `js/ui.js`: toast, sheets partilhados (edição, date picker, ranking, donut, mover entrada, sheet da refeição), `parseGramsExpr`.
- `js/app.js`: `init` e login, router por hash (`go`), Definições, refresh automático (ao voltar à app e a cada 60 s recarrega a vista atual, sem pisar um sheet aberto; se a app passou a meia-noite de Lisboa, o Diário e a Manutenção que estavam em "hoje" avançam para o novo hoje, e quem estava num dia passado ou futuro fica).
- `js/views/`: `diary`, `log` (sheet de registo), `foods`, `targets`, `stats`, `history` (Histórico), `body` (Forma).

Views: Diário, Comida, Forma e Mais (Manutenção, Histórico, Estatísticas, Definições).

## Schema Supabase

- `foods`: `name`, `brand`, `serving_size_g`, `calories_per_100g`, `protein_per_100g`, `carbs_per_100g`, `fat_per_100g`, `saturated_fat_per_100g`, `sugar_per_100g`, `fiber_per_100g`.
- `diary`: uma linha por item. `date`, `meal_id` (refeição do dia, FK para `meals`; `meal` é o slot antigo, legado até à fase 4), `food_id` (null em entrada rápida), `food_name`, `grams` (null em entrada rápida), `calories`, `protein`, `carbs`, `fat`, `saturated_fat`, `sugar`, `fiber`, `has_tara`, `logged_at`. Os nutrientes são um snapshot do momento do registo.
- `daily_targets`: uma linha por `date`, escrita só pelo DCB (sync_hub). Nutrientes como em `diary`, mais `blocks_active` (jsonb: chaves `*_kcal` — `core_kcal`, `work_kcal`, `gym_kcal` — `activity_kcal_by_id`, `energy_diag`) e `updated_at`.
- `meals`: uma linha por refeição e dia (`date`, `name` opcional, `started_at` editável, `legacy_key` do slot antigo). Sem limite de refeições por dia. Vista `v_meal_day`: `no` (número calculado pela hora, só para mostrar), `is_latest`, `sort_at` (`started_at`, senão 1.ª entrada, senão criação), totais. RPC `meal_new` (cria) e `meal_suggest` (regra das 2 h). Só se apaga uma refeição vazia (`ON DELETE RESTRICT`); as vazias ficam até as apagares.
- `app_config`: `maintenance_baseline_start` (2026-09-16: desde aí o target é manutenção pura e o delta é comparável).
- `body_comp`: `date`, `weight_kg`, `body_fat_pct`, `muscle_mass_kg`, `bone_mass_kg`, `water_pct`. Preenchida pela sincronização do Garmin.

## Pesquisa de alimentos

Registo (PWA) e MCP `sync_hub_foods_search` chamam o RPC `foods_search(p_query, p_limit)`. Vírgula separa termos (OU); casa no nome ou na marca. Ordem: match no nome, depois só na marca; em cada grupo, entradas do diário com esse `food_id` nos últimos 60 dias (Europe/Lisbon), depois nome. Nunca consumidos ficam no fim do grupo. A página Alimentos filtra no cliente (nome ou marca, vírgula = OU) e ordena pelos chips.

## Refeições (diário)

Refeições numeradas e dinâmicas: criadas a pedido ("+ refeição"), sem limite, ordenadas pela hora (`sort_at`), nome opcional (sem nome: "Refeição N"). O diário mostra só as que têm entradas, mais a vazia mais recente do dia (visível até haver outra mais recente ou o dia acabar). Encolhidas por defeito, menos a mais recente com entradas; tocar na seta ou em qualquer parte do cabeçalho expande ou encolhe (só da sessão, nada se guarda). Cabeçalho: à esquerda o nome (quebra em vez de reticências) e por baixo hora e macros; à direita kcal (alinhada à direita, `tabular-nums`), seta pequena sem caixa e o "+" (52 px) que regista nessa refeição. Refeição vazia: sem coluna kcal nem seta. Tocar no nome ou na hora (sublinhado pontilhado) abre o sheet da refeição: nome, hora (por defeito a da 1.ª entrada; corrige-se aqui, ex.: pré-registo à noite do que se bebe de manhã), "Ver detalhe" (donut) e "Remover" (só vazia).

Dia sem refeições (hoje ou passado, nunca futuro): mostra uma "Refeição 1" vazia só no cliente, sem linha na BD; o "+" regista em "Nova refeição" e a BD cria a real na 1.ª entrada; tocar no nome ou na hora abre o sheet em modo criar.

Registo sem escolha: o select do sheet vem pré-preenchido pelo RPC `meal_suggest` (a refeição mais recente se a última entrada foi há menos de `meal_join_window_minutes` = 120 min em `app_config`, senão "+ Nova refeição") e é editável. "Nova" cria a refeição ao gravar e os registos seguintes vão para ela. Aplicar um modelo cria por defeito uma refeição nova com o nome do modelo (dá para escolher uma existente). O separador Comida → Modelos são os `meal_templates`.

## Pesquisa de alimentos no registo

O registo (PWA) e o MCP `sync_hub_foods_search` chamam o RPC `foods_search(p_query, p_limit)`, com a mesma gramática da página Alimentos (`,` ou, `&` e, `!` nega; nome e marca). Ordem: match no nome, depois só na marca; em cada grupo, entradas do diário com esse `food_id` nos últimos 60 dias (Europe/Lisbon), depois nome. Nunca consumidos ficam no fim do grupo. A gramática existe duas vezes (`foodMatchesQuery` em JS e `food_query_ok` em SQL): mexer num, mexer no outro. A página Alimentos filtra no cliente e ordena pelos chips.

## Alimentos e Estatísticas

Os preços, os custos e as promoções saíram do Baseline (plano 041 do sync_hub). Os dados antigos estão no schema `archive` da BD e em CSV (`D:\backups\baseline-custos-2026-11-10\`). Até à Fase B do plano as colunas de custo ainda existem na BD; a PWA e o MCP já não as usam.

- Alimentos, pesquisa: `,` = ou, `&` = e, `!` nega (nome e marca). Ex.: `continente&!light` (`foodMatchesQuery` em `nutrition.js`). O contador mostra "N de M" com filtro activo. Título, separadores, pesquisa, chips e uma linha de ajuda (ordem activa + filtro em palavras) ficam pinados no topo; `describeFoodQuery` e `foodsHelpLines`.
- Estatísticas, aderência calórica: tocar num ponto abre um tooltip "dd/mm · N%" (toque noutro ponto troca; tocar fora, no mesmo ponto, Esc ou scroll fecha); o `title` fica para desktop. `adherenceDotText` e `tipLeft` em `nutrition.js`.
## Histórico

Mais → Histórico: uma linha por dia, do mais recente para o mais antigo, do primeiro dia com diário até hoje (nunca dias futuros), em blocos de 30 linhas com "Carregar mais". Tocar numa linha abre o diário desse dia. Fonte: vista `v_day_totals` (`security_invoker`); a PWA só formata (`historyRowModel` em `nutrition.js`).

- Linha 1: dia, kcal, delta vs baseline de manutenção (`daily_targets`). Linha 2: P / C / F / fibra e etiquetas.
- Dia sem entradas: tudo "—". Delta antes de `maintenance_baseline_start`: célula vazia.
- Hoje: etiqueta "em curso", kcal e delta esbatidos (um dia a meio não é défice).
- Sequências de 3 ou mais dias sem entradas vêm colapsadas na vista numa só linha ("12/07 a 18/07 · sem registo"), por isso um bloco são 30 linhas, não 30 dias. Hoje nunca entra numa sequência.

## Integrações (view Forma)

- Intervals.icu, `https://intervals.icu/api/v1`, Basic auth `API_KEY:<key>`:
  - `GET /athlete/{id}/wellness?oldest=-90d&newest=hoje` para CTL/ATL/ramp e gráfico.
  - `GET /athlete/{id}/activities?oldest=-14d&newest=hoje&fields=…` para os últimos 7 dias e a semana anterior.
- Hevy, `https://api.hevyapp.com`, header `api-key`: `GET /v1/workouts?page=1|2&pageSize=10`.

Cada fetch tem o seu `.catch(() => null)`: uma API em baixo só esvazia a sua secção.

## Desenvolvimento

```bash
npm test                 # node:test, corre também no hook pre-push
node bump.js             # atualiza ?v= e APP_VERSION
node contrast-check.js   # gate WCAG AA dos tokens de cor
```

Activar o hook uma vez por clone: `git config core.hooksPath githooks`.

Novo loader async: guard de geração (`const gen = ++loadXGen; ... if (gen !== loadXGen) return;`). Novo sheet: `ensureSheet()` e `pushSheetState()` ao abrir, para o botão Voltar do Android o fechar.

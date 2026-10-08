# Baseline

PWA pessoal, mobile-first e tema escuro: diário nutricional, composição corporal e forma de treino. Sem build, sem framework.

App: https://justanotherdud.github.io/baseline/

## Stack

- HTML, CSS e JS vanilla. Scripts por `<script>`, funções globais, `onclick=` no HTML.
- Supabase JS v2 e Chart.js 4.4.1 por CDN (com SRI).
- GitHub Pages.

## Configuração

Tudo em `localStorage`, preenchido no ecrã de setup ou em Settings.

| Chave | Conteúdo |
|---|---|
| `nt_url`, `nt_key` | URL e publishable key do Supabase |
| `icu_id`, `icu_key` | Athlete ID e API key do Intervals.icu (opcional) |
| `hevy_key` | API key do Hevy (opcional) |
| `icu_enabled`, `hevy_enabled` | `'false'` desliga a integração |

Login obrigatório (Supabase Auth, email e password, utilizador único, signups desligados). RLS restrito a `authenticated`: a publishable key sozinha não lê nada. A sessão fica em `localStorage` (supabase-js, refresh automático); sem sessão a app fica no ecrã de login. Logout em Settings.

## Ficheiros

Ordem de carregamento em `index.html`: `config.js`, `nutrition.js`, `db.js`, `ui.js`, `views/*.js`, `app.js` (último, chama `init()`).

- `js/config.js`: `localDate()` e `APP_VERSION`.
- `js/nutrition.js`: `getNutrientColor` (semáforo de aderência), `macroFloorState` e os helpers de custo (formatação, somas, payloads de preço).
- `js/db.js`: queries do diário, scores do date picker e `loadCostConfig` (`app_config`).
- `js/ui.js`: toast, sheets partilhados (edição, date picker, ranking, donut, mover entrada, sheet da refeição), `parseGramsExpr`.
- `js/app.js`: `init` e login, router por hash (`go`), Settings, refresh automático.
- `js/views/`: `diary`, `log` (sheet de registo), `foods`, `meals` (templates), `targets`, `stats`, `cost` (secção de custo das Estatísticas), `history` (Histórico), `body` (Forma).

Views: Diário, Comida, Forma e Mais (Manutenção, Histórico, Estatísticas, Settings).

## Schema Supabase

- `foods`: `name`, `brand`, `serving_size_g`, `calories_per_100g`, `protein_per_100g`, `carbs_per_100g`, `fat_per_100g`, `saturated_fat_per_100g`, `sugar_per_100g`, `fiber_per_100g`, `price_eur` e `price_qty_g` (preço da embalagem e gramas que cobre; os dois ou nenhum).
- `diary`: uma linha por item. `date`, `meal_id` (refeição do dia, FK para `meals`; `meal` é o slot antigo, legado até à fase 4), `food_id` (null em entrada rápida), `food_name`, `grams` (null em entrada rápida), `calories`, `protein`, `carbs`, `fat`, `saturated_fat`, `sugar`, `fiber`, `has_tara`, `logged_at`. Os nutrientes são um snapshot do momento do registo. Custo: `price_eur`, `price_qty_g` (snapshot do preço usado), `cost_eur` e `cost_source` (`default` do food, `override` = preço pontual, etiqueta *Promo*, `manual`). Food sem preço: `cost_eur` NULL, nunca 0. Grátis é 0 explícito (`price_eur = 0` com gramas > 0, ou `cost_eur = 0` manual) e conta como custo conhecido. Entrada sem `food_id` é sempre `manual`: o trigger converte `default`/`override` em custo manual.
- `daily_targets`: uma linha por `date`, escrita só pelo DCB (sync_hub). Nutrientes como em `diary`, mais `blocks_active` (jsonb: chaves `*_kcal` — `core_kcal`, `work_kcal`, `gym_kcal` — `activity_kcal_by_id`, `energy_diag`) e `updated_at`.
- `meals`: uma linha por refeição e dia (`date`, `name` opcional, `started_at` editável, `legacy_key` do slot antigo). Sem limite de refeições por dia. Vista `v_meal_day`: `no` (número calculado pela hora, só para mostrar), `is_latest`, `sort_at` (`started_at`, senão 1.ª entrada, senão criação), totais. RPC `meal_new` (cria) e `meal_suggest` (regra das 2 h). Só se apaga uma refeição vazia (`ON DELETE RESTRICT`); o cron `meals-cleanup-empty` limpa vazias de dias anteriores.
- `meal_templates` (`name`) e `meal_template_items` (`template_id`, `food_id`, `food_name`, `grams` e nutrientes).
- `app_config`: `cost_tracking_start` (dias antes não têm custo nem entram em agregados), `cost_min_coverage` (cobertura mínima para um dia entrar nas médias) e `maintenance_baseline_start` (2026-09-16: desde aí o target é manutenção pura e o delta é comparável).
- `body_comp`: `date`, `weight_kg`, `body_fat_pct`, `muscle_mass_kg`, `bone_mass_kg`, `water_pct`. Preenchida pela sincronização do Garmin.

## Pesquisa de alimentos

Registo (PWA) e MCP `sync_hub_foods_search` chamam o RPC `foods_search(p_query, p_limit)`. Vírgula separa termos (OU); casa no nome ou na marca. Ordem: match no nome, depois só na marca; em cada grupo, entradas do diário com esse `food_id` nos últimos 60 dias (Europe/Lisbon), depois nome. Nunca consumidos ficam no fim do grupo. A página Alimentos filtra no cliente (nome ou marca, vírgula = OU) e ordena pelos chips.

## Refeições (diário)

Refeições numeradas e dinâmicas: criadas a pedido ("+ refeição"), sem limite, ordenadas pela hora (`sort_at`), nome opcional (sem nome: "Refeição N"). O diário mostra só as que têm entradas, mais a vazia mais recente do dia (visível até haver outra mais recente ou o dia acabar). Encolhidas por defeito, menos a mais recente com entradas; tocar na seta ou em qualquer parte do cabeçalho expande ou encolhe (só da sessão, nada se guarda). Cabeçalho: à esquerda o nome (quebra em vez de reticências) e por baixo hora e macros; à direita kcal em cima e custo em baixo (alinhados à direita, `tabular-nums`), seta pequena sem caixa e o "+" (52 px) que regista nessa refeição. Refeição vazia: sem coluna kcal/€ nem seta. Tocar no nome ou na hora (sublinhado pontilhado) abre o sheet da refeição: nome, hora (por defeito a da 1.ª entrada; corrige-se aqui, ex.: pré-registo à noite do que se bebe de manhã), "Ver detalhe" (donut) e "Remover" (só vazia).

Dia sem refeições (hoje ou passado, nunca futuro): mostra uma "Refeição 1" vazia só no cliente, sem linha na BD; o "+" regista em "Nova refeição" e a BD cria a real na 1.ª entrada; tocar no nome ou na hora abre o sheet em modo criar.

Registo sem escolha: o select do sheet vem pré-preenchido pelo RPC `meal_suggest` (a refeição mais recente se a última entrada foi há menos de `meal_join_window_minutes` = 120 min em `app_config`, senão "+ Nova refeição") e é editável. "Nova" cria a refeição ao gravar e os registos seguintes vão para ela. Aplicar um modelo cria por defeito uma refeição nova com o nome do modelo (dá para escolher uma existente). O separador Comida → Modelos são os `meal_templates`.

## Pesquisa de alimentos no registo

O registo (PWA) e o MCP `sync_hub_foods_search` chamam o RPC `foods_search(p_query, p_limit)`, com a mesma gramática da página Alimentos (`,` ou, `&` e, `!` nega, `price`; nome e marca). Ordem: match no nome, depois só na marca; em cada grupo, entradas do diário com esse `food_id` nos últimos 60 dias (Europe/Lisbon), depois nome. Nunca consumidos ficam no fim do grupo. A gramática existe duas vezes (`foodMatchesQuery` em JS e `food_query_ok` em SQL): mexer num, mexer no outro. A página Alimentos filtra no cliente e ordena pelos chips.

## Custo (€)

A conta `round(gramas × price_eur / price_qty_g, 2)` vive só na BD (`food_cost_eur` e o trigger `diary_cost`); a PWA nunca a grava, só envia preços e mostra o resultado. O trigger copia o preço do food no registo, aceita override (`price_eur`, gramas opcionais) e custo manual (`cost_eur`), e recalcula ao mudar gramas ou preço. Alterar um food não muda entradas antigas. Para preencher o custo de um dia depois de pôr preço num food: tool MCP `sync_hub_diary_resnapshot_cost`.

- Alimento: preço da embalagem + gramas, com o €/100g calculado.
- Alimentos, pesquisa: `,` = ou, `&` = e, `!` nega, `price` = tem preço (nome e marca para o resto). Ex.: `continente&!price` = Continente sem preço (`foodMatchesQuery` em `nutrition.js`). O contador mostra "N de M" com filtro activo. Título, separadores, pesquisa, chips e uma linha de ajuda (ordem activa + filtro em palavras) ficam pinados no topo; `describeFoodQuery` e `foodsHelpLines`.
- Alimentos: chips de ordenação €/100g, Kcal/€ e P/€ (g de proteína por €); alimentos sem preço ficam sempre no fim (`foodCostMetric` em `nutrition.js`).
- Registo e edição de entrada: preço pontual (*Promo*) pré-preenchido; "Ver em Alimentos →" no sheet de edição (só entradas com alimento) abre o editor desse alimento; "Preço do alimento" limpa o override; "Grátis (0 €)" põe preço 0. Entrada rápida: campo de custo e "Grátis (0 €)". Formulário de alimento: "Grátis — vem sempre de casa" (preço 0, 100 g por defeito). Grátis mostra-se "grátis" (a verde no diário), nunca "0,00 €".
- Diário: custo por entrada (— sem custo; só o preço Promo leva marca: fundo suave + ↓, texto em `PROMO_LABEL` no `nutrition.js`; *manual* com glifo ✎ antes do valor), subtotal por refeição, total do dia no cabeçalho, ao lado do dia da semana (abaixo de `cost_min_coverage` mostra o mínimo e a cobertura: "≥ 8,40 € · 72%"; acima, só o valor). Preços a dourado (`--price-gold`) no diário, Histórico e Estatísticas.
- Estatísticas, aderência calórica: tocar num ponto abre um tooltip "dd/mm · N%" (toque noutro ponto troca; tocar fora, no mesmo ponto, Esc ou scroll fecha); o `title` fica para desktop. `adherenceDotText` e `tipLeft` em `nutrition.js`.
- Estatísticas: custo por dia, semana e mês (médias só sobre os dias com cobertura suficiente, com "média sobre N dias"), maior gasto e custo efetivo do período (€ por 1000 kcal e € por 100 g de proteína, só sobre entradas com custo e só nos dias que contam nas médias; `costEfficiency` em `nutrition.js`, calculado no cliente). As Estatísticas são só de consumo: atributos dos alimentos (€/100g, kcal/€, P/€) ficam nos chips de Alimentos. Vistas: `v_cost_day`, `v_cost_week`, `v_cost_month`, RPC `cost_top_foods`.

## Histórico

Mais → Histórico: uma linha por dia, do mais recente para o mais antigo, do primeiro dia com diário até hoje (nunca dias futuros), em blocos de 30 linhas com "Carregar mais". Tocar numa linha abre o diário desse dia. Fonte: vista `v_day_totals` (`security_invoker`), que reutiliza `v_cost_day`; a PWA só formata (`historyRowModel` em `nutrition.js`).

- Linha 1: dia, kcal, delta vs baseline de manutenção (`daily_targets`), custo e cobertura. Linha 2: P / C / F / fibra e etiquetas.
- Dia sem entradas: tudo "—". Delta antes de `maintenance_baseline_start` e custo antes de `cost_tracking_start`: célula vazia.
- Hoje: etiqueta "em curso", kcal e delta esbatidos (um dia a meio não é défice). Custo com cobertura abaixo de `cost_min_coverage`: esbatido, com a etiqueta "cobertura baixa".
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
node bump.js             # actualiza ?v= e APP_VERSION
node contrast-check.js   # gate WCAG AA dos tokens de cor
```

Activar o hook uma vez por clone: `git config core.hooksPath githooks`.

Novo loader async: guard de geração (`const gen = ++loadXGen; ... if (gen !== loadXGen) return;`). Novo sheet: `ensureSheet()` e `pushSheetState()` ao abrir, para o botão Voltar do Android o fechar.

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
| `meal_locks` | refeições recolhidas no diário |

Login obrigatório (Supabase Auth, email e password, utilizador único, signups desligados). RLS restrito a `authenticated`: a publishable key sozinha não lê nada. A sessão fica em `localStorage` (supabase-js, refresh automático); sem sessão a app fica no ecrã de login. Logout em Settings.

## Ficheiros

Ordem de carregamento em `index.html`: `config.js`, `nutrition.js`, `db.js`, `ui.js`, `views/*.js`, `app.js` (último, chama `init()`).

- `js/config.js`: `localDate()`, `APP_VERSION` e `MEALS` (7 refeições).
- `js/nutrition.js`: `getNutrientColor` (semáforo de aderência) e `macroFloorState`.
- `js/db.js`: queries do diário e scores do date picker.
- `js/ui.js`: toast, sheets partilhados (edição, date picker, ranking, donut, mover refeição), `parseGramsExpr`.
- `js/app.js`: `init` e login, router por hash (`go`), Settings, refresh automático.
- `js/views/`: `diary`, `log` (sheet de registo), `foods`, `meals` (templates), `targets`, `stats`, `body` (Forma).

Views: Diário, Comida, Forma e Mais (Targets, Estatísticas, Settings).

## Schema Supabase

- `foods`: `name`, `brand`, `serving_size_g`, `calories_per_100g`, `protein_per_100g`, `carbs_per_100g`, `fat_per_100g`, `saturated_fat_per_100g`, `sugar_per_100g`, `fiber_per_100g`.
- `diary`: uma linha por item. `date`, `meal` (chave de `MEALS`), `food_id` (null em entrada rápida), `food_name`, `grams` (null em entrada rápida), `calories`, `protein`, `carbs`, `fat`, `saturated_fat`, `sugar`, `fiber`, `has_tara`, `logged_at`. Os nutrientes são um snapshot do momento do registo.
- `daily_targets`: uma linha por `date`, escrita só pelo DCB (sync_hub). Nutrientes como em `diary`, mais `blocks_active` (jsonb: chaves `*_kcal`, `activity_kcal_by_id`, `energy_diag`) e `updated_at`.
- `meal_templates` (`name`) e `meal_template_items` (`template_id`, `food_id`, `food_name`, `grams` e nutrientes).
- `body_comp`: `date`, `weight_kg`, `body_fat_pct`, `muscle_mass_kg`, `bone_mass_kg`, `water_pct`. Preenchida pela sincronização do Garmin.

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

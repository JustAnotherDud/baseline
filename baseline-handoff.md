# Baseline — Handoff Document

> Estado actual: **Junho 2026**
> PWA pessoal de dados de atleta — nutrição, composição corporal e treino.

---

## 1. O que é o Baseline

PWA pessoal mobile-first, tema escuro, para **registo nutricional**, **composição corporal** e **métricas de treino**. Funciona inteiramente no browser sem backend próprio:

- Nutrição e composição corporal → **Supabase** (JS client directo, sem servidor).
- Métricas de treino → **Intervals.icu API** (fetch directo do browser).

Sem build step, sem bundler, sem framework.

**Stack técnica:**
- HTML/CSS/JS vanilla — `<script>` tags, escopo global, funções chamadas via `onclick=`
- [Supabase JS v2](https://supabase.com/docs/reference/javascript) — CDN (`@supabase/supabase-js@2`)
- [Chart.js 4.4.1](https://www.chartjs.org/) — CDN (charts de Body Comp e Treino)
- Fontes: IBM Plex Mono + DM Sans (Google Fonts)
- PWA: `manifest.json` + metas `apple-mobile-web-app-*`

**URLs:**
| Campo | Valor |
|---|---|
| GitHub | `https://github.com/JustAnotherDud/baseline` |
| App (produção) | `https://justanotherdud.github.io/baseline/` |
| Supabase dashboard | `https://supabase.com/dashboard/project/yvsjchzvoikqlpbqsphs` |

**Credenciais (todas em `localStorage`, configuradas no ecrã de setup):**
| Chave | Conteúdo |
|---|---|
| `nt_url` | URL do projecto Supabase (`https://….supabase.co`) |
| `nt_key` | Publishable key do Supabase (`sb_publishable_…`) |
| `icu_id` | Athlete ID do Intervals.icu (ex.: `i123456`) |
| `icu_key` | API key do Intervals.icu |

Sem RLS no Supabase (projecto pessoal — acesso único). As credenciais ICU são opcionais: sem elas, a view Treino mostra um empty state a pedir configuração.

---

## 2. Estrutura de ficheiros

```
baseline/
├── index.html                  — única página HTML; setup, todas as views, sheets, nav
├── manifest.json               — PWA manifest (name: "Baseline")
├── README.md
├── css/
│   └── styles.css              — todos os estilos; sem preprocessor
├── js/
│   ├── config.js               — MEALS (dict), cachedTargets (fallback)
│   ├── nutrition.js            — getNutrientColor(), getTargets()
│   ├── db.js                   — Supabase queries: getTargetsForDate, loadToday,
│   │                             saveDiary, saveEditEntry, delEntryFromEdit,
│   │                             getDayScores, getActivePhase, moveEntryToMeal
│   ├── ui.js                   — Componentes reutilizáveis (sheets, date picker,
│   │                             nutrient sheet, meal breakdown donut, segmented bar,
│   │                             move-meal sheet, keyword highlight, parseGramsExpr…)
│   ├── app.js                  — init(), go(view), saveSetup(), resetSetup(),
│   │                             switchFoodsTab(), loadSettingsView(),
│   │                             editIcuSettings(), saveIcuSettings(),
│   │                             clearCacheAndReload(); globais db/icuId/icuKey
│   └── views/
│       ├── diary.js            — renderToday(), setDateLabel(), changeDay(), pickDate()
│       │                         NUTRIENT_MAP, tap handlers nas barras de macros
│       ├── log.js              — searchDB(), pickFood(), updatePreview(), backToSearch(),
│       │                         saveQuick(), clearQuick(), openLogForMeal(),
│       │                         openAddFoodFromLog(), getMealByHour(),
│       │                         meal selectors (sheet + view), openLogMeals(),
│       │                         pickLogDate(), updateLogDateLabel(),
│       │                         loadLogTotalsStrip(), handleSaveDiary()
│       ├── foods.js            — loadFoods(), sortFoods(), setSortFoods(), filterFoods(),
│       │                         renderFoods(), editFood(), saveFood(), deleteFood()
│       │                         (SORT_CONFIG, RATIO_FIELD — sort por rácios macro/kcal)
│       ├── meals.js            — loadMeals(), deleteMeal(), openCreateMeal(),
│       │                         closeMealCreate(), saveMeal(), openApplyMeal(),
│       │                         applyMealToDiary(), mcAddItem/mcRemoveItem/
│       │                         renderMcItems/mcSearchFood/mcPickFood/mcGramsChange
│       ├── targets.js          — loadTargetsForm(), refreshPhaseAndTargets(),
│       │                         updatePhaseBadge(), onTargetsDateChange(),
│       │                         updateTargetsDateLabel()
│       ├── stats.js            — loadStats(), setStatsPeriod()
│       ├── body.js             — loadBody(), switchBodyTab(), renderBodyDia(),
│       │                         renderBodyHistorico(), buildBodyChart() (Chart.js)
│       └── treino.js           — loadTreino() + secções/charts Intervals.icu
└── baseline-handoff.md         — este ficheiro
```

**Ordem de carregamento dos scripts** (em `index.html`, antes de `</body>`):

```html
<script src="js/config.js?v=…"></script>
<script src="js/nutrition.js?v=…"></script>
<script src="js/db.js?v=…"></script>
<script src="js/ui.js?v=…"></script>
<script src="js/views/diary.js?v=…"></script>
<script src="js/views/log.js?v=…"></script>
<script src="js/views/foods.js?v=…"></script>
<script src="js/views/meals.js?v=…"></script>
<script src="js/views/targets.js?v=…"></script>
<script src="js/views/stats.js?v=…"></script>
<script src="js/views/body.js?v=…"></script>
<script src="js/views/treino.js?v=…"></script>
<script src="js/app.js?v=…"></script>   <!-- último — chama init() -->
```

`css/styles.css` e cada `<script>` levam `?v=AAAAMMDD[-n]` para cache-busting. **Actualizar sempre que o ficheiro é modificado.**

---

## 3. Schema Supabase

### `foods`
Base de dados de alimentos. Valores por 100g.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `int8` PK | Auto-increment |
| `name` | `text` | Obrigatório |
| `brand` | `text` | Opcional |
| `serving_size_g` | `numeric` | Opcional — activa botão "+ porção" no log/edit |
| `calories_per_100g` | `numeric` | Obrigatório |
| `protein_per_100g` | `numeric` | Obrigatório |
| `carbs_per_100g` | `numeric` | Obrigatório |
| `fat_per_100g` | `numeric` | Obrigatório |
| `saturated_fat_per_100g` | `numeric` | Opcional |
| `sugar_per_100g` | `numeric` | Opcional |
| `fiber_per_100g` | `numeric` | Opcional |

### `diary`
Registo diário de refeições. Cada linha = 1 item registado.
**Snapshot:** os valores nutricionais são calculados no momento do registo (`/100 × grams`). Editar um alimento em `foods` **não** altera registos antigos.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `int8` PK | |
| `date` | `date` | YYYY-MM-DD |
| `meal` | `text` | Chave de `MEALS` (ex.: `breakfast`) |
| `food_id` | `int8` | FK opcional — null em entradas rápidas |
| `food_name` | `text` | Snapshot do nome |
| `grams` | `numeric` | Null em entradas rápidas (`saveQuick`) |
| `calories` | `numeric` | Snapshot calculado |
| `protein` / `carbs` / `fat` | `numeric` | Snapshot calculado |
| `saturated_fat` / `sugar` / `fiber` | `numeric` | Snapshot calculado |
| `logged_at` | `timestamptz` | Default `now()` |

### `daily_targets` *(fonte de verdade dos targets)*
Snapshot diário calculado pelo DCB. Um registo por data. A PWA **só lê** (nunca escreve).

| Coluna | Tipo | Notas |
|---|---|---|
| `date` | `date` UNIQUE PK | YYYY-MM-DD |
| `day_type` | `text` | |
| `calories` | `numeric` | Target calórico |
| `protein` / `carbs` / `fat` | `numeric` | |
| `saturated_fat` / `sugar` / `fiber` | `numeric` | |
| `blocks_active` | `jsonb` | Auditoria: `{base, work, gym, run, surplus, activity}` |
| `notes` | `text` | |
| `phase_id` | `int8` | FK opcional para `phases` |
| `updated_at` | `timestamptz` | Timestamp do push (mostrado na view Targets) |

### `phases`
Fases de treino/nutrição. Badge informativo nas views Targets e Settings.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `int8` PK | |
| `label` | `text` | Ex.: `"Fase 3.5"` |
| `objetivo` | `text` | Ex.: `"surplus +150kcal"` |
| `start_date` | `date` | |
| `end_date` | `date` | Null = fase activa |

Query da fase activa: `start_date ≤ data` e (`end_date is null` ou `end_date ≥ data`).

### `meal_templates` + `meal_template_items`
Templates de refeições reutilizáveis. Cada template tem N itens com snapshots de macros.

### `body_comp` *(composição corporal — sincronizada do Garmin)*
Lida pela view Body. Uma linha por data de pesagem.

| Coluna | Tipo | Notas |
|---|---|---|
| `date` | `date` | YYYY-MM-DD |
| `weight_kg` | `numeric` | Peso |
| `body_fat_pct` | `numeric` | % gordura |
| `muscle_mass_kg` | `numeric` | Massa muscular (usada como LBM no chart) |
| `bone_mass_kg` | `numeric` | Massa óssea |
| `water_pct` | `numeric` | % água |

> A PWA lê `body_comp` directamente; o preenchimento é feito por sincronização externa com o Garmin (fora da PWA).

---

## 4. Navegação e views

### Bottom nav (4 itens)
`#nav-today` · `#nav-foods` · `#nav-treino` · `#nav-mais`
→ **Diário · Comida · Treino · Mais**

A função `go(view)` troca a `.view` activa, marca o `.nav-btn` correspondente (se existir — views internas como Body/Targets/Stats/Settings não têm botão de nav) e dispara o loader (`loadToday`, `loadFoods/loadMeals`, `loadBody`, `loadTreino`, `loadStats`, `loadSettingsView`).

### View **Mais** (`#view-mais`)
Lista de atalhos para as views sem botão de nav próprio:
- **Body Comp** → `go('body')` *(Body está em Mais temporariamente)*
- **Targets** → `go('targets')`
- **Estatísticas** → `go('stats')`
- **Settings** → `go('settings')`

### `#view-today` — Diário
- Calorias em destaque + barra segmentada + `restantes/excesso` + %.
- Grid de macros (Gordura / Hidratos / Proteína) com barra segmentada por macro.
- Chip secundário: Fibra.
- Tap nas barras/células → nutrient ranking sheet.
- Refeições (7): tap no nome → meal breakdown (donut) ou log se vazia; `+ LOG` → log.
- Tap numa entrada → sheet de edição.
- Navegação temporal: ‹ › por dia, mês → date picker (com dots de score).

### `#view-log` — Registar
- Selector de data + 📅.
- Meal selector colapsável (7 refeições).
- 3 chips: Alimento · Refeição (template) · Entrada rápida.

### `#view-foods` — Comida
- **Sub-tab Alimentos:** pesquisa multi-termo (vírgula) + por marca; sort chips Nome / Kcal / P-C-F por kcal; FAB `+` cria alimento.
- **Sub-tab Refeições:** lista de templates, criar/aplicar.

### `#view-treino` — Treino *(Intervals.icu)*
Ver secção 5.

### `#view-body` — Body Comp
- Sub-tabs **Dia** / **Histórico**.
- Dia: pesagem da data + delta vs pesagem anterior + cards (BF/Músculo/Osso/Água) + resumo nutricional do dia.
- Histórico: última pesagem + chart Chart.js (Peso / Body Fat / LBM) com períodos Semana/Mês/3M/6M/1A/Total.

### `#view-targets` — Targets *(read-only)*
- Date picker (sem dots — `opts.showScores: false`).
- Badge de fase + calorias em destaque + macros + Fibra.
- Chips de `blocks_active` + timestamp do push.

### `#view-stats` — Estatísticas
- Períodos 7/14/30 dias (hoje excluído).
- Médias diárias, streak, aderência calórica, top alimentos.

### `#view-settings` — Settings
- **Perfil:** Nome (dud), Fase activa, Objectivo (de `phases`).
- **App:** Versão.
- **Configuração:**
  - **Intervals.icu:** Athlete ID (visível) + API Key (mascarada `••••••`) + botão "Configurar Intervals.icu" → sheet com 2 inputs → `saveIcuSettings()` grava `icu_id`/`icu_key`, actualiza globais e chama `loadTreino()`.
  - Limpar cache e recarregar (`caches.delete()` + `location.reload(true)`).
  - Redefinir ligação Supabase (`resetSetup()` — limpa `nt_url`/`nt_key`).

### Sheets / overlays (criados dinamicamente em `ui.js`/`app.js`)
`#sheet-log` · `#sheet-food` · `#sheet-edit` · `#dp-overlay` (date picker) · `#nutri-overlay` · `#meal-bd-overlay` (donut) · `#move-meal-overlay` · `#icu-settings-overlay` · overlays de templates de refeição.

---

## 5. Integração Intervals.icu (view Treino)

Ficheiro: `js/views/treino.js`. A view mostra **métricas e charts** — não lista actividades individuais.

### Autenticação
HTTP Basic com utilizador literal `API_KEY` e a key como password:

```js
'Authorization': 'Basic ' + btoa('API_KEY:' + icuKey)
```

Base URL: `https://intervals.icu/api/v1`. Helper `icuFetch(path)` faz `fetch` com o header e lança em `!res.ok`.

### Endpoints usados
| Endpoint | Para quê |
|---|---|
| `GET /athlete/{id}/wellness?oldest=DATE-60d&newest=TODAY` | CTL/ATL/TSB actuais, histórico 60d (charts), HRV, sono |
| `GET /athlete/{id}/activities?oldest=DATE-14d&newest=TODAY&fields=name,type,distance,moving_time,icu_training_load,start_date_local` | Resumo da semana actual vs anterior |

Os dois fetches correm em paralelo com `Promise.all`, cada um com `.catch(() => null)` — **erro numa secção não afecta as outras**. Só se ambos falharem é mostrado o empty state global. Cada secção tem ainda o seu próprio empty state discreto quando não há dados.

### Secções
1. **Forma actual** — grid 3 colunas (estilo macro grid): Fitness (CTL, accent), Fadiga (ATL, orange), Forma (TSB = CTL−ATL, accent/red) + ramp rate. Usa o **último** registo do wellness (ordenado por `id`, que é `YYYY-MM-DD`).
2. **Fitness · 60 dias** — Chart.js linha dupla CTL (accent) / ATL (orange), sem pontos, X dd/mm (1 etiqueta em cada 7), legenda no topo.
3. **HRV · 30 dias** — Chart.js linha azul com pontos; últimos 30 registos com `hrv != null`; se < 3 → "Sem dados HRV suficientes".
4. **Resumo da semana** — totais (km / tempo h:mm / carga TL) da semana actual (segunda→hoje) vs semana anterior, em 3 chips `.msc` com delta % (↑ verde / ↓ vermelho).

**Wellness chips:** HRV (último + seta vs média 7d) e Sono (média 7d, `sleepSecs/3600`). Peso não aparece aqui (está na view Body).

Charts: instâncias guardadas em `treinoCtlChart` / `treinoHrvChart`, destruídas antes de cada re-render. Gridlines subtis `rgba(255,255,255,0.04)`, ticks `#666`. As cores de canvas usam valores hex directos (Chart.js não resolve `var(--…)` dentro do canvas).

---

## 6. Constantes importantes

### MEALS — 7 refeições (`config.js`)
```js
const MEALS = {
  breakfast: 'Pequeno-almoço', morning: 'Lanche manhã', lunch: 'Almoço',
  afternoon1: 'Lanche tarde 1', afternoon2: 'Lanche tarde 2',
  dinner: 'Jantar', supper: 'Ceia',
};
```

### cachedTargets — fallback (`config.js`)
```js
let cachedTargets = { calories: 2300, fat: 65, carbs: 254, fiber: 30, protein: 175 };
```
Usado por `getTargets()`. Na prática o diário usa `getTargetsForDate(date)` que lê `daily_targets`; se não houver row, a view trata como "sem target".

### Cores por nutriente (`nutrition.js` — `getNutrientColor`)
| Nutriente | Verde (accent) | Amarelo | Vermelho |
|---|---|---|---|
| `calories` | 90–110% | 80–90% / 110–120% | resto |
| `protein` | 86–130% | 63–86% / 130–150% | resto |
| `fat` | 85–160% | 54–85% / 160–200% | resto |
| `carbs` | 85–135% | 70–85% / 135–150% | resto |
| `fiber` | ≥90% | ≥70% | <70% |

### Variáveis de tema (`styles.css` `:root`)
`--bg #0f0f0f` · `--surface #1a1a1a` · `--surface2 #222` · `--surface3 #2a2a2a` · `--border #2e2e2e` · `--accent #4ade80` · `--text #f0f0f0` · `--text2 #bbb` · `--text3 #888` · `--red #f87171` · `--orange #fb923c` · `--blue #60a5fa` · `--yellow #fbbf24` · `--mono` (IBM Plex Mono) · `--sans` (DM Sans).

### Keywords coloridas (`ui.js` — `highlightFoodKeywords`)
`Light`/`Zero` → text3; `Integral` → `#a3845a`; `Proteico`/`Proteica` → blue.

---

## 7. Decisões de arquitectura

### Script tags em vez de ES modules
Escopo global partilhado; funções via `onclick=`. Ordem de carregamento = ordem de dependências. `app.js` sempre por último (chama `init()`).

### Variáveis globais de ligação
`db` (cliente Supabase), `icuId`, `icuKey` declaradas em `app.js` e lidas/escritas a partir de `localStorage` em `init()` / `saveSetup()` / `saveIcuSettings()`. As views referenciam estes globais directamente.

### Snapshot no diary
Nutrientes copiados no momento do registo; editar `foods` não altera histórico.

### `daily_targets` como fonte de verdade
A PWA nunca calcula nem escreve targets — só lê. O DCB (Claude Desktop + MCP `sync_hub`) é a única fonte de escrita.

### Intervals.icu read-only e tolerante a falhas
Fetches paralelos com `.catch(() => null)`; cada secção da view Treino degrada de forma independente.

### Guard de concorrência por geração
```js
let loadXGen = 0;
async function loadX() {
  const gen = ++loadXGen;
  await query();
  if (gen !== loadXGen) return; // resultado stale → descartar
  render();
}
```
Aplicado em: `loadToday` (loadTodayGen), `loadStats`, `loadBody` (loadBodyGen), `loadTreino` (loadTreinoGen), `loadLogTotalsStrip`, `refreshPhaseAndTargets`, `openApplyMeal`.

### `openDatePicker(value, onSelect, opts)`
`opts.showScores === false` → não faz fetch de `getDayScores` nem desenha dots (usado na view Targets).

### Charts (Chart.js)
Usado em Body (peso/BF/LBM) e Treino (CTL/ATL, HRV). Instâncias guardadas em variáveis e **destruídas antes de re-render** para evitar fugas e canvas a 0px. Cores hex directas (sem `var(--…)`).

---

## 8. Padrões de desenvolvimento

### Antes de cada push
```bash
node --check js/views/ficheiro_alterado.js
```

### Cache-busting
`?v=AAAAMMDD[-n]` em `css/styles.css` e em cada `<script>`. Incrementar o sufixo `-n` para múltiplas alterações no mesmo dia.

### Git
Trabalhar sempre em `main`. Commit + push no fim de cada sessão. Remote: `https://github.com/JustAnotherDud/baseline.git`.

### Hard refresh após deploy
Settings → "Limpar cache e recarregar" (`caches.delete()` + `location.reload(true)`).

### Adicionar nova view
1. `<div id="view-X" class="view">` em `index.html`.
2. Botão de nav (`#nav-X`) **ou** item em `#view-mais` com `onclick="go('X')"`.
3. `if (view==='X') loadX();` em `go()` (`app.js`).
4. Criar `js/views/X.js` (com guard de geração `loadXGen`).
5. `<script src="js/views/X.js?v=…">` antes de `app.js`.

### Adicionar sheet (overlay)
Criar `<div class="sheet-overlay">` dinamicamente uma vez (cache por `id`), `appendChild` ao body, fechar com clique no overlay / `×`, abrir com `.classList.add('open')`. Ver `openNutrientSheet`, `editIcuSettings`, `openMoveMealSheet` como modelos.

---

## 9. Contexto do utilizador

**José (Dud)** — corredor de endurance + ginásio. Nutrição gerida por fases (DCB → `daily_targets`). Métricas dinâmicas de treino (CTL/ATL/TSB, HRV, sono, carga) vêm do **Intervals.icu**; composição corporal (peso/BF/músculo) vem do **Garmin** via `body_comp`. A PWA agrega tudo numa só interface mobile.

---

## 10. Estado / roadmap

**Concluído**
- Diário, base de alimentos, log (pesquisa/rápida/templates), templates de refeições
- Targets modulares read-only (DCB → `daily_targets`), barras segmentadas, nutrient ranking, meal breakdown donut
- Date picker com score por dia, estatísticas (7/14/30d)
- Body Comp (Dia + Histórico com chart)
- **Treino** — integração Intervals.icu (forma, charts CTL/ATL e HRV, resumo semanal, wellness)
- Configuração ICU no setup e nas Settings

**Pendente / ideias**
- Mover Body Comp de "Mais" para um lugar permanente na nav
- Próximo treino planeado (events) na view Treino
- Export do diário (CSV/JSON)
- Notificações PWA (Service Worker)

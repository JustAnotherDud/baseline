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

**Credenciais (todas em `localStorage`, configuradas no ecrã de setup ou Settings):**
| Chave | Conteúdo |
|---|---|
| `nt_url` | URL do projecto Supabase (`https://….supabase.co`) |
| `nt_key` | Publishable key do Supabase (`sb_publishable_…`) |
| `icu_id` | Athlete ID do Intervals.icu (ex.: `i123456`) |
| `icu_key` | API key do Intervals.icu |
| `icu_enabled` | `'false'` se integração ICU desactivada (default: true) |
| `hevy_key` | API key do Hevy |
| `hevy_enabled` | `'false'` se integração Hevy desactivada (default: true) |

**RLS activo** em todas as 9 tabelas com políticas permissivas `anon_all` (projecto pessoal — acesso único via publishable key). As credenciais ICU e Hevy são opcionais: sem elas, as secções de Treino/Ginásio mostram empty states a pedir configuração.

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
│   ├── config.js               — MEALS (dict)
│   ├── nutrition.js            — getNutrientColor()
│   ├── db.js                   — Supabase queries: getTargetsForDate, loadToday,
│   │                             saveDiary, saveEditEntry, delEntryFromEdit,
│   │                             getDayScores, getActivePhase, moveEntryToMeal
│   ├── ui.js                   — Componentes reutilizáveis (sheets, date picker,
│   │                             nutrient sheet, meal breakdown donut, segmented bar,
│   │                             move-meal sheet, keyword highlight, parseGramsExpr…)
│   ├── app.js                  — init(), go(view), saveSetup(), resetSetup(),
│   │                             switchFoodsTab(), loadSettingsView(),
│   │                             editIcuSettings(), saveIcuSettings(), toggleIcu(),
│   │                             editHevySettings(), saveHevySettings(), toggleHevy(),
│   │                             clearCacheAndReload();
│   │                             globais db/icuId/icuKey/hevyKey/icuEnabled/hevyEnabled
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
│       └── body.js             — loadBody() — view unificada Forma (Garmin + ICU + Hevy)
│                                 Secções: Forma actual (CTL/ATL/TSB) · Última pesagem ·
│                                 Chart Forma (CTL/ATL) · Chart Composição (Peso/BF/LBM) ·
│                                 Últimos 7 dias (Intervals.icu + Hevy)
│                                 Charts: bodyFormChart · bodyCompChart
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
`#nav-today` · `#nav-foods` · `#nav-forma` · `#nav-mais`
→ **Diário · Comida · Forma · Mais**

A função `go(view)` troca a `.view` activa, marca o `.nav-btn` correspondente (se existir — views internas como Targets/Stats/Settings não têm botão de nav) e dispara o loader: `today→loadToday`, `foods→loadFoods/loadMeals`, `forma→loadBody`, `settings→loadSettingsView`, `stats→loadStats`. Desde `c4b62ad`, usa `history.pushState({view}, '', '#'+view)` para suporte ao botão Voltar do Android.

### View **Mais** (`#view-mais`)
Lista de atalhos para as views sem botão de nav próprio:
- **Targets** → `go('targets')`
- **Estatísticas** → `go('stats')`
- **Settings** → `go('settings')`

### `#view-today` — Diário
- Header pinado no topo: data + kcal em destaque (herói 36px) com `restante/excesso` + %.
- Grid de macros (Gordura / Hidratos / Proteína) com hierarquia floor/residual: P e F são floors (`≥min`, `✓` atingido, `−Xg ↓` abaixo, gordura `>90` sinaliza); Hidratos é residual (só `%`, nunca sinalizado). Ver `PRODUCT.md`.
- Tap no kcal ou numa célula de macro → nutrient ranking sheet.
- Refeições (7): tap no nome → meal breakdown (donut) ou log se vazia; `+ LOG` → log. Lock por refeição (localStorage) colapsa e impede edição; entradas com tara mostram `⚖ tem tara`.
- Tap numa entrada → sheet de edição.
- Navegação temporal: ‹ › por dia, mês → date picker (com dots de score).

### `#view-log` — Registar
- Selector de data + 📅.
- Meal selector colapsável (7 refeições).
- 3 chips: Alimento · Refeição (template) · Entrada rápida.

### `#view-foods` — Comida
- **Sub-tab Alimentos:** pesquisa multi-termo (vírgula) + por marca; sort chips Nome / Kcal / P-C-F por kcal; FAB `+` cria alimento.
- **Sub-tab Refeições:** lista de templates, criar/aplicar.

### `#view-forma` — Forma (view unificada em scroll)
`body.js` — secções em scroll único:
1. **Forma actual** (`bodyFormaHtml`) — CTL / ATL / TSB + ramp rate (Intervals.icu)
2. **Última pesagem** (`bodyWeighInHtml`) — Peso/BF/LBM/Água + delta vs pesagem anterior (Supabase `body_comp`)
3. **Chart Forma** (`bodyFormChartSectionHtml`) — CTL/ATL linha dupla, período partilhado; instância `bodyFormChart`
4. **Chart Composição** (`bodyCompChartSectionHtml`) — Peso / BF% / LBM, eixo duplo (yWeight esq. / yFat dir.); instância `bodyCompChart`
5. **Últimos 7 dias** (`bodyWeekSectionHtml`) — km / tempo / carga TL (Intervals.icu) + Ginásio (Hevy, se key configurada e `hevyEnabled`), delta vs 7 dias anteriores

### `#view-targets` — Targets *(read-only)*
- Date picker (sem dots — `opts.showScores: false`).
- Badge de fase + calorias em destaque + macros + Fibra.
- Chips de `blocks_active` + timestamp do push.

### `#view-stats` — Estatísticas
- Períodos 7/14/30 dias (hoje excluído).
- Médias diárias, streak, aderência calórica, top alimentos.

### `#view-settings` — Settings
- **Perfil:** Nome, Fase activa, Objectivo (de `phases`).
- **App:** Versão.
- **Configuração:**
  - **Intervals.icu:** Athlete ID (visível) + API Key (mascarada `••••••`) + toggle ON/OFF (`toggleIcu()`, persiste em `icu_enabled`) + botão "Configurar" → sheet (`editIcuSettings()`) → `saveIcuSettings()` grava `icu_id`/`icu_key`, actualiza globais e chama `loadBody()`.
  - **Hevy:** API Key (mascarada, últimos 4 dígitos visíveis) + toggle ON/OFF (`toggleHevy()`, persiste em `hevy_enabled`) + botão "Configurar" → sheet (`editHevySettings()`) → `saveHevySettings()` grava `hevy_key` e chama `loadBody()`.
  - Limpar cache e recarregar (`caches.delete()` + `location.reload(true)`).
  - Redefinir ligação Supabase (`resetSetup()` — limpa `nt_url`/`nt_key`).

### Sheets / overlays (criados dinamicamente em `ui.js`/`app.js`/`body.js`)
`#sheet-log` · `#sheet-food` · `#sheet-edit` · `#dp-overlay` (date picker) · `#nutri-overlay` · `#meal-bd-overlay` (donut) · `#move-meal-overlay` · `#icu-settings-overlay` · `#hevy-settings-overlay` · overlays de templates de refeição · `#gym-detail-sheet` (detalhe sessões Hevy) · sheet de detalhe actividades ICU.

---

## 5. Integração Intervals.icu (view Forma — secções de Treino)

Ficheiro: `js/views/body.js` (view unificada com Body Comp). As secções de treino mostram **métricas e charts** — não lista actividades individuais.

### Autenticação
HTTP Basic com utilizador literal `API_KEY` e a key como password:

```js
'Authorization': 'Basic ' + btoa('API_KEY:' + icuKey)
```

Base URL: `https://intervals.icu/api/v1`. Helper `icuFetch(path)` faz `fetch` com o header e lança em `!res.ok`.

### Endpoints usados
| Endpoint | Para quê |
|---|---|
| `GET /athlete/{id}/wellness?oldest=DATE-90d&newest=TODAY` | CTL/ATL/TSB actuais, histórico 90d (charts) |
| `GET /athlete/{id}/activities?oldest=DATE-14d&newest=TODAY&fields=name,type,distance,moving_time,icu_training_load,start_date_local` | Últimos 7 dias (ICU) + semana anterior |

Os fetches correm em paralelo com `Promise.all`, cada um com `.catch(() => null)` — **erro numa secção não afecta as outras**. Se `icuEnabled` for `false`, os fetches não são feitos (resolvem `null` sem rede).

### Secções
1. **Forma actual** (`bodyFormaHtml`) — grid 4 colunas: Fitness (CTL, accent), Fadiga (ATL, orange), Forma (TSB = CTL−ATL, accent/red), Ramp (taxa/semana). Usa o **último** registo do wellness (ordenado por `id` = `YYYY-MM-DD`).
2. **Chart Forma** (`bodyFormChartSectionHtml`, instância `bodyFormChart`) — Chart.js linha dupla CTL (accent) / ATL (orange), sem pontos. Gridlines `rgba(255,255,255,0.04)`, ticks `#666`. Cores hex directas (Chart.js não resolve `var(--…)` dentro do canvas).
3. **Últimos 7 dias** (`bodyWeekSectionHtml`) — chips de Distância / Tempo / Carga (ICU) + Ginásio (Hevy, se configurado). Tap em chip → `openActivityDetailSheet(metric)` ou `openGymDetailSheet()`.

### 5.1 Integração Hevy (view Forma — secção Ginásio)

Base URL: `https://api.hevyapp.com`. Helper `hevyFetch(path)` envia header `api-key: hevyKey` e lança em `!res.ok`.

**Endpoints:**
| Endpoint | Para quê |
|---|---|
| `GET /v1/workouts?page=1&pageSize=10` | Página 1 dos treinos mais recentes |
| `GET /v1/workouts?page=2&pageSize=10` | Página 2 (até 20 sessões no total) |

Os dois fetches correm em paralelo; resultados são normalizados (array directo ou `{workouts:[...]}`) e filtrados para os últimos 14 dias (janela `[hoje-14, hoje]`). A janela activa para o chip é `[hoje-6, hoje]` (7 dias, hoje incluído), guardada em `bodyGymCurrent`.

**Cálculo de volume** (`calcGymVolume(workout)`): soma `weight_kg × reps` de todos os sets com `type === 'normal'`, `weight_kg` e `reps` presentes.

**Condições de fetch:** requer `hevyKey` (não vazio) **e** `hevyEnabled === true`. Se desactivado, `bodyHevyWorkouts` e `bodyGymCurrent` ficam `[]` sem fetch.

**Configuração (Settings):**
- `editHevySettings()` abre sheet `#hevy-settings-overlay` com campo de API key.
- `saveHevySettings()` grava em `hevy_key`, actualiza `hevyKey`, fecha sheet e chama `loadBody()`.
- `toggleHevy()` inverte `hevyEnabled`, persiste em `hevy_enabled` e chama `loadBody()`.

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

### Targets — `getTargetsForDate(date)` (`db.js`)
O diário usa `getTargetsForDate(date)`, que lê `daily_targets`; se não houver row, a view trata como "sem target".

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
Aplicado em: `loadToday` (loadTodayGen), `loadStats`, `loadBody` (loadBodyGen), `loadLogTotalsStrip`, `refreshPhaseAndTargets`, `openApplyMeal`.

### `openDatePicker(value, onSelect, opts)`
`opts.showScores === false` → não faz fetch de `getDayScores` nem desenha dots (usado na view Targets).

### Charts (Chart.js)
Usado na view Forma: `bodyFormChart` (CTL/ATL linha dupla) e `bodyCompChart` (Peso/BF/LBM). Instâncias guardadas em variáveis e **destruídas antes de re-render** para evitar fugas e canvas a 0px. Cores hex directas (sem `var(--…)`).

---

## 8. Padrões de desenvolvimento

### Antes de cada push
```bash
node --check js/views/ficheiro_alterado.js   # syntax check
npm test                                      # 64 testes node:test
node bump.js                                  # actualizar ?v= timestamps
```

### Cache-busting
`?v=AAAAMMDD[-n]` em `css/styles.css` e em cada `<script>`. Incrementar o sufixo `-n` para múltiplas alterações no mesmo dia. `bump.js` automatiza a actualização.

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
- Targets modulares read-only (DCB → `daily_targets`), hierarquia floor/residual de macros, nutrient ranking, meal breakdown donut
- Lock de refeição (localStorage) + flag de tara nas entradas; seletores de refeição gerados de `MEALS`
- Date picker com score por dia, estatísticas (7/14/30d)
- Body Comp (Dia + Histórico com charts)
- **Treino** — integração Intervals.icu (forma, charts CTL/ATL, resumo semanal) — view unificada `#view-forma`
- **Ginásio** — integração Hevy (volume por sessão, chip Ginásio na secção Últimos 7 dias, detalhe em sheet) — commit `18c763e`
- Toggles ON/OFF para ICU e Hevy + Limpar perfil — commit `18c763e`
- Hash router (back button Android) — commit `c4b62ad`
- Sheet animation (slide-up) + view fade-in + toast slide-in — commit `adb15a8`
- Detalhe semanal agrupado por tipo de actividade (`openActivityDetailSheet`) — commit `47b0ef5`
- Debounce na pesquisa de alimentos (300 ms) — commit `d1d2048`
- SRI + CDN pinado (supabase-js) — commit `eb7ad30`
- `escHtml()` em todos os interpolações innerHTML com dados externos (XSS hardening) — commits `a629026`, `85baeb7`
- Suite de testes `npm test` (64 testes, `node:test`) — commit `ee8b08e`
- `bump.js` para cache-busting automático

**Pendente / ideias**
- Lock de refeições 🔐
- Emojis automáticos nos alimentos
- E-ink display (Orange Pi Zero 2W + Waveshare)
- Próximo treino planeado (events ICU)
- Export do diário (CSV/JSON)
- Notificações PWA (Service Worker)

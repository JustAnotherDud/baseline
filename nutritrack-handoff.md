# NutriTrack — Handoff Document

> Estado actual: **24 Mai 2026** — Fase 3.5 activa  
> Versão da app: **v1.2.0**

---

## 1. O que é o NutriTrack

PWA de registo nutricional pessoal, mobile-first, com tema escuro. Funciona inteiramente no browser sem backend próprio — toda a persistência é feita directamente no Supabase via JS client. Sem build step, sem bundler, sem framework.

**Stack técnica:**
- HTML/CSS/JS vanilla — `<script>` tags, escopo global
- [Supabase JS v2](https://supabase.com/docs/reference/javascript) — CDN (`@supabase/supabase-js@2`)
- Fontes: IBM Plex Mono + DM Sans (Google Fonts)
- PWA: `manifest.json` + `<meta apple-mobile-web-app-capable>`

**URLs:**
| Campo | Valor |
|---|---|
| GitHub | `https://github.com/JustAnotherDud/nutrition-tracker` |
| App (produção) | `https://justanotherdud.github.io/nutrition-tracker` |
| Supabase dashboard | `https://supabase.com/dashboard/project/yvsjchzvoikqlpbqsphs` |

**Supabase:**
| Campo | Valor |
|---|---|
| URL | `https://yvsjchzvoikqlpbqsphs.supabase.co` |
| Publishable key | *(ver `athlete.json` → `nutrition_tracker.publishable_key`)* |
| Secret key | *(ver `athlete.json` → `nutrition_tracker.secret_key` — não incluir aqui)* |

As credenciais são guardadas em `localStorage` (`nt_url`, `nt_key`) no primeiro uso via ecrã de setup. Sem RLS (projecto pessoal — acesso único).

---

## 2. Estrutura de ficheiros

```
nutrition-tracker/
├── index.html                  — única página HTML; contém todas as views e sheets
├── manifest.json               — PWA manifest
├── css/
│   └── styles.css              — todos os estilos; sem preprocessor
├── js/
│   ├── config.js               — MEALS (dict), cachedTargets (fallback Fase 3.5)
│   ├── nutrition.js            — getNutrientColor(), getTargets()
│   ├── db.js                   — Supabase queries: getTargetsForDate, loadToday,
│   │                             saveDiary, saveEditEntry, delEntryFromEdit,
│   │                             getDayScores, getActivePhase, moveEntryToMeal
│   ├── ui.js                   — Componentes de UI reutilizáveis:
│   │                             toast, overlayClose,
│   │                             openLog, closeLog, openAddFood, closeAddFood,
│   │                             openEditEntry, closeEditEntry,
│   │                             openDatePicker (opts.showScores),
│   │                             openNutrientSheet, openMealBreakdown,
│   │                             openMoveMealSheet, updateEditPreview,
│   │                             renderMealTemplateList,
│   │                             buildSegmentedBar,
│   │                             openSmartSheet, applyAutoSmart,
│   │                             parseGramsExpr, insertOperator,
│   │                             highlightFoodKeywords
│   ├── app.js                  — init(), go(view), switchFoodsTab(), saveSetup(),
│   │                             resetSetup(), loadSettingsView(), clearCacheAndReload()
│   └── views/
│       ├── diary.js            — renderToday(), setDateLabel(), changeDay(), pickDate()
│       │                         NUTRIENT_MAP, tap handlers nas barras de macros
│       ├── log.js              — searchDB(), pickFood(), updatePreview(), backToSearch(),
│       │                         saveQuick(), clearQuick(), handleSaveDiary(),
│       │                         openLogForMeal(), openAddFoodFromLog(),
│       │                         getMealByHour(), updateMealSelectorLabel(),
│       │                         toggleMealSelector(), selectMealFromSelector(),
│       │                         updateSheetMealTabs(), selectSheetMeal(),
│       │                         selectSheetMealFromDropdown(),
│       │                         openLogMeals(), pickLogDate(), updateLogDateLabel(),
│       │                         loadLogTotalsStrip(), loadRecentFoods()
│       ├── foods.js            — loadFoods(), filterFoods(), renderFoods(), editFood(),
│       │                         saveFood(), deleteFood(), sortFoods(), setSortFoods(),
│       │                         calcSmartScore(), toggleSmartChip(),
│       │                         updateSmartChipVisuals(), resetSmart(), toggleSmart()
│       ├── meals.js            — loadMeals(), deleteMeal(), openCreateMeal(),
│       │                         closeMealCreate(), saveMeal(), openApplyMeal(),
│       │                         applyMealToDiary(), mcAddItem(), mcRemoveItem(),
│       │                         renderMcItems(), mcSearchFood(), mcPickFood(),
│       │                         mcGramsChange()
│       ├── targets.js          — loadTargetsForm(), refreshPhaseAndTargets(),
│       │                         updatePhaseBadge(), onTargetsDateChange(),
│       │                         updateTargetsDateLabel()
│       └── stats.js            — loadStats(), setStatsPeriod()
└── nutritrack-handoff.md       — este ficheiro
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
<script src="js/app.js?v=…"></script>   <!-- último — chama init() -->
```

Cada ficheiro tem `?v=AAAAMMDD` para cache-busting. Actualizar sempre que o ficheiro é modificado.

---

## 3. Schema Supabase

### `foods`
Base de dados de alimentos. Valores por 100g.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `int8` PK | Auto-increment |
| `name` | `text` | Obrigatório |
| `brand` | `text` | Opcional |
| `serving_size_g` | `numeric` | Opcional — activa botão "+ porção" no log |
| `calories_per_100g` | `numeric` | Obrigatório |
| `protein_per_100g` | `numeric` | Obrigatório |
| `carbs_per_100g` | `numeric` | Obrigatório |
| `fat_per_100g` | `numeric` | Obrigatório |
| `saturated_fat_per_100g` | `numeric` | Opcional |
| `sugar_per_100g` | `numeric` | Opcional |
| `fiber_per_100g` | `numeric` | Opcional |

### `diary`
Registo diário de refeições. Cada linha = 1 item registado.  
**Importante:** os valores nutricionais são um snapshot calculado no momento do registo (`/100 * grams`). Não referenciam `foods` em tempo real — se um alimento for editado em `foods`, os registos antigos no diário não mudam.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `int8` PK | |
| `date` | `date` | YYYY-MM-DD |
| `meal` | `text` | Chave de `MEALS` (ex: `breakfast`, `lunch`) |
| `food_id` | `int8` | FK opcional — null em entradas rápidas |
| `food_name` | `text` | Snapshot do nome na altura do registo |
| `grams` | `numeric` | Null em entradas rápidas (`saveQuick`) |
| `calories` | `numeric` | Snapshot calculado |
| `protein` | `numeric` | Snapshot calculado |
| `carbs` | `numeric` | Snapshot calculado |
| `fat` | `numeric` | Snapshot calculado |
| `saturated_fat` | `numeric` | Snapshot calculado |
| `sugar` | `numeric` | Snapshot calculado |
| `fiber` | `numeric` | Snapshot calculado |
| `logged_at` | `timestamptz` | Default: `now()` |

### `daily_targets` *(principal — fonte de verdade)*
Snapshot diário calculado pelo DCB via `sync_hub_push_daily_target`. Um registo por data.

| Coluna | Tipo | Notas |
|---|---|---|
| `date` | `date` UNIQUE PK | YYYY-MM-DD |
| `day_type` | `text` | `"modular"` em Fase 3.5 |
| `calories` | `numeric` | Target calórico calculado pelos blocos |
| `protein` | `numeric` | Sempre 175g (Fase 3.5 — locked) |
| `carbs` | `numeric` | Residual: `(calories - 1285) / 4` |
| `fat` | `numeric` | Sempre 65g (Fase 3.5 — locked) |
| `saturated_fat` | `numeric` | Cap 25g |
| `sugar` | `numeric` | Referência 150g |
| `fiber` | `numeric` | Target 30g |
| `blocks_active` | `jsonb` | Auditoria dos blocos: `{base, work, gym, run, surplus}` |
| `notes` | `text` | Contexto livre passado ao DCB |
| `phase_id` | `int8` | FK opcional para `phases` |
| `updated_at` | `timestamptz` | Timestamp do push |

### `targets` *(deprecated — não lida pela PWA)*
Sistema anterior à Fase 3.5 por `day_type`. A PWA lê exclusivamente de `daily_targets`.  
Não escrever novos dados aqui.

### `phases`
Fases de treino/nutrição. Usado para badge informativo na vista Targets.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `int8` PK | |
| `label` | `text` | Ex: `"Fase 3.5"` |
| `objetivo` | `text` | Ex: `"surplus +150kcal"` |
| `start_date` | `date` | Início da fase |
| `end_date` | `date` | Null = fase activa |

### `meal_templates` + `meal_template_items`
Templates de refeições reutilizáveis. Cada template tem N itens com snapshots de macros.

---

## 4. Constantes importantes

### MEALS — 7 refeições (config.js)

```js
const MEALS = {
  breakfast:  'Pequeno-almoço',
  morning:    'Lanche manhã',
  lunch:      'Almoço',
  afternoon1: 'Lanche tarde 1',
  afternoon2: 'Lanche tarde 2',
  dinner:     'Jantar',
  supper:     'Ceia',
};
```

### cachedTargets — fallback Fase 3.5 (config.js)

```js
let cachedTargets = {
  calories: 2300, fat: 65, saturated_fat: 25,
  carbs: 254, sugar: 150, fiber: 30, protein: 175
};
```

Usado quando não há row em `daily_targets` para a data pedida.

### Indicadores de cor por nutriente (nutrition.js — `getNutrientColor`)

| Nutriente | Verde | Amarelo | Vermelho |
|---|---|---|---|
| `calories` | 95–105% | 90–95% / 105–110% | resto |
| `carbs` | 85–135% | 70–85% / 135–150% | resto |
| `protein` | 86–130% | 63–86% / 130–150% | resto |
| `fat` | 85–160% | 54–85% / 160–200% | resto |
| `satfat`, `sugar` | ≤85% | 85–100% | >100% |
| `fiber` | ≥90% | 70–89% | <70% |

### Keywords coloridas (ui.js — `highlightFoodKeywords`)

| Keyword | Cor |
|---|---|
| `Light` | `var(--text3)` — cinzento |
| `Zero` | `var(--text3)` — cinzento |
| `Integral` | `#a3845a` — castanho |
| `Proteico` / `Proteica` | `var(--blue)` — azul |

Aplicado em: nomes de alimentos no diário, lista de alimentos, resultados de pesquisa.

### Score de dia (date picker — `getDayScores`)

Para cada dia com registo e target:
- `green` se ≥3 dos 4 macros principais estão na zona verde
- `yellow` se exactamente 2
- `red` se ≤1
- `neutral` se há registo mas sem target

---

## 5. Sistema de targets modulares (Fase 3.5)

Activo desde **14 Mai 2026**.

### Fórmula de cálculo (`sync_hub_push_daily_target`)

```
TDEE = base + work_hours × work_per_hour + gym + run_{type}
target_kcal = round(TDEE + surplus_kcal)
```

**Blocos actuais** (de `athlete.json`):

| Bloco | Kcal |
|---|---|
| `base` | 2150 |
| `work_per_hour` | 80 / hora |
| `gym` | 250 |
| `run_z2_curto` | 300 |
| `run_z2_longo` | 550 |
| `run_threshold` | 500 |
| `run_race` | 600 |
| `surplus_kcal` | +150 (excepção: run_race → 0) |

### Macros locked (Fase 3.5)

```
protein_g  = 175   (sempre)
fat_g      = 65    (sempre)
fixed_kcal = 175×4 + 65×9 = 1285
carbs_g    = round((target_kcal - 1285) / 4)
```

---

## 6. Integração sync_hub / DCB

O DCB corre no Claude Desktop com acesso ao MCP server `sync_hub_mcp.py` (transporte stdio).

**Configuração** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "sync_hub": {
      "command": "python",
      "args": ["D:\\sync_hub\\scripts\\sync_hub_mcp.py"]
    }
  }
}
```

Credenciais em `D:\sync_hub\data\athlete.json` → `nutrition_tracker.url` / `.secret_key`.

### 10 Ferramentas MCP disponíveis

| Ferramenta | O que faz |
|---|---|
| `sync_hub_nutrition_fetch(target_date)` | Lê diário de uma data, retorna totais + breakdown |
| `sync_hub_push_daily_target(date, work_hours, gym, run_type, notes)` | Calcula TDEE por blocos, upsert em `daily_targets` |
| `sync_hub_foods_search(query)` | Pesquisa `foods` por nome/marca, retorna até 10 resultados |
| `sync_hub_log_food(food_id, grams, meal, date)` | Regista alimento no diário com nutrientes calculados |
| `sync_hub_log_quick(name, calories, protein, carbs, fat, meal, date, ...)` | Entrada rápida sem alimento na DB |
| `sync_hub_diary_delete(entry_id)` | Apaga entrada do diário |
| `sync_hub_diary_update(entry_id, grams)` | Actualiza gramas e recalcula nutrientes |
| `sync_hub_foods_create(name, calories, protein, carbs, fat, ...)` | Cria alimento novo |
| `sync_hub_foods_update(food_id, ...)` | Actualiza campos de um alimento (parcial) |
| `sync_hub_nutrition_summary(days)` | Médias, aderência, streak dos últimos N dias (hoje excluído) |

**Notas:**
- `meal` aceita PT ou EN (`pequeno-almoço` ou `breakfast`)
- `sync_hub_log_food` e `sync_hub_log_quick` sempre requerem confirmação do utilizador antes de executar
- `sync_hub_push_targets` e `sync_hub_update_targets` foram removidos (deprecated)

### Fluxo DCB → NutriTrack

```
DCB:
  1. sync_hub_nutrition_fetch     → ver o que está comido
  2. sync_hub_push_daily_target   → calcula blocos e faz upsert
        ↓
  daily_targets (Supabase)
        ↓
  NutriTrack PWA (lê via getTargetsForDate)
        ↓
  Diário → barras segmentadas coloridas
  Targets → valores + chips dos blocos activos
```

A PWA nunca escreve em `daily_targets` — read-only.

---

## 7. Navegação e vistas

### Bottom nav
`#nav-today` · `#nav-log` · `#nav-foods` · `#nav-mais`

### `#view-today` — Diário

- **Calorias:** número (34px) + `/target kcal` + `restantes/excesso` numa linha
- **Barras segmentadas** (P/H/G + calorias): zonas coloridas vermelho/amarelo/verde/amarelo/vermelho, começam em 20% do target, indicador de posição com triângulo ▼, labels numéricas nos limites da zona verde
- **Chips secundários:** Gord. Sat. · Fibra · Açúcar (barras simples)
- **Header de cada macro:** `71g /175g · 104g rest.` (rest. só quando abaixo do target)
- **Tap em barra primária** → nutrient ranking sheet
- **Tap em chip secundário** → nutrient ranking sheet
- **Tap no nome da refeição** (esquerda): se tem entradas → meal breakdown; se vazia → log
- **Tap no +** (direita): sempre abre log para essa refeição
- **Tap numa entrada** → sheet de edição (long press removido — substituído por botão no sheet)
- **Navegação temporal:** ← → por dia, 📅 → date picker

### `#view-log` — Registar

- Selector de data + botão 📅
- Meal selector colapsável (7 botões em grid)
- 3 chips: Alimento · Entrada rápida · Refeição template

### `#view-foods` — Comida

**Sub-tab Alimentos:**
- Pesquisa multi-termo com vírgula: `quei,leit` → união dos resultados
- Pesquisa por marca funciona directamente
- Sort chips: Nome A→Z · Proteína ↑ · Kcal ↑ · **Smart**
- **Smart:** chips toggle "Quero mais" (Proteína/Hidratos/Gordura/Fibra) + "Quero evitar" (Gord. Sat./Gordura/Açúcar). Botão "Auto ✨" calcula pesos com base no estado do diário. Score normalizado visível na coluna direita.
- FAB `+` → criar alimento

**Sub-tab Refeições:**
- Lista de templates. Tap → apply. Botão criar.

### `#sheet-log` — Sheet de pesquisa

```
[dropdown de refeição ▾]
[Pesquisar na base de dados...]
[+ Criar novo alimento        ]
[Entrada rápida] [Refeição template]
```

- Sem secção de Recentes
- Stage de gramas: input text + botão `=` + linha de operadores `+ − × ÷`
- Botão `+ porção` acumula doses (soma ao valor actual)
- Display de doses dinâmico: `1.4×` calculado automaticamente

### `#sheet-edit` — Editar entrada

- Para entradas normais: input de gramas (pré-seleccionado) + botão `=` + operadores + preview de macros
- Para quick entries: 7 campos editáveis directamente
- Botão "Alterar Refeição" → picker de refeição
- Botões: Eliminar · Guardar

### `#view-stats` — Estatísticas

- Selector de período: 7 / 14 / 30 dias (chips)
- Hoje sempre excluído dos cálculos
- **Secção 1:** Médias diárias (Kcal/P/H/G vs targets)
- **Secção 2:** Streak de registo (dias consecutivos)
- **Secção 3:** Aderência calórica — dots coloridos (7d: linha; 14d: 2 linhas; 30d: grid)
- **Secção 4:** Top 5 alimentos mais frequentes

### `#view-targets` — Targets (read-only)

- Date picker (sem dots de score — `opts.showScores: false`)
- Badge de fase activa
- Calorias em destaque (34px)
- Macros P/H/G + secundários
- Chips de blocos activos (`blocks_active`)
- Timestamp do push (com data se não for hoje)

### `#view-settings` — Settings

- Nome: "dud" (hardcoded)
- Fase activa + objectivo (de `phases` no Supabase)
- Versão: v1.2.0
- Botões: Limpar cache · Redefinir ligação

### Sheets (overlays)

| ID | Conteúdo |
|---|---|
| `#sheet-log` | Log de alimento |
| `#sheet-food` | Criar/editar alimento |
| `#sheet-edit` | Editar/eliminar entrada do diário |
| `#dp-overlay` | Date picker com dots de score |
| `#nutri-overlay` | Nutrient ranking sheet |
| `#meal-bd-overlay` | Meal breakdown — donut SVG |
| `#log-meals-overlay` | Aplicar template de refeição |
| `#meal-create-overlay` | Criar novo template |
| `#apply-meal-overlay` | Preview + confirmação de template |
| `#move-meal-overlay` | Mover entrada para outra refeição |
| `#smart-overlay` | Smart ranker — chips + Auto ✨ |

---

## 8. Decisões de arquitectura

### Script tags em vez de ES modules
Escopo global partilhado. Funções chamadas inline via `onclick=`. Sem build step, sem bundler.  
**Consequência:** a ordem de carregamento = ordem de dependências. `app.js` sempre por último.

### Snapshot no diary
Nutrientes copiados no momento do registo. Editar `foods` não altera histórico. Integridade histórica garantida.

### `daily_targets` como fonte de verdade
PWA nunca calcula targets — só lê. Fallback para `cachedTargets` se não houver row. DCB é a única fonte de escrita via `sync_hub_push_daily_target`.

### Barras segmentadas
`buildSegmentedBar(actual, target, macro)` em `ui.js`. Zonas por macro:

```js
const ZONES = {
  protein:  { bounds: [63, 86, 130, 150],  maxPct: 155 },
  carbs:    { bounds: [70, 85, 135, 150],  maxPct: 155 },
  fat:      { bounds: [54, 85, 160, 200],  maxPct: 205 },
  calories: { bounds: [90, 95, 105, 110],  maxPct: 115 },
};
```

Barra começa em 20% do target (`minPct = 20`). Labels nos limites da zona verde em valor absoluto.

### Smart ranker (foods.js)
Estado: `smartMore` (Set) + `smartAvoid` (Set) + `smartActive` (bool).  
Score normalizado: cada nutriente dividido pelo máximo da lista visível — garante que P (0-76g) e gord.sat (0-10g) têm peso comparável.  
Auto ✨: calcula pesos com base no estado do diário + targets do dia, com `progress = max(0.20, kcal_actual/kcal_target)`.

### parseGramsExpr
`parseGramsExpr(raw)` em `ui.js`. Aceita expressões matemáticas (`1000-400`, `100*6`, `150+50`). Usa whitelist de caracteres + `Function()` em strict mode (mais seguro que `eval`). Aplicado em `log-grams`, `edit-grams`.

### `renderMealTemplateList` partilhada
`openLogMeals()` e `loadMeals()` partilham a função `renderMealTemplateList(containerEl, templates, countMap, opts)`.  
`opts.showDelete`: true → botão ✕; false → chevron, row inteiro clicável.

### Guard de concorrência por geração
```js
let loadXGen = 0;
async function loadX() {
  const gen = ++loadXGen;
  await query();
  if (gen !== loadXGen) return; // stale
  element.innerHTML = '...';
}
```
Aplicado em: `loadStats` (loadStatsGen), `loadLogTotalsStrip` (loadTotalsGen), `openApplyMeal` (openApplyMealGen).

### `openDatePicker` com opts
Terceiro argumento `opts = {}`. `opts.showScores === false` → omite fetch de `getDayScores` e não desenha dots. Usado na vista Targets.

---

## 9. Padrões de desenvolvimento

### Antes de cada push
```bash
node --check js/views/ficheiro_alterado.js
```

### Cache-busting
`?v=AAAAMMDD` em cada `<script>`. Actualizar sempre que o ficheiro é modificado.

### Claude Code
```bash
cd C:\Users\josef\nutrition-tracker
claude
```
Trabalhar sempre em `main`. Push no final de cada sessão.

### Hard refresh após deploy
Mobile: Settings → "Limpar cache e recarregar" (chama `caches.delete()` + `location.reload(true)`).

### Supabase MCP (Claude Code)
- `list_tables` — ver schema
- `apply_migration` — executar SQL
- `get_logs` — debug

### Adicionar nova view
1. `<div id="view-X" class="view">` em `index.html`
2. Item em `#view-mais` com `onclick="go('X')"`
3. `if (view==='X') loadX();` em `go()` de `app.js`
4. Criar `js/views/X.js`
5. `<script src="js/views/X.js?v=…">` antes de `app.js`

### Adicionar sheet (overlay)
```js
let overlay = document.getElementById('x-overlay');
if (!overlay) {
  overlay = document.createElement('div');
  overlay.id = 'x-overlay';
  overlay.className = 'sheet-overlay';
  overlay.innerHTML = `<div class="sheet">...</div>`;
  document.body.appendChild(overlay);
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
}
overlay.classList.add('open');
```

---

## 10. Roadmap

### Concluído
- [x] Base de dados de alimentos (CRUD)
- [x] Diário com refeições + edição inline
- [x] Log com pesquisa, entrada rápida, templates
- [x] Templates de refeições reutilizáveis
- [x] Sistema de targets modulares (DCB → daily_targets → PWA)
- [x] Vista Targets read-only com blocos como chips
- [x] Barras segmentadas com zonas de cor (P/H/G + calorias)
- [x] Nutrient ranking sheet (tap nas barras)
- [x] Meal breakdown com donut SVG
- [x] Date picker com score de cor por dia
- [x] Estatísticas: médias + streak + aderência + top alimentos (7/14/30 dias)
- [x] Smart ranker com Auto ✨
- [x] Keywords coloridas (Light, Zero, Integral, Proteico/a)
- [x] Mover entrada entre refeições
- [x] Expressões matemáticas nos campos de gramas
- [x] Botões de operadores (+−×÷) no log e edit
- [x] Contador de doses acumulativo
- [x] Multi-pesquisa com vírgula + pesquisa por marca
- [x] sync_hub: 10 ferramentas MCP

### Pendente
- [ ] Botão de dose no sheet de editar entrada existente
- [ ] Export CSV/JSON do diário
- [ ] Proteína em g/kg nas Stats
- [ ] Notificações PWA (Service Worker)
- [ ] Perfis/arquétipos de alimentos na lista
- [ ] Partilhar app com outro utilizador (requer RLS)

---

## 11. Contexto do utilizador

**José (Dud)**, 26 anos, 184cm, ~69kg, Rio Maior, Portugal.

**Trabalho:** Lidl, turnos variáveis (manhã / tarde / duplo). Horas reais determinam o bloco `work` do target. DCB lê Google Calendar "trabalho" automaticamente.

**Treino:** Corredor de endurance (foco maratona Porto, 8 Nov 2026). Ginásio full body A/B/C/D, foco hypertrophy upper body.

**Fase nutricional actual:** **3.5** (desde 14 Mai 2026)
- Objectivo: surplus +150 kcal sobre TDEE
- Excepção: `run_race` → surplus 0
- Macros locked: P 175g, F 65g, C residual

**PRs:**
- 5K: 20:15 | 10K: 42:34 (Scalabis Night Race, 18 Abr 2026)
- Maratona: estreia Porto, 8 Nov 2026

**Métricas dinâmicas** (peso, HRV, VO2Max, ACWR): Intervals.icu — não duplicar no NutriTrack.

**Padrão de sono:** estruturalmente tardio (01h–02h). DCB nunca sugere treino cedo.

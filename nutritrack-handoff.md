# NutriTrack — Handoff Document

> Estado actual: **16 Mai 2026** — Fase 3.5 activa  
> Última actualização automática gerada por Claude Code.

---

## 1. O que é o NutriTrack

PWA de registo nutricional pessoal, mobile-first, com tema escuro. Funciona inteiramente no browser sem backend próprio — toda a persistência é feita directamente no Supabase via JS client. Sem build step, sem bundler, sem framework.

**Stack técnica:**
- HTML/CSS/JS vanilla — `<script>` tags, escopo global
- [Supabase JS v2](https://supabase.com/docs/reference/javascript) — CDN (`@supabase/supabase-js@2`)
- Fontes: IBM Plex Mono + DM Sans (Google Fonts)
- PWA: `manifest.json` + `<meta apple-mobile-web-app-capable>`

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
│   ├── config.js               — MEALS (dict), cachedTargets (fallback)
│   ├── nutrition.js            — getNutrientColor(), getTargets()
│   ├── db.js                   — Supabase queries: getTargetsForDate (daily_targets → fallback cache),
│   │                             loadToday, saveDiary, saveEditEntry, delEntryFromEdit,
│   │                             getDayScores, getActivePhase
│   ├── ui.js                   — Componentes de UI reutilizáveis:
│   │                             toast, overlayClose,
│   │                             openLog, closeLog, openAddFood, closeAddFood,
│   │                             openEditEntry, closeEditEntry,
│   │                             openDatePicker (opts.showScores), openNutrientSheet,
│   │                             openMealBreakdown, updateEditPreview,
│   │                             renderMealTemplateList
│   ├── app.js                  — init(), go(view), switchFoodsTab(), saveSetup(), resetSetup(),
│   │                             loadSettingsView(), clearCacheAndReload()
│   └── views/
│       ├── diary.js            — renderToday(), setDateLabel(), changeDay(), pickDate()
│       │                         NUTRIENT_MAP, tap handlers nas barras de macros
│       ├── log.js              — searchDB(), pickFood(), updatePreview(), backToSearch(),
│       │                         saveQuick(), clearQuick(), handleSaveDiary(),
│       │                         openLogForMeal(), openAddFoodFromLog(),
│       │                         getMealByHour(), updateMealSelectorLabel(),
│       │                         toggleMealSelector(), selectMealFromSelector(),
│       │                         updateSheetMealTabs(), selectSheetMeal(),
│       │                         openLogMeals(), pickLogDate(), updateLogDateLabel(),
│       │                         loadLogTotalsStrip(), loadRecentFoods()
│       ├── foods.js            — loadFoods(), filterFoods(), renderFoods(), editFood(),
│       │                         saveFood(), deleteFood(), sortFoods(), setSortFoods(),
│       │                         toggleMoreMenu(), closeMoreMenu(), selectMoreSort()
│       ├── meals.js            — loadMeals(), deleteMeal(), openCreateMeal(), closeMealCreate(),
│       │                         saveMeal(), openApplyMeal(), applyMealToDiary(),
│       │                         mcAddItem(), mcRemoveItem(), renderMcItems(),
│       │                         mcSearchFood(), mcPickFood(), mcGramsChange()
│       ├── targets.js          — loadTargetsForm(), refreshPhaseAndTargets(),
│       │                         updatePhaseBadge(), onTargetsDateChange(),
│       │                         updateTargetsDateLabel()
│       └── stats.js            — loadStats() — 3 queries paralelas, 3 secções renderizadas
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
| `serving_size_g` | `numeric` | Opcional — activa botão "1 porção" no log |
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

### `targets` *(deprecated — manter como cache)*
Targets por `day_type` — sistema anterior à Fase 3.5. A PWA já não escreve para esta tabela. `sync_hub_push_targets` ainda pode fazer upsert aqui para compatibilidade, mas `daily_targets` é a fonte de verdade.

| Coluna | Tipo | Notas |
|---|---|---|
| `day_type` | `text` UNIQUE | ex: `rest_pure`, `work_only`, `training_only`… |
| `calories` | `numeric` | |
| `fat` | `numeric` | |
| `saturated_fat` | `numeric` | |
| `carbs` | `numeric` | |
| `sugar` | `numeric` | |
| `fiber` | `numeric` | |
| `protein` | `numeric` | |
| `updated_at` | `text` | |

### `daily_targets` *(principal — fonte de verdade)*
Snapshot diário calculado pelo DCB via `sync_hub_push_daily_target`. Um registo por data.

| Coluna | Tipo | Notas |
| --- | --- | --- |
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

### `phases`
Fases de treino/nutrição. Usado para badge informativo na vista Targets.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `int8` PK | |
| `label` | `text` | Ex: `"Fase 3"`, `"Fase 3.5"` |
| `objetivo` | `text` | Ex: `"surplus +150kcal"` |
| `start_date` | `date` | Início da fase |
| `end_date` | `date` | Null = fase activa |

Query usada: `lte('start_date', date).or('end_date.is.null,end_date.gte.'+date).maybeSingle()`

### `phase_targets` *(deprecated em Fase 3.5)*
Targets por fase + day_type — substituídos pelo sistema de blocos. A função `getPhaseTargets(phaseId, dayType)` ainda existe em `db.js` mas já não é chamada pela UI.

### `meal_templates`
Refeições guardadas como template reutilizável.

| Coluna | Tipo |
|---|---|
| `id` | `int8` PK |
| `name` | `text` |
| `created_at` | `timestamptz` |

### `meal_template_items`
Itens de cada template. Valores são snapshots (gramas × food).

| Coluna | Tipo |
|---|---|
| `id` | `int8` PK |
| `template_id` | `int8` FK → `meal_templates.id` |
| `food_id` | `int8` FK → `foods.id` |
| `food_name` | `text` |
| `grams` | `numeric` |
| `calories` | `numeric` |
| `protein` | `numeric` |
| `carbs` | `numeric` |
| `fat` | `numeric` |
| `saturated_fat` | `numeric` |
| `sugar` | `numeric` |
| `fiber` | `numeric` |

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

### Auto-selecção de refeição por hora (log.js — `getMealByHour`)

| Horas | Refeição |
|---|---|
| 06:00–09:59 | `breakfast` |
| 10:00–11:59 | `morning` |
| 12:00–14:59 | `lunch` |
| 15:00–17:59 | `afternoon1` |
| 18:00–19:59 | `afternoon2` |
| 20:00–22:59 | `dinner` |
| Resto | `supper` |

A selecção automática só actua se `mealManuallySelected === false`. Uma vez escolhida manualmente, persiste até fechar o sheet de log ou navegar para outra vista.

### Indicadores de cor por nutriente (nutrition.js — `getNutrientColor(nutrient, pct)`)

| Nutriente | Verde | Amarelo | Vermelho |
|---|---|---|---|
| `calories`, `carbs` | 90–110% | 80–90% ou 110–120% | resto |
| `protein` | 90–130% | 80–90% ou 130–150% | resto |
| `fat` | 50–120% | 30–50% ou 120–140% | resto |
| `satfat`, `sugar` | ≤85% | 85–100% | >100% |
| `fiber` | ≥90% | 70–89% | <70% |

Cores CSS: `var(--accent)` = verde, `var(--yellow)` = amarelo, `var(--red)` = vermelho.

### Score de dia (date picker — db.js — `getDayScores`)

Para cada dia que tem registos no diário **e** target em `daily_targets`:
- Verifica os 4 macros principais (calories, protein, carbs, fat)
- `green` se ≥3 estão na zona verde
- `yellow` se exactamente 2
- `red` se ≤1
- `neutral` se há registo mas sem target para esse dia

Os dots coloridos aparecem por baixo de cada número no date picker.

---

## 5. Sistema de targets modulares (Fase 3.5)

Activo desde **14 Mai 2026**. Substitui o sistema de day_types fixos.

### Fórmula de cálculo (sync_hub_mcp.py — `sync_hub_push_daily_target`)

```
TDEE = base
     + work_hours × work_per_hour
     + gym (se sessão de ginásio)
     + run_{run_type} (se corrida)

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

**Exemplos práticos:**
- Dia de descanso puro: `2150 + 150 = 2300 kcal`
- Turno Lidl 6h: `2150 + 6×80 + 150 = 2780 kcal`
- Ginásio + turno 6h: `2150 + 250 + 480 + 150 = 3030 kcal`
- Z2 curto + turno 6h: `2150 + 300 + 480 + 150 = 3080 kcal`

### Macros — P e F locked, C residual (Fase 3.5)

```
protein_g  = 175   (sempre)
fat_g      = 65    (sempre)
fixed_kcal = 175×4 + 65×9 = 700 + 585 = 1285

carbs_g = round((target_kcal - 1285) / 4)
```

Verificação automática: `|P×4 + C×4 + F×9 - target_kcal| ≤ 15 kcal`. Se falhar, o push não avança.

**Secundários fixos:** sat_fat cap 25g, sugar referência 150g, fibra target 30g.

### `blocks_active` (jsonb em daily_targets)

Guardado para auditoria — a PWA exibe-o como chips na vista Targets:

```json
{
  "base":    2150,
  "work":    480,
  "gym":     0,
  "run":     0,
  "surplus": 150
}
```

---

## 6. Integração sync_hub / DCB

O DCB (Daily Coaching Brief) corre no Claude Desktop com acesso ao MCP server `sync_hub` definido em `sync_hub_mcp.py` (transporte stdio).

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

As credenciais Supabase são lidas de `D:\sync_hub\data\athlete.json` → `nutrition_tracker.url` / `.secret_key`.

### Ferramentas MCP disponíveis

#### `sync_hub_nutrition_fetch` — leitura do diário
Busca entradas do diário de uma data (default: hoje). Retorna totais + breakdown por refeição. Salva também em `D:\sync_hub\output\nutrition_today.json`.

**Uso típico no DCB:** verificar o que já foi comido antes de calcular o target do dia.

#### `sync_hub_push_daily_target` — **ferramenta principal** (Fase 3.5)
Calcula TDEE por blocos e faz upsert em `daily_targets`. Parâmetros:

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `date` | `string` | YYYY-MM-DD |
| `work_hours` | `float` | Horas de trabalho Lidl (net) |
| `gym` | `bool` | Sessão de ginásio? |
| `run_type` | `string?` | `z2_curto` \| `z2_longo` \| `threshold` \| `race` \| null |
| `notes` | `string?` | Contexto opcional |

Retorna `target_kcal`, macros calculados e `blocks_active` para confirmação.

#### `sync_hub_push_targets` — *deprecated*
Faz upsert na tabela `targets` por `day_type` (sistema antigo). Também cria snapshot em `daily_targets` como efeito secundário. **Não usar em Fase 3.5** — prefira `sync_hub_push_daily_target`.

#### `sync_hub_update_targets` — JSONBin / MFP Tampermonkey
Envia targets para o JSONBin (lido pelo script Tampermonkey no MyFitnessPal). Não afecta o NutriTrack directamente. Inclui campos opcionais de display (`context_label`, `subtitle`, `calories_type`).

### Fluxo DCB → NutriTrack

```
DCB corre:
  1. sync_hub_nutrition_fetch     → ver o que está comido
  2. (analisa turnos, treino, recuperação)
  3. sync_hub_push_daily_target   → calcula blocos e faz upsert
        ↓
  daily_targets (Supabase)
        ↓
  NutriTrack PWA (lê via db.js → getTargetsForDate)
        ↓
  Vista Diário → barras de progresso coloridas
  Vista Targets → valores + chips dos blocos activos
```

A PWA nunca escreve em `daily_targets` — é **read-only** do lado do NutriTrack. O DCB é a única fonte de escrita.

---

## 7. Navegação e vistas

A navegação é gerida por `go(view)` em `app.js`. Remove `.active` de todas as `.view` e `.nav-btn`, depois adiciona `.active` à view e nav-btn alvo.

### Bottom nav (4 botões)
`#nav-today` · `#nav-log` · `#nav-foods` · `#nav-mais`

### `#view-today` — Diário
Vista principal. Carrega via `loadToday()` → `db.js`:
- Barra de calorias + restantes/excesso
- Barras primárias: Proteína, Hidratos, Gordura (tap → nutrient ranking sheet)
- Chips secundários: Gord. Saturada, Fibra, Açúcar (tap → nutrient ranking sheet)
- Cabeçalho de calorias também clicável → ranking de calorias
- Secções por refeição (`MEALS`) com lista de entradas
  - Tap no nome da refeição (esquerda): se tem entradas → `openMealBreakdown`; se vazia → `openLogForMeal`
  - Tap no `+` (direita): sempre `openLogForMeal`
  - Tap numa entrada → `openEditEntry` (sheet de edição)
- Navegação temporal: `←` / `→` por dia, tap na data → date picker

### `#view-log` — Registar
Vista de log. Contém:
- Date label + selector de data
- Meal selector colapsável (botão com label da refeição actual + grid de 7 botões)
- Acesso ao log sheet via botão central (`+` FAB circular na nav)
  - `openLog('db')` → pesquisa na tabela `foods`
  - `openLog('quick')` → entrada rápida com campos manuais
  - Chip "Refeição" → `openLogMeals` (aplicar template)
- Totals strip no topo do sheet (kcal actual / target + P H G)

### `#view-foods` — Comida
Duas sub-tabs:
- **Alimentos** (`#foods-panel`): lista com pesquisa + ordenação (Nome, Proteína, Kcal + menu "Mais" com 9 opções). FAB `+` → criar alimento. Tap num item → editar.
- **Refeições** (`#meals-panel`): lista de templates. Tap num template → `openApplyMeal`. Botão "Criar refeição" → `openCreateMeal` (pode pré-popular a partir de `openMealBreakdown` via "Guardar como refeição").

### `#view-mais` — Mais
Menu de navegação secundária com 3 items:
- **Targets** → `go('targets')`
- **Estatísticas** → `go('stats')`
- **Settings** → `go('settings')`

### `#view-targets` — Targets
Vista read-only. Acede-se via `go('targets')` → `loadTargetsForm()`.
- Date picker para navegar entre datas
- Badge de fase activa (de `phases`)
- Calorias em destaque (42px mono, cor accent)
- Display rows: Proteína, Hidratos, Gordura (primários) + Gord. Saturada, Fibra, Açúcar (secundários)
- Chips de blocos activos (`blocks_active` do row daily_targets)
- Timestamp do push
- Mensagem de hint se não houver target para a data

### `#view-stats` — Estatísticas
Vista de estatísticas dos últimos 7 dias. Carrega via `loadStats()` → `stats.js`:
- **Médias diárias:** para os dias com ambos diário + target, calcula médias de Kcal/P/H/G com barras coloridas e percentagem
- **Aderência calórica 7 dias:** 7 dots coloridos (DD/MM) usando `getNutrientColor('calories', pct)`; cinzento = sem dados
- **Top 5 alimentos:** ordenados por frequência (contagem de registos), desempate por kcal total

### `#view-settings` — Settings
Vista informativa (read-only). Mostra nome (hardcoded "dud"), fase activa e objectivo (de `phases`), versão da app. Botões: "Limpar cache e recarregar", "Redefinir ligação Supabase".

### Sheets (overlays)
Criados dinamicamente uma vez e reutilizados (`.open` class toggle):

| ID | Conteúdo |
|---|---|
| `#sheet-log` | Log de alimento — 2 stages: search / grams |
| `#sheet-food` | Criar/editar alimento |
| `#sheet-edit` | Editar/eliminar entrada do diário |
| `#dp-overlay` | Date picker com dots de score |
| `#nutri-overlay` | Nutrient ranking sheet (agrupado por alimento) |
| `#meal-bd-overlay` | Meal breakdown — donut SVG + lista |
| `#log-meals-overlay` | Aplicar template de refeição (picker) |
| `#meal-create-overlay` | Criar novo template de refeição |
| `#apply-meal-overlay` | Preview + confirmação de aplicação de template |

---

## 8. Decisões de arquitectura

### Script tags em vez de ES modules
Todos os ficheiros partilham o escopo global (`window`). Funções chamadas inline via `onclick=` em HTML. Permite hot-reload simples e evita tooling (não há `import`/`export`, bundler ou transpiler).

**Consequência:** a ordem de carregamento é a ordem correcta de dependências. `app.js` carrega sempre por último (chama `init()` no final do ficheiro).

### Snapshot no diary
Quando um alimento é registado, os valores nutricionais são copiados para o `diary` na altura (`calories = food.calories_per_100g / 100 * grams`). Se o alimento for depois editado em `foods`, os registos históricos não mudam. Garante integridade histórica.

### `daily_targets` como fonte de verdade
A PWA nunca calcula targets — apenas lê de `daily_targets`. Se não houver row para a data pedida, cai para `cachedTargets` (fallback em `localStorage`, definido em `config.js` como defaults). O cálculo fica inteiramente no DCB via `sync_hub_push_daily_target`.

### Targets read-only na PWA
A vista Targets mostra apenas o que o DCB empurrou. Não há formulário de edição — a única fonte de escrita é o DCB. Simplifica a UI e evita conflitos entre valores calculados e valores manuais.

### `daily_targets` upsert por `date` (unique)
Permite re-push sem duplicados. O DCB pode correr várias vezes no mesmo dia sem problemas — a última chamada vence.

### Sem RLS
Projecto pessoal, acesso único. A `secret_key` está em `athlete.json` (local) e em `localStorage` da PWA. Aceitável — não há dados de terceiros.

### Date picker com scores de cor
O calendário faz 2 queries em `Promise.all` para o mês visível: diary e daily_targets. Agrega client-side e calcula score por dia (verde/amarelo/vermelho/neutro). Feedback visual imediato do histórico de aderência.

`openDatePicker` aceita terceiro argumento `opts = {}`. Quando `opts.showScores === false`, o fetch de scores é omitido e não são desenhados dots — usado no date picker da vista Targets onde os scores são irrelevantes.

### `renderMealTemplateList` como função partilhada (ui.js)
`openLogMeals()` (log.js) e `loadMeals()` (meals.js) partilhavam código de renderização de listas de templates quase idêntico. Extraído para `renderMealTemplateList(containerEl, templates, countMap, opts)` em `ui.js`.

`opts`:
- `showDelete: bool` — `true` mostra botão ✕ com listener; `false` mostra chevron `→` e o row inteiro é clicável
- `onItemClick: fn(t)` — chamado com o objecto template ao clicar (no row inteiro ou só no `.meal-tpl-info` quando `showDelete`)
- `onDeleteClick: fn(id)` — só obrigatório se `showDelete: true`; recebe `t.id`, com `stopPropagation`

O nome do template é sempre escrito via `.textContent` (XSS-safe). A sub-linha ("N alimentos") é construída com dados numéricos, safe para `innerHTML`.

---

## 9. Padrões de desenvolvimento

### Antes de cada push
```bash
node --check js/views/ficheiro_alterado.js
```
Detecta erros de sintaxe sem executar. Obrigatório para todos os ficheiros JS editados.

### Cache-busting
Cada `<script src="...?v=AAAAMMDD">` tem versão por data. Actualizar o `?v=` sempre que o ficheiro é modificado para garantir que o browser carrega a versão mais recente (especialmente em mobile, que faz cache agressivo).

### Supabase MCP (Claude Code)
Para alterações ao schema (criar tabelas, adicionar colunas, migrations), usar o MCP do Supabase directamente em Claude Code:
- `list_tables` — ver schema actual
- `apply_migration` — executar SQL
- `get_logs` — debug de erros
- Sempre fazer `list_tables` antes de criar tabelas novas para evitar duplicados.

### Hard refresh após deploy
Em mobile, após push para `main` com alterações ao CSS ou JS:
1. Ir às definições do browser
2. Limpar cache do site
3. Ou usar o botão "Limpar cache e recarregar" em Settings (chama `caches.delete()` + `location.reload(true)`)

### Adicionar uma nova view
1. Adicionar `<div id="view-X" class="view">` ao `index.html`
2. Adicionar botão ou item no `#view-mais` (ou nav) com `onclick="go('X')"`
3. Adicionar `if (view==='X') loadX();` no `go()` de `app.js`
4. Criar `js/views/X.js` com `function loadX() { ... }`
5. Adicionar `<script src="js/views/X.js?v=…">` antes de `app.js` em `index.html`

### Guard de concorrência por geração (funções async)
Funções assíncronas que escrevem no DOM usam um counter de geração para evitar race conditions quando são invocadas rapidamente em sequência (ex: navegação rápida entre datas):

```js
let loadXGen = 0;

async function loadX() {
  const gen = ++loadXGen;
  // ... um ou mais awaits ...
  if (gen !== loadXGen) return; // chamada mais recente já está a correr — abandonar
  // só chega aqui a invocação mais recente
  element.innerHTML = '...';
}
```

Aplicado actualmente em:
- `loadStats()` em `stats.js` — counter `loadStatsGen`
- `loadLogTotalsStrip()` em `log.js` — counter `loadTotalsGen`

Usar sempre que uma função async faz ≥1 await antes de escrever no DOM e pode ser invocada por eventos rápidos (navegação de datas, mudança de tab, etc.). O counter é declarado a nível de módulo (escopo global do ficheiro), não dentro da função.

### Adicionar um sheet (overlay)
Os sheets são criados uma vez via `document.createElement` dentro da função `openXxx()` com o padrão:
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
// populate content
overlay.classList.add('open');
```

---

## 10. Roadmap actual

### Concluído
- [x] Base de dados de alimentos (CRUD)
- [x] Diário com refeições + edição inline
- [x] Log com pesquisa, entrada rápida, recentes
- [x] Templates de refeições reutilizáveis
- [x] Sistema de targets modulares (DCB → daily_targets → PWA)
- [x] Vista Targets read-only com blocos como chips
- [x] Barras de macros clicáveis → nutrient ranking
- [x] Meal breakdown com donut SVG (P/H/G em espaço kcal)
- [x] Date picker com score de cor por dia
- [x] Estatísticas 7 dias (médias + aderência + top alimentos)
- [x] Navbar reorganizada: Mais → Targets, Stats, Settings

### Pendente / Ideias
- [ ] **Stats — alargar período**: selector de 7/14/30 dias em `#view-stats`
- [ ] **Stats — tendência de peso**: integrar dados ICU wellness (se MCP disponível)
- [ ] **Notificações PWA**: lembrete de registo no diário (Service Worker)
- [ ] **Export**: CSV ou JSON do diário para análise externa
- [ ] **Múltiplos utilizadores**: actualmente hardcoded para José; RLS necessária

---

## 11. Contexto do utilizador

**José (Dud)**, 26 anos, 184cm, Rio Maior, Portugal.

**Trabalho:** Lidl, turnos variáveis (manhã / tarde / duplo). Horas reais determinam o bloco `work` do target. O DCB lê o calendário Google "trabalho" automaticamente antes de fazer push.

**Treino:** Corredor de endurance (foco maratona Porto, 8 Nov 2026). Ginásio full body A/B/C/D, foco hypertrophy upper body. Turnos Lidl + corrida + ginásio integrados no mesmo sistema de blocos calóricos.

**Fase nutricional actual:** **3.5** (desde 14 Mai 2026)
- Objectivo: **surplus +150 kcal** sobre TDEE
- Excepção: dias de corrida com `run_race` → sem surplus (0)
- Macros locked: **P 175g, F 65g**, C residual
- Revisão prevista em Fase 4

**Padrão de sono:** estruturalmente tardio (01h–02h). O DCB nunca sugere treino cedo.

**PRs relevantes:**
- 5K: 20:15 (target: sub-20 — suspenso até pós-Porto)
- 10K: 42:34 (Scalabis Night Race, 18 Abr 2026)
- Maratona: estreia em Porto, 8 Nov 2026

**Métricas dinâmicas** (peso, BF%, HRV, RHR, VO2Max, ACWR): vivem no Intervals.icu wellness — não duplicar no NutriTrack. Consultar via MCP `intervals-icu` no DCB.

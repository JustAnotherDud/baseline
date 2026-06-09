# Baseline — DESIGN.md

> Documento de referência de design e convenções. Companion do `baseline-handoff.md`.
> Estado: Junho 2026 · v2.0.0

Baseline é um instrumento, não uma app de consumo. Cada decisão de design serve três palavras: **legível, exacto, sem ruído**. O número é a interface; tipo, cor e layout existem para tornar números instantaneamente legíveis a um braço de distância, com uma mão, no meio de outra tarefa.

---

## 1. Paleta de cores

Todas as cores vivem em `:root` de `css/styles.css`. **Nunca usar hex directo em CSS novo** — sempre `var(--…)`. Excepção única: canvas de Chart.js (ver §7).

### 1.1 Superfícies e estrutura

| Variável | Valor | Uso |
|---|---|---|
| `--bg` | `#0f0f0f` | Fundo da app, headers sticky |
| `--surface` | `#1a1a1a` | Sheets, nav bar |
| `--surface2` | `#222` | Cards (.msc, .treino-card), inputs, chips de dados, fundo de tooltip |
| `--surface3` | `#2a2a2a` | Tracks de barras vazias, handle de sheet, dots sem dados |
| `--border` | `#2e2e2e` | Todas as bordas e divisores. 1px, sempre |

Regra de profundidade: cada nível de elevação sobe um degrau (`bg → surface → surface2 → surface3`). Não saltar níveis nem inventar cinzentos novos.

### 1.2 Texto

| Variável | Valor | Uso |
|---|---|---|
| `--text` | `#f0f0f0` | Valores primários, nomes de alimentos, títulos |
| `--text2` | `#bbb` | Texto secundário, labels de settings, legendas de chart |
| `--text3` | `#9a9a9a` | Labels mono uppercase, metadados, hints, placeholders |

Hierarquia de leitura: o valor é `--text` (ou cor semântica), o contexto à volta é `--text3`. `--text2` é o intermédio raro — usar quando `--text3` seria ilegível num bloco maior de texto.

### 1.3 Cores semânticas — cor é informação, nunca decoração

| Variável | Valor | Significado fixo |
|---|---|---|
| `--accent` | `#4ade80` | **On-target / acção primária / calorias / fibra.** Verde só significa "dentro do alvo" ou "este é o botão principal" |
| `--blue` | `#60a5fa` | **Proteína.** Sempre. Também HRV (chart) |
| `--yellow` | `#fbbf24` | **Hidratos.** Também estado "perto do alvo" (near-miss) |
| `--orange` | `#fb923c` | **Gordura.** Também ATL/Fadiga |
| `--red` | `#f87171` | Fora do alvo, excesso, delete, TSB negativo |
| `--accent-ink` | `#0a0a0a` | Texto sobre fundos accent (botões primários, dia seleccionado no picker) |

Variantes alfa do accent: `--accent-a06/-a08/-a12` — fundos subtis de zonas tappable relacionadas com a acção primária (`+ LOG`, phase badge). Escala: a06 repouso, a12 pressed.

Cores fora do sistema (usar apenas nos contextos exactos onde já existem):
- `#f97316` — gordura saturada (`mbf.gs`, segmento central da barra de fat)
- `#e879f9` — açúcar (`mbf.a`, `.mp-val.a`)
- `#a3845a` — keyword "Integral" em nomes de alimentos
- `#22c55e` — centro verde da barra segmentada de calorias

### 1.4 Vocabulário de macros (imutável)

```
P / Proteína  → --blue
C / Hidratos  → --yellow
F / Gordura   → --orange
kcal / Fibra  → --accent
```

A cor nunca é o único portador de significado: cada valor colorido vem sempre acompanhado do label mono (P/C/F) ou da unidade. Requisito de acessibilidade e de legibilidade ao sol.

### 1.5 Estados de aderência (semáforo)

Calculados por `getNutrientColor(nutrient, pct)` em `nutrition.js`. As zonas variam por nutriente (a tolerância de gordura é mais larga que a de calorias):

| Nutriente | Verde | Amarelo | Vermelho |
|---|---|---|---|
| calories | 90–110% | 80–90 / 110–120 | resto |
| protein | 86–130% | 63–86 / 130–150 | resto |
| fat | 85–160% | 54–85 / 160–200 | resto |
| carbs | 85–135% | 70–85 / 135–150 | resto |
| fiber | ≥90% | ≥70% | <70% |

Estas zonas alimentam: cor do número de kcal no diário, barras de stats, dots do date picker e da aderência calórica. **Qualquer novo elemento que mostre aderência usa esta função, não thresholds próprios.**

---

## 2. Tipografia

Duas famílias, papéis rígidos:

| Variável | Fonte | Papel |
|---|---|---|
| `--mono` | IBM Plex Mono (400/500/600) | **Todos os números e dados.** Labels técnicos uppercase. Datas curtas, unidades, percentagens |
| `--sans` | DM Sans (300–600) | Prosa de UI: nomes de alimentos, labels de settings, botões, nav |

Teste rápido: se o conteúdo pode mudar de valor (número, data, percentagem) ou é um label de sistema → mono. Se é linguagem → sans.

### 2.1 Escala e hierarquia

A hierarquia é transportada por **escala e peso**, não por cor nem decoração:

| Nível | Tamanho/peso | Exemplo |
|---|---|---|
| Hero | 48px / 600 mono | kcal do dia (`.diary-kcal-num`) |
| Destaque | 42px / 600 mono | kcal na view Targets |
| Valor de célula | 22px / 600 mono | macros no grid do diário |
| Valor de chip | 16px / 600 | `.msc` (CTL, peso, etc.) |
| Corpo | 13–15px sans | nomes, listas, botões |
| Metadado | 11–12px mono `--text3` | detalhes de entrada, targets `/175g` |
| Label de secção | 9–11px mono uppercase, letter-spacing .08–.2em, `--text3` | `DIÁRIO`, `FORMA ACTUAL`, `PROT` |

Labels mono uppercase ficam **quietos** (pequenos, text3, espaçados); é o valor ao lado que grita. Nunca aumentar o label para dar ênfase — aumentar o valor.

### 2.2 Desktop (≥768px)

Media query única escala tudo proporcionalmente (~1.4×). Não é um layout novo — é a mesma hierarquia maior. Qualquer componente novo precisa de entrada nesta media query se tiver tamanhos de fonte próprios.

---

## 3. Componentes

### 3.1 View header (`.view-header`)

Sticky ao topo, `--bg`, border-bottom. Título em `.view-title` (mono 15px uppercase). Views internas (Targets, Stats, Settings) levam botão `←` à esquerda que faz `go('mais')`. O header do Diário é a variante rica: eyebrow + data por extenso + weekday, com pill de navegação temporal à direita.

### 3.2 Barra segmentada (`buildSegmentedBar` em ui.js)

O componente de aderência central. Anatomia:
- Fundo dividido em 5 segmentos fixos: extremos quase invisíveis (`rgba(255,255,255,0.06)`) → near-miss na cor do macro a 35% alfa → centro sólido na cor do macro.
- Indicador de posição: linha branca vertical + tick `▼`, posicionado pela % actual/target.
- Labels numéricos por baixo nos limites da zona verde (ex.: `150 … 228`).

Duas densidades: primária (10px, no resumo de kcal) e compacta dentro de `.macro-cell` (4px, sem tick, labels escondidos em <480px). As zonas vêm de `ZONES` na própria função — **espelham `getNutrientColor` e têm de mudar em conjunto**.

### 3.3 Chips de dados (`.msc` / `tChip()`)

O bloco de "número com contexto" usado em Forma, Pesagem, Resumo 7 dias e Wellness:
- Estrutura: label mono 9px uppercase `--text3` → valor 16px/600 → linha extra opcional (delta, unidade pequena).
- Fundo `--surface2`, border, radius 10px.
- Tappable: classe `.msc-tap` + `:active` para `--surface3`. Só adicionar tap se abre detalhe real (sheet).
- Grid de 4: `.stat-row-4`. Grid flexível: `.macro-secondary`.
- Deltas: `↑`/`↓` + valor, 10px mono. Cor por semântica do contexto (mais carga = verde em treino; ver §5.4 para o caso do peso).

Gerar sempre via `tChip(label, valHtml, extraHtml, opts)` em vez de HTML manual.

### 3.4 Bottom sheets (`.sheet-overlay` + `.sheet`)

O padrão modal único da app. Não existem dialogs centrados nem páginas de formulário — tudo o que é contextual sobe de baixo.

Anatomia: overlay `rgba(0,0,0,.65)` → sheet `--surface`, radius 20px topo, handle de 36px, header com `.sheet-title` (mono uppercase) e `×` (área de toque 44px), conteúdo com `max-height` 80–93dvh e scroll próprio.

Comportamento obrigatório:
1. **`pushSheetState()` ao abrir** — para o back button de Android fechar o sheet antes de navegar (ver §4.3).
2. Fechar por: tap no overlay, `×`, back button.
3. Criação lazy: o overlay é criado uma vez por `id` e reutilizado; handlers que dependem de dados frescos são re-bound a cada abertura (ver `openMealBreakdown`).
4. Animação: overlay fade .25s, sheet slide-up `cubic-bezier(0.32,0.72,0,1)` .35s. Respeitar `prefers-reduced-motion` (já global).

Camadas z-index (respeitar ao criar sheets novos):

| z | Quem |
|---|---|
| 100 | nav |
| 200 | sheets base (log, food, edit) |
| 210 | log-meals |
| 220 | apply-meal |
| 250 | meal-create |
| 300 | date picker |
| 400 | toast |

Regra: um sheet aberto a partir de outro sheet fica num z superior.

### 3.5 Date picker (`openDatePicker(value, onSelect, opts)`)

Sheet de calendário mensal. Semana começa em segunda. Dia seleccionado: círculo accent sólido com `--accent-ink`. Hoje: outline accent. Fins-de-semana: fundo `.cal-weekend`. Dots de score por dia (verde/amarelo/vermelho/neutro via `getDayScores`) — desactivar com `opts.showScores: false` quando o score não é relevante (view Targets).

### 3.6 Nutrient ranking sheet (`openNutrientSheet`)

Ranking de alimentos por nutriente: agrupado por `food_name`, barra proporcional ao máximo, % do total, expansão `▸/▾` para múltiplas entradas do mesmo alimento com a refeição de cada uma. Valor colorido pela cor do nutriente (`NUTRIENT_MAP`).

### 3.7 Donut de refeição (`openMealBreakdown`)

SVG construído à mão (não Chart.js): fatias F/C/P em espaço kcal (P×4, C×4, F×9), kcal total no centro, labels nas fatias >15%. Tap numa fatia filtra e re-ordena a lista de alimentos por esse macro (toggle). Legenda com dots + gramas + %.

### 3.8 Meal section (diário)

Card com border, header dividido: esquerda (nome mono uppercase + kcal inline + linha `F · C · P`) abre breakdown se tem entradas, abre log se vazia; direita (`+ LOG`, fundo `--accent-a06`) abre sempre o log. Entradas com zebra striping subtil (`rgba(255,255,255,0.03)` em even), tap abre edição.

### 3.9 Botões

| Classe | Aspecto | Uso |
|---|---|---|
| `.btn-primary` | accent sólido, ink escuro | Uma por contexto: a acção que conclui |
| `.btn-secondary` | `--surface2` + border | Tudo o resto |
| `.btn-danger` | transparente, texto+borda red | Destruição. Sempre precedido de `confirm()` |

`:active` = opacity .8 + scale .98. Sem estados hover elaborados — é touch-first.

### 3.10 Chips de filtro (`.sort-chip`, `.meal-tab`)

Pill com border; activo = accent sólido + ink. Scroll horizontal sem scrollbar quando não cabem. Sort chips alternam direcção no segundo tap (ver `SORT_CONFIG`).

### 3.11 FAB

Círculo accent 52px, fixo acima da nav, sombra accent a 25%. Existe **um** na app inteira (criar alimento). Não multiplicar.

### 3.12 Toast

Pill centrado acima da nav, `aria-live="polite"`, 2.4s, animação in/out. Mensagens curtas em pt-PT: `Guardado ✓`, `Erro ao guardar`. É o único mecanismo de feedback — sem banners, sem alerts (excepto `confirm()` destrutivo).

### 3.13 Empty states

Discretos e accionáveis: mono 12px `--text3`, uma linha, e quando aplicável dizem o que fazer (`Configura o Intervals.icu nas Settings`). Nunca ilustrações grandes nem tom motivacional. Cada secção da view Forma degrada com o seu próprio empty state sem afectar as vizinhas.

---

## 4. Padrões de interacção

### 4.1 Navegar vs abrir sheet

| Acção | Padrão |
|---|---|
| Mudar de contexto de trabalho (Diário ↔ Comida ↔ Forma) | `go(view)` — bottom nav |
| Views secundárias sem nav própria (Targets, Stats, Settings) | `go(view)` a partir de "Mais", com `←` de volta |
| Acção contextual sobre o ecrã actual (registar, editar, escolher data, ver detalhe) | Sheet |

Heurística: se quando fechas voltas exactamente onde estavas, é sheet. Se mudas de "onde estou na app", é `go()`.

### 4.2 Hot path de logging

O fluxo mais frequente da app; cada decisão protege-o:
- `+ LOG` em qualquer refeição → sheet já com essa refeição seleccionada (`openLogForMeal`).
- Sem refeição explícita, `getMealByHour()` pré-selecciona pela hora local.
- Refeição **sticky**: depois de guardar, o sheet volta à pesquisa sem fechar, mantendo data e refeição — registar uma refeição inteira é uma sequência de pesquisa→gramas→guardar sem reabrir nada.
- Input de gramas aceita expressões (`120+85`) via `parseGramsExpr` + botões de operador — pesar por adição é o caso real na cozinha.
- Auto-focus com `setTimeout(…,300)` (esperar a animação do sheet) em todos os inputs de entrada.
- Totais do dia visíveis no topo do sheet (`log-totals-strip`) — decidir a porção contra o que falta.

### 4.3 Back button (Android)

Hash router mínimo em `app.js`:
- `go(view)` faz `pushState({view}, '', '#view')`.
- Abrir sheet faz `pushSheetState()` (entrada extra no histórico).
- `popstate`: se há sheet aberto, fecha-o; senão, navega para o hash.

Consequência: **todo o overlay novo tem de chamar `pushSheetState()`**, senão o back button salta a view por baixo dele.

### 4.4 Toque

- Alvos ≥44×44px (botões de navegação de data, `×` de sheets com margem negativa para expandir a área).
- `-webkit-tap-highlight-color: transparent` global; feedback via `:active` explícito.
- Uma mão: acções primárias na metade inferior (nav, FAB, botões de sheet no fundo).
- `:focus-visible` com outline accent para teclado/AT.

### 4.5 Movimento

Transições curtas e funcionais: view fade .18s, sheet .35s, barras `width .4s`. Charts 400ms. `prefers-reduced-motion` mata tudo globalmente (CSS) e os charts (`chartAnim()`). Sem animações celebratórias — nada na app "festeja".

---

## 5. Convenções de dados

### 5.1 Ordem canónica de macros

**F · C · P** (gordura, hidratos, proteína) em toda a exibição compacta: linha de refeição, detalhe de entrada, totals strip, macro-preview (depois de kcal), legenda do donut, grid do diário.

> Excepção conhecida: a view Stats usa P/C/F — é uma inconsistência a corrigir, não um segundo padrão a imitar.

### 5.2 Abreviações e unidades

- `P` `C` `F` nos contextos compactos; `Proteína` `Hidratos` `Gordura` em formulários e rows de targets.
- kcal sempre inteiro (`Math.round`). Gramas de macros: inteiro em displays compactos, 1 decimal em snapshots/edição (`Math.round(x*10)/10`). Peso corporal e BF%: 1 decimal fixo (`toFixed(1)`).
- Volume de ginásio em toneladas: `(kg/1000).toFixed(1) + ' t'`.
- Tempo de actividade: `h:mm`.
- Restante vs excesso: `123↓ rest.` (text2) vs `+45 excesso` / `+12↑` (cor do nutriente).

### 5.3 Datas

- Armazenamento e chaves: `YYYY-MM-DD` sempre.
- Display: pt-PT por extenso (`9 de Junho`), curto `dd/mm` em charts e listas, weekday por extenso no header.
- **Parsing seguro**: construir datas locais com `new Date(str + 'T12:00:00')` (truque do meio-dia evita rollover de timezone). Gerar "hoje" deve usar componentes locais — não `toISOString()` (bug conhecido pós-meia-noite em UTC+1).
- Semana começa segunda-feira (picker, resumo semanal).

### 5.4 Semântica de deltas

- Treino (km, tempo, carga, volume): mais = `↑` verde, menos = `↓` vermelho.
- Peso: actualmente ↑ vermelho / ↓ verde — **semântica de cut hardcoded**; em fase de surplus está invertida. Decisão pendente: tornar phase-aware (ler `objetivo` de `phases`) ou neutralizar a cor.

### 5.5 Língua

pt-PT em toda a UI, incluindo toasts e empty states. Norma pré-acordo (`actual`, `acção`, `objectivo`) — consistente com o resto do projecto. Código e comentários: pt-PT nos comentários, inglês nos identificadores.

### 5.6 Keywords destacadas em nomes de alimentos

`highlightFoodKeywords` (ui.js): `Light`/`Zero` → text3, `Integral` → `#a3845a`, `Proteico/a` → blue. É também a função de escaping de nomes — **usar sempre que um `food_name` entra em `innerHTML`**.

---

## 6. Decisões de arquitectura e raciocínio

**Script tags + escopo global, sem build.** O custo de um bundler (toolchain, CI, debugging de sourcemaps) não se paga num projecto de um utilizador editado por sessões curtas. O preço aceite: ordem de carregamento manual (documentada no index), cache-busting manual `?v=AAAAMMDD[-n]`, e disciplina de namespacing por prefixo (`t*`, `body*`, `mc*`).

**Snapshot no diário.** Cada registo copia os valores nutricionais no momento (`/100 × g`). Editar um alimento em `foods` nunca reescreve história — o diário é um livro-razão, não uma view. Consequência: correcções a alimentos só afectam registos futuros, por design.

**`daily_targets` é read-only para a PWA.** O DCB (Claude Desktop + sync_hub) é a única fonte de escrita. A app não calcula targets — exibe-os. Isto mantém uma única fonte de verdade para a lógica nutricional e impede divergência entre o que o coach calcula e o que a app mostra. Sem row para a data = "sem target", nunca fallback silencioso.

**Guard de concorrência por geração.** Todas as funções `loadX` async incrementam `loadXGen` e descartam resultados stale (`if (gen !== loadXGen) return`). Protege contra navegação rápida + respostas fora de ordem sem AbortController. Padrão obrigatório em qualquer view loader novo.

**Integrações tolerantes a falha.** ICU/Hevy: fetches paralelos com `.catch(() => null)`; cada secção degrada sozinha com empty state próprio. A app nunca fica em branco porque uma API externa caiu. Toggles ON/OFF por integração nas Settings cortam o fetch na origem.

**Charts: destruir antes de re-render; hex directo no canvas.** Chart.js não resolve `var(--…)` dentro do canvas — `chartTheme` lê os tokens computados uma vez. Instâncias guardadas em variáveis e `destroy()` antes de cada rebuild evita leaks e canvas a 0px.

**Sheets lazy + reutilizados.** Criados uma vez por `id`, anexados ao body, reabertos com `.open`. Handlers com dados captados em closure (não JSON em atributos HTML) — ver `mcSearchFood` para o padrão correcto.

**Credenciais em localStorage, RLS permissivo.** Aceitável porque: utilizador único, key publishable (não service role), nada no repositório. O ecrã de setup é a fronteira — a app sem credenciais é um shell vazio, não um erro.

---

## 7. Checklist para componentes novos

1. Cores via `var(--…)`; semântica de macro/estado respeitada (§1.3–1.5).
2. Números em mono; labels pequenos uppercase text3; hierarquia por escala (§2).
3. Se é overlay: sheet com handle, `pushSheetState()`, fecho por overlay/×/back, z-index correcto (§3.4).
4. Se carrega dados async: guard de geração + empty state próprio + degradação isolada (§6).
5. Alvos de toque ≥44px; `:active` visível; `prefers-reduced-motion` respeitado.
6. Texto pt-PT; datas `dd/mm` ou por extenso; macros F·C·P; kcal inteiro.
7. `food_name` em `innerHTML` só via `highlightFoodKeywords`.
8. Bump de `?v=` em todos os ficheiros tocados.

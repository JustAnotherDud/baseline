# Design

Baseline é um instrumento, não uma app de consumo. Três palavras: **legível, exacto, sem ruído**. O número é a interface.

## 1. Cor

Todas as cores vivem em `:root` de `css/styles.css`. CSS novo usa sempre `var(--…)`. Única excepção: o canvas do Chart.js (ver §6).

### 1.1 Superfícies

| Variável | Valor | Uso |
|---|---|---|
| `--bg` | `#0f0f0f` | Fundo, headers sticky |
| `--surface` | `#1a1a1a` | Sheets, nav |
| `--surface2` | `#222` | Cards, inputs, chips de dados |
| `--surface3` | `#2a2a2a` | Barras vazias, handle de sheet, dots sem dados |
| `--border` | `#2e2e2e` | Bordas e divisores, sempre 1px |

Cada nível de elevação sobe um degrau. Não inventar cinzentos.

### 1.2 Texto

| Variável | Valor | Uso |
|---|---|---|
| `--text` | `#f0f0f0` | Valores, nomes, títulos |
| `--text2` | `#bbb` | Texto secundário, legendas |
| `--text3` | `#9a9a9a` | Labels mono, metadados, hints |

O valor é `--text` (ou cor semântica); o contexto é `--text3`.

### 1.3 Cores semânticas

| Variável | Significado |
|---|---|
| `--accent` `#4ade80` | Dentro do alvo, acção primária, kcal, fibra |
| `--blue` `#60a5fa` | Proteína |
| `--yellow` `#fbbf24` | Hidratos; perto do alvo |
| `--orange` `#fb923c` | Gordura; ATL |
| `--red` `#f87171` | Fora do alvo, excesso, apagar, TSB negativo |
| `--accent-ink` `#0a0a0a` | Texto sobre fundo accent |

Alfas do accent (`--accent-a06/-a08/-a12`): fundos de zonas tappable ligadas à acção primária.

Fora do sistema, só onde já existem: `#e879f9` (açúcar na entrada rápida) e `#a3845a` (keyword "Integral").

A cor nunca é o único sinal: cada valor colorido leva o label (P/C/F) ou a unidade.

### 1.4 Aderência

`getNutrientColor(nutrient, pct)` em `nutrition.js` é a única fonte das zonas:

| Nutriente | Verde | Amarelo | Vermelho |
|---|---|---|---|
| calories | 90–110% | 80–90 / 110–120 | resto |
| protein | 86–130% | 63–86 / 130–150 | resto |
| fat | 85–160% | 54–85 / 160–200 | resto |
| carbs | 85–135% | 70–85 / 135–150 | resto |
| fiber | ≥90% | ≥70% | <70% |

Qualquer elemento novo que mostre aderência usa esta função.

## 2. Tipografia

| Variável | Fonte | Papel |
|---|---|---|
| `--mono` | IBM Plex Mono | Números, datas, unidades, labels de sistema |
| `--sans` | DM Sans | Nomes, labels de settings, botões, nav |

Se pode mudar de valor, é mono. Se é linguagem, é sans.

| Nível | Tamanho | Exemplo |
|---|---|---|
| Hero | 36px/600 mono | kcal do dia no Diário |
| Destaque | 42px/600 mono | kcal em Targets |
| Célula | 22px/600 mono | macros do diário |
| Chip | 16px/600 | `.msc` |
| Corpo | 13–15px sans | nomes, listas, botões |
| Metadado | 11–12px mono `--text3` | detalhes de entrada |
| Label | 9–11px mono uppercase `--text3` | `FORMA ACTUAL`, `PROT` |

Hierarquia por escala e peso, não por cor. O label fica quieto; o valor grita.

Desktop (≥768px): uma media query escala tudo ~1.4×. Componente com tamanhos próprios precisa de entrada lá.

## 3. Componentes

- **View header** (`.view-header`): sticky, título mono uppercase. Views internas (Targets, Stats, Settings) têm `←` para `go('mais')`.
- **Resumo de macros** (`renderToday`): kcal com cor de aderência e grid de 3 macros. Proteína e gordura são mínimos: abaixo mostra `−Xg ↓` e %, atingido mostra `✓`. Hidratos são residuais: % neutra, nunca sinalizados.
- **Chips de dados** (`tChip(label, valHtml, extraHtml, opts)`): label 9px, valor 16px, linha extra opcional. `.msc-tap` só se abre detalhe real. Grid de 4: `.stat-row-4`.
- **Sheets** (`.sheet-overlay` + `.sheet`): o único padrão modal. Criar com `ensureSheet`. Abrir chama `pushSheetState()`. Fecha por overlay, `×` ou Voltar. Um sheet aberto a partir de outro fica num z superior.

| z | Quem |
|---|---|
| 100 | nav |
| 200 | sheets base |
| 210 | log-meals |
| 220 | apply-meal |
| 250 | meal-create |
| 300 | date picker |
| 400 | toast |

- **Date picker** (`openDatePicker(value, onSelect, opts)`): semana começa à segunda. Dots de score por dia; `opts.showScores: false` desliga.
- **Ranking de nutriente** (`openNutrientSheet`): agrupa por `food_name`, barra proporcional ao máximo, expande entradas repetidas.
- **Donut de refeição** (`openMealBreakdown`): SVG à mão em espaço kcal (P×4, C×4, F×9). Tap numa fatia filtra e ordena a lista.
- **Botões**: `.btn-primary` (um por contexto), `.btn-secondary`, `.btn-danger` (sempre com `confirm()`). `:active` = opacity .8 e scale .98.
- **Chips de filtro** (`.sort-chip`): activo = accent sólido. Segundo tap inverte a ordem.
- **FAB**: um só na app (criar alimento).
- **Toast**: único feedback, 2.4s, `aria-live="polite"`. Frases curtas: `Guardado ✓`.
- **Empty states**: uma linha mono `--text3` que diz o que fazer. Sem ilustrações nem tom motivacional.

## 4. Interacção

- Mudar de contexto (Diário, Comida, Forma) é `go(view)`. Acção sobre o ecrã actual é sheet.
- Hot path de registo: `+ LOG` abre o sheet já na refeição; sem refeição, `getMealByHour()` escolhe. Depois de guardar, o sheet volta à pesquisa sem fechar. Gramas aceitam expressões (`120+85`). Auto-focus com `setTimeout(…, 300)`.
- Voltar do Android: `go()` faz `pushState`; abrir sheet faz `pushSheetState()`; `popstate` fecha o sheet aberto ou navega.
- Alvos de toque ≥44px, `:active` visível, `:focus-visible` com outline accent.
- Movimento curto e funcional. `prefers-reduced-motion` desliga tudo (CSS e `chartAnim()`). Nada festeja.

## 5. Dados

- Ordem de macros: **F · C · P** em toda a exibição compacta.
- `P` `C` `F` em contextos compactos; `Proteína` `Hidratos` `Gordura` em formulários.
- kcal inteiro. Macros inteiros em displays, 1 decimal em snapshots. Peso e BF% com 1 decimal.
- Volume de ginásio em toneladas (`t`). Tempo em `h:mm`.
- Datas: `YYYY-MM-DD` locais para guardar; `dd/mm` ou por extenso para mostrar. Parse com `new Date(str + 'T12:00:00')`.
- Deltas de treino: mais é `↑` verde, menos é `↓` vermelho. Delta de peso é neutro (`--text3`).
- pt-PT pré-acordo (`actual`, `acção`) na UI. Identificadores em inglês.
- `food_name` entra em `innerHTML` só por `highlightFoodKeywords` (escapa e destaca Light, Zero, Integral, Proteico/a).

## 6. Arquitectura

- **Sem build.** Um utilizador, sessões curtas: um bundler não se paga. Preço: ordem de scripts manual, `bump.js` para cache-busting, prefixos por módulo (`t*`, `body*`, `mc*`).
- **Diário em snapshot.** O diário é um livro-razão: corrigir um alimento só afecta registos futuros.
- **`daily_targets` só de leitura.** Uma fonte de verdade para a lógica nutricional. Sem linha para a data = sem target, nunca fallback.
- **Guard de geração** em todo o loader async: descarta respostas fora de ordem.
- **Integrações tolerantes a falha**: cada secção degrada sozinha. Toggles em Settings cortam o fetch.
- **Charts**: `destroy()` antes de refazer; cores hex lidas de `:root` uma vez (`chartTheme`), porque o canvas não resolve `var(--…)`.
- **Login obrigatório, RLS para `authenticated`**: utilizador único. Sem sessão a app é um ecrã de login, não um erro.

## 7. Checklist para componentes novos

1. Cores por `var(--…)`, semântica de macros respeitada.
2. Números em mono; labels pequenos, uppercase, `--text3`.
3. Overlay: `ensureSheet`, `pushSheetState()`, z correcto.
4. Dados async: guard de geração e empty state próprio.
5. Toque ≥44px; `prefers-reduced-motion` respeitado.
6. pt-PT; macros F·C·P; kcal inteiro.
7. `food_name` só por `highlightFoodKeywords`.
8. `node bump.js` antes do push.

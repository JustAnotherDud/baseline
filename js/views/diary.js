let diaryEntries = [];
const mealToggles = new Map();   // id da refeição -> encolhida (só desta sessão, nada se guarda)

const NUTRIENT_MAP = {
  calories: { key: 'calories', label: 'Calorias', unit: 'kcal', color: 'var(--accent)' },
  protein:  { key: 'protein',  label: 'PROT',  unit: 'g',    color: 'var(--blue)'   },
  carbs:    { key: 'carbs',    label: 'CARBS', unit: 'g',    color: 'var(--yellow)' },
  fat:      { key: 'fat',      label: 'FAT',   unit: 'g',    color: 'var(--orange)' },
  fiber:    { key: 'fiber',    label: 'Fibra',     unit: 'g',    color: 'var(--accent)' },
};

function renderToday(entries, t) {
  diaryEntries = entries;
  const tot = {kcal:0, fat:0, carb:0, prot:0};
  entries.forEach(e => {
    tot.kcal  += +e.calories;
    tot.fat   += +e.fat;
    tot.carb  += +e.carbs;
    tot.prot  += +e.protein;
  });

  const r = n => Math.round(n);
  const hasTargets = t.calories > 0;
  const hasData = entries.length > 0;
  const rawPct = (v, m) => m > 0 ? v / m * 100 : 0;

  // ── CALORIES ──
  const kcalNum = r(tot.kcal);
  const kcalPct = rawPct(tot.kcal, t.calories);
  const kcalColor = (hasTargets && hasData) ? getNutrientColor('calories', kcalPct) : 'var(--accent)';
  let kcalRight = '';
  if (hasTargets) {
    const diff = t.calories - kcalNum;
    const pct  = Math.round(kcalPct);
    const restHTML = diff >= 0
      ? `<span style="color:var(--text2)">${diff}↓ rest.</span>`
      : `<span style="color:var(--accent)">+${Math.abs(diff)} excesso</span>`;
    kcalRight = `<span style="margin-left:auto;display:inline-flex;align-items:baseline;gap:6px;font-size:12px;font-family:var(--mono)">${restHTML}<span style="color:var(--text3)">${pct}%</span></span>`;
  }

  // ── MACROS (grid) ──
  // Hierarquia: P e F são floors mínimos (passar é ok, abaixo é o sinal);
  // hidratos é residual (o que sobra, nunca sinalizado). Ver PRODUCT.md.
  const macros = [
    { key: 'fat',     label: 'FAT',   actual: tot.fat,  floor: t.fat,     color: 'var(--orange)', role: 'floor'    },
    { key: 'carbs',   label: 'CARBS', actual: tot.carb, target: t.carbs,  color: 'var(--yellow)', role: 'residual' },
    { key: 'protein', label: 'PROT',  actual: tot.prot, floor: t.protein, color: 'var(--blue)',   role: 'floor'    },
  ];
  const cellsHTML = macros.map((m, i) => {
    const pad = i === 0 ? 'padding-right:8px' : 'padding-left:10px;padding-right:4px';
    const val = r(m.actual);
    let topRight = '';   // linha 1, junto ao nome: percentagem
    let valLine  = '';   // linha 2: valor (cor da macro) + referência

    if (m.role === 'residual') {
      // Hidratos: cor própria + % informativa (neutra) — nunca sinalizado.
      const pct = (hasTargets && m.target > 0) ? Math.round(rawPct(m.actual, m.target)) : null;
      if (pct !== null) topRight = `<span style="font-size:11px;color:var(--text3);font-family:var(--mono)">${pct}%</span>`;
      valLine = `<span class="macro-cell-val" style="color:${m.color}">${val}</span>`;
    } else {
      // Floor (P/F): abaixo → restante + %; atingido → só ✓.
      const tgtHTML = hasTargets ? `<span class="macro-cell-tgt" style="color:var(--text3)">≥${m.floor}</span>` : '';
      valLine = `<span class="macro-cell-val" style="color:${m.color}">${val}</span>${tgtHTML}`;
      const st = hasTargets ? macroFloorState(m.key, m.actual, m.floor) : null;
      if (st && st.status === 'below') {
        topRight = `<span style="display:inline-flex;align-items:baseline;gap:4px;font-family:var(--mono)"><span style="font-size:11px;color:var(--red)">−${st.deficit} ↓</span><span style="font-size:11px;color:var(--text3)">${st.pct}%</span></span>`;
      } else if (st) {
        topRight = `<span style="font-size:11px;color:var(--accent);font-family:var(--mono)">✓</span>`;
      }
    }

    return `<div class="macro-cell" data-nutrient="${m.key}" style="${pad}">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="macro-cell-label">${m.label}</span>
        ${topRight}
      </div>
      <div style="display:flex;align-items:baseline;gap:2px;margin-top:3px">
        ${valLine}
      </div>
    </div>`;
  }).join('');

  // Custo: só a partir de cost_tracking_start (antes não há custo registado).
  const showCost = !!costConfig && currentDate >= costConfig.start;
  // Total do dia no cabeçalho, ao lado do dia da semana. Sem badge de cobertura:
  // só se marca "≥ … · N%" (total mínimo) quando abaixo de cost_min_coverage (o total está incompleto).
  const costEl = document.getElementById('tot-cost');
  if (costEl) {
    if (showCost && hasData) {
      const cs = costSummary(entries);
      costEl.innerHTML = dayCostHtml(cs, costConfig.minCoverage);
      costEl.style.display = '';
    } else {
      costEl.style.display = 'none';
    }
  }

  const summary = document.querySelector('#view-today .macro-summary');
  summary.innerHTML = `
    <div class="diary-kcal-row" style="justify-content:flex-start;align-items:baseline;gap:8px">
      <span class="diary-kcal-num" id="tot-kcal" style="font-size:36px;color:${kcalColor}">${kcalNum}</span>
      <span class="diary-kcal-tgt" style="cursor:pointer" onclick="go('targets')" title="Ver baseline de manutenção">${hasTargets ? '/ ' + t.calories + ' kcal' : 'kcal'}</span>
      ${kcalRight}
    </div>
    <div class="macro-grid">${cellsHTML}</div>`;

  // Tap handlers → open nutrient ranking
  const kcalEl = summary.querySelector('#tot-kcal');
  kcalEl.style.cursor = 'pointer';
  kcalEl.onclick = () => openNutrientSheet(diaryEntries, NUTRIENT_MAP.calories);
  summary.querySelectorAll('.macro-cell').forEach(el => {
    const n = NUTRIENT_MAP[el.dataset.nutrient];
    if (!n) return;
    el.style.cursor = 'pointer';
    el.onclick = () => openNutrientSheet(diaryEntries, n);
  });

  const container = document.getElementById('diary-container');
  container.innerHTML = '';
  const visible = diaryMeals(currentMeals, entries, localDate());
  const openId = mealOpenDefault(visible, entries);
  visible.forEach(meal => {
    const mes = entries.filter(e => e.meal_id === meal.id);
    const mkcal = mes.reduce((s,e)=>s+ +e.calories,0);
    const mprot = mes.reduce((s,e)=>s+ +e.protein,0);
    const mcarb = mes.reduce((s,e)=>s+ +e.carbs,0);
    const mfat  = mes.reduce((s,e)=>s+ +e.fat,0);
    const div = document.createElement('div');
    div.className = 'meal-section';
    const kcalInline = mes.length > 0
      ? `<span class="meal-kcal-val">${r(mkcal)}</span>`
        + (showCost ? `<span class="meal-cost-val price" title="Custo da refeição">${formatEur(costSummary(mes).total)}</span>` : '')
      : '';
    // A hora vai na 2.ª linha (com os macros) para não apertar o nome no cabeçalho.
    const hm = fmtHM(meal.sort_at);
    const macroStr = mes.length > 0
      ? `<div class="meal-macros">${hm ? hm + ' · ' : ''}F ${r(mfat)} · C ${r(mcarb)} · P ${r(mprot)}</div>`
      : (hm ? `<div class="meal-macros">${hm}</div>` : '');
    // Encolhida por defeito, menos a mais recente com entradas; os toques ficam em mealToggles (sessão).
    const hasEntries = mes.length > 0;
    const collapsed = hasEntries && isMealCollapsed(meal.id, openId, mealToggles);
    // Chevron único (▼); roda para ▲ via CSS quando a refeição está aberta.
    const chevronBtn = hasEntries
      ? `<button class="meal-collapse-btn" aria-label="${collapsed ? 'Expandir' : 'Recolher'} refeição"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button>`
      : '';
    if (collapsed) div.classList.add('collapsed');
    div.innerHTML = `
      <div class="meal-header">
        <div class="meal-header-left">
          <div class="meal-head-line"><span class="meal-name">${escHtml(mealLabel(meal))}</span>${kcalInline}</div>
          ${macroStr}
        </div>
        ${chevronBtn}
        <button class="meal-edit-btn" aria-label="Editar refeição">✎</button>
        <div class="meal-header-right">
          <span class="meal-log-label">+ LOG</span>
        </div>
      </div>`;
    const leftEl  = div.querySelector('.meal-header-left');
    const rightEl = div.querySelector('.meal-header-right');
    const collapseBtn = div.querySelector('.meal-collapse-btn');
    // Toggle anima via CSS (classe .collapsed) — sem re-render, sem perder o estado.
    const toggle = () => {
      const nc = !div.classList.contains('collapsed');
      mealToggles.set(meal.id, nc);
      div.classList.toggle('collapsed', nc);
      if (collapseBtn) collapseBtn.setAttribute('aria-label', (nc ? 'Expandir' : 'Recolher') + ' refeição');
    };
    if (collapseBtn) collapseBtn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    leftEl.addEventListener('click', e => {
      e.stopPropagation();
      if (hasEntries) toggle();
      else openMealSheet(meal.id);
    });
    div.querySelector('.meal-edit-btn').addEventListener('click', e => {
      e.stopPropagation();
      openMealSheet(meal.id);
    });
    rightEl.addEventListener('click', e => {
      e.stopPropagation();
      openLogForMeal(meal.id);
    });

    if (!hasEntries) {
      const noEntry = document.createElement('div');
      noEntry.className = 'no-entries';
      noEntry.textContent = 'Sem registos';
      div.appendChild(noEntry);
    } else {
      // Entradas sempre no DOM, dentro de um wrapper colapsável (grid-rows).
      const wrap = document.createElement('div');
      wrap.className = 'meal-entries';
      const inner = document.createElement('div');
      inner.className = 'meal-entries-inner';
      mes.forEach(entry => {
        const entryEl = document.createElement('div');
        entryEl.className = 'diary-entry';
        entryEl.style.cursor = 'pointer';
        entryEl.innerHTML = `
          <div class="entry-info">
            <div class="entry-name"></div>
            <div class="entry-detail">${entry.grams ? entry.grams + 'g · ' : ''}F ${r(entry.fat)}g · C ${r(entry.carbs)}g · P ${r(entry.protein)}g</div>
            ${entry.has_tara ? '<div class="entry-tara-flag">⚖ tem tara</div>' : ''}
          </div>
          <div class="entry-right">
            <div class="entry-kcal">${r(entry.calories)}</div>
            ${showCost ? `<div class="entry-cost price${entry.cost_eur != null && +entry.cost_eur === 0 ? ' free' : ''}">${entryCostHtml(entry)}</div>` : ''}
          </div>`;
        entryEl.querySelector('.entry-name').innerHTML = highlightFoodKeywords(entry.food_name);
        entryEl.addEventListener('click', () => openEditEntry(entry.id));
        inner.appendChild(entryEl);
      });
      wrap.appendChild(inner);
      div.appendChild(wrap);
    }

    container.appendChild(div);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-secondary meal-add-btn';
  addBtn.textContent = '+ refeição';
  addBtn.addEventListener('click', () => openMealSheet(null));
  container.appendChild(addBtn);
}

function setDateLabel() {
  const d = new Date(currentDate+'T12:00:00');
  const fullEl = document.getElementById('today-date-full');
  if (fullEl) fullEl.textContent = d.toLocaleDateString('pt-PT',{day:'numeric',month:'long'});
  const costEl = document.getElementById('tot-cost');
  if (costEl) costEl.style.display = 'none'; // até o diário carregar (evita o total do dia anterior)
  const wdEl = document.getElementById('today-weekday');
  if (wdEl) wdEl.textContent = d.toLocaleDateString('pt-PT',{weekday:'long'});
  const moEl = document.getElementById('today-month');
  if (moEl) moEl.textContent = d.toLocaleDateString('pt-PT',{month:'short'}).replace('.','').toUpperCase();
}

function changeDay(delta) {
  const d = new Date(currentDate + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  currentDate = localDate(d);
  setDateLabel();
  loadToday();
}

function pickDate() {
  openDatePicker(currentDate, date => {
    currentDate = date;
    setDateLabel();
    loadToday();
  });
}

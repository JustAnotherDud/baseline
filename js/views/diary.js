let diaryEntries = [];

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
  const kcalBar = hasTargets ? buildSegmentedBar(tot.kcal, t.calories, 'calories') : '';
  let kcalLine2 = '';
  if (hasTargets) {
    const diff = t.calories - kcalNum;
    const pct  = Math.round(kcalPct);
    const restHTML = diff >= 0
      ? `<span style="font-size:12px;color:var(--text2)">${diff}↓ rest.</span>`
      : `<span style="font-size:12px;color:var(--accent)">+${Math.abs(diff)} excesso</span>`;
    kcalLine2 = `<div style="display:flex;justify-content:flex-end;align-items:baseline;gap:6px;margin-top:4px;font-family:var(--mono)">${restHTML}<span style="font-size:12px;color:var(--text3)">${pct}%</span></div>`;
  }

  // ── MACROS (grid) ──
  const macros = [
    { key: 'fat',     label: 'FAT',   actual: tot.fat,  target: t.fat,     color: 'var(--orange)' },
    { key: 'carbs',   label: 'CARBS', actual: tot.carb, target: t.carbs,   color: 'var(--yellow)' },
    { key: 'protein', label: 'PROT',  actual: tot.prot, target: t.protein, color: 'var(--blue)'   },
  ];
  const cellsHTML = macros.map((m, i) => {
    const pad = i === 0 ? 'padding-right:8px' : 'padding-left:10px;padding-right:4px';
    const tgtHTML = hasTargets ? `<span class="macro-cell-tgt" style="color:var(--text3)">/${m.target}g</span>` : '';
    const bar = hasTargets ? buildSegmentedBar(m.actual, m.target, m.key) : '';
    // Line 2: remaining / excess + percentage
    let line2 = '';
    if (hasTargets) {
      const diff = r(m.target - m.actual);
      const pct  = Math.round(rawPct(m.actual, m.target));
      const restHTML = diff >= 0
        ? `<span style="font-size:10px;color:var(--text2)">${diff}↓</span>`
        : `<span style="font-size:10px;color:${m.color}">+${Math.abs(diff)}↑</span>`;
      line2 = `<div style="display:flex;justify-content:flex-end;align-items:baseline;gap:4px;margin-top:3px;font-family:var(--mono)">${restHTML}<span style="font-size:10px;color:var(--text3)">${pct}%</span></div>`;
    }
    return `<div class="macro-cell" data-nutrient="${m.key}" style="${pad}">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="macro-cell-label">${m.label}</span>
        <span style="display:flex;align-items:baseline;gap:2px"><span class="macro-cell-val" style="color:${m.color}">${r(m.actual)}</span>${tgtHTML}</span>
      </div>
      ${line2}
      ${bar}
    </div>`;
  }).join('');

  const summary = document.querySelector('#view-today .macro-summary');
  summary.innerHTML = `
    <div class="diary-kcal-row">
      <span class="diary-kcal-num" id="tot-kcal" style="color:${kcalColor}">${kcalNum}</span>
      <span class="diary-kcal-tgt" style="cursor:pointer" onclick="go('targets')" title="Ver targets">${hasTargets ? '/ ' + t.calories + ' kcal' : 'kcal'}</span>
    </div>
    ${kcalLine2}
    <div id="bar-kcal-wrap">${kcalBar}</div>
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

  // ── STICKY MACRO BAR (dois chips: calorias + macros) ──
  const sticky = document.getElementById('today-sticky');
  if (sticky) {
    // CHIP 1 — calorias
    const kCol = hasTargets ? getNutrientColor('calories', kcalPct) : 'var(--accent)';
    let kcalRight = '';
    if (hasTargets) {
      const diff = t.calories - kcalNum;
      const restHTML = diff >= 0
        ? `<span style="color:var(--accent)">${diff}↓</span>`
        : `<span style="color:var(--red)">+${Math.abs(diff)}↑</span>`;
      kcalRight = `<span style="display:inline-flex;align-items:baseline;gap:6px;font-size:11px">${restHTML}<span style="color:${kCol}">${Math.round(kcalPct)}%</span></span>`;
    }
    const kcalBar = hasTargets
      ? `<div style="height:3px;border-radius:2px;background:var(--surface2);overflow:hidden;margin-top:6px"><div style="height:100%;width:${Math.min(100, kcalPct).toFixed(1)}%;background:${kCol}"></div></div>`
      : '';
    const chip1 = `
      <div id="sticky-chip-kcal" style="background:var(--surface);border-radius:10px;padding:9px 12px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="display:inline-flex;align-items:baseline;gap:4px">
            <span style="color:var(--accent);font-size:15px;font-weight:500">${kcalNum}</span>
            <span style="color:var(--text3);font-size:11px">${hasTargets ? '/' + t.calories + ' KCAL' : 'KCAL'}</span>
          </span>
          ${kcalRight}
        </div>
        ${kcalBar}
      </div>`;

    // CHIP 2 — macros (FAT / CARBS / PROT)
    const macroCol = (key, label, val, color, target) => {
      const pct = (hasTargets && target > 0) ? val / target * 100 : null;
      const pctHTML = pct !== null
        ? `<span style="font-size:9px;color:${getNutrientColor(key, pct)}">${Math.round(pct)}%</span>`
        : '';
      const tgtHTML = hasTargets ? `<span style="font-size:10px;color:var(--text3)">/${r(target)}</span>` : '';
      return `
        <div style="flex:1;min-width:0;padding:0 10px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span style="font-size:9px;color:var(--text3)">${label}</span>
            ${pctHTML}
          </div>
          <div style="display:flex;align-items:baseline;gap:3px;margin-top:2px">
            <span style="font-size:15px;color:${color}">${r(val)}</span>
            ${tgtHTML}
          </div>
        </div>`;
    };
    const sepV = `<div style="width:1px;align-self:stretch;background:var(--border)"></div>`;
    const chip2 = `
      <div id="sticky-chip-macros" style="background:var(--surface);border-radius:10px;padding:9px 0;display:flex;align-items:stretch">
        ${macroCol('fat',     'FAT',   tot.fat,  'var(--orange)', t.fat)}
        ${sepV}
        ${macroCol('carbs',   'CARBS', tot.carb, 'var(--yellow)', t.carbs)}
        ${sepV}
        ${macroCol('protein', 'PROT',  tot.prot, 'var(--blue)',   t.protein)}
      </div>`;

    sticky.innerHTML = chip1 + chip2;
  }

  const container = document.getElementById('diary-container');
  container.innerHTML = '';
  Object.entries(MEALS).forEach(([k,label]) => {
    const mes = entries.filter(e=>e.meal===k);
    const mkcal = mes.reduce((s,e)=>s+ +e.calories,0);
    const mprot = mes.reduce((s,e)=>s+ +e.protein,0);
    const mcarb = mes.reduce((s,e)=>s+ +e.carbs,0);
    const mfat  = mes.reduce((s,e)=>s+ +e.fat,0);
    const div = document.createElement('div');
    div.className = 'meal-section';
    const kcalInline = mes.length > 0
      ? `<span class="meal-kcal-val">${r(mkcal)}</span>`
      : '';
    const macroStr = mes.length > 0
      ? `<div class="meal-macros">F ${r(mfat)} · C ${r(mcarb)} · P ${r(mprot)}</div>`
      : '';
    const locked = isMealLocked(currentDate, k);
    const lockIcon = locked
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
    const rightAction = !locked
      ? '<span class="meal-log-label">+ LOG</span>'
      : (mes.length > 0 ? '<span class="meal-locked-label">Locked</span>' : '');
    div.innerHTML = `
      <div class="meal-header">
        <div class="meal-header-left">
          <div class="meal-head-line"><span class="meal-name">${label}</span>${kcalInline}</div>
          ${macroStr}
        </div>
        <button class="meal-lock-btn${locked ? ' locked' : ''}" aria-label="${locked ? 'Desbloquear' : 'Bloquear'} refeição">${lockIcon}</button>
        <div class="meal-header-right${locked ? ' locked' : ''}">
          ${rightAction}
        </div>
      </div>`;
    const leftEl  = div.querySelector('.meal-header-left');
    const rightEl = div.querySelector('.meal-header-right');
    const lockBtn = div.querySelector('.meal-lock-btn');
    lockBtn.addEventListener('click', e => {
      e.stopPropagation();
      toggleMealLock(currentDate, k);
      renderToday(entries, t);
    });
    leftEl.addEventListener('click', e => {
      e.stopPropagation();
      if (mes.length > 0) openMealBreakdown(k, diaryEntries);
      else if (!locked) openLogForMeal(k);
    });
    if (!locked) {
      rightEl.addEventListener('click', e => {
        e.stopPropagation();
        openLogForMeal(k);
      });
    } else {
      rightEl.style.cursor = 'default';
    }

    // Refeição bloqueada → estado colapsado: só o header (resumo F·C·P já lá está).
    if (locked) {
      container.appendChild(div);
      return;
    }

    if (mes.length === 0) {
      const noEntry = document.createElement('div');
      noEntry.className = 'no-entries';
      noEntry.textContent = 'Sem registos';
      div.appendChild(noEntry);
    } else {
      mes.forEach(entry => {
        const entryEl = document.createElement('div');
        entryEl.className = 'diary-entry';
        if (!locked) entryEl.style.cursor = 'pointer';
        entryEl.innerHTML = `
          <div class="entry-info">
            <div class="entry-name"></div>
            <div class="entry-detail">${entry.grams ? entry.grams + 'g · ' : ''}F ${r(entry.fat)}g · C ${r(entry.carbs)}g · P ${r(entry.protein)}g</div>
            ${entry.has_tara ? '<div class="entry-tara-flag">⚖ tem tara</div>' : ''}
          </div>
          <div class="entry-kcal">${r(entry.calories)}</div>`;
        entryEl.querySelector('.entry-name').innerHTML = highlightFoodKeywords(entry.food_name);
        if (!locked) entryEl.addEventListener('click', () => openEditEntry(entry.id));
        div.appendChild(entryEl);
      });
    }

    container.appendChild(div);
  });

  // Depois de o container estar preenchido — só agora #view-today tem a
  // scrollbar, necessária para medir a sua largura correctamente.
  setupTodaySticky();
}

// Barra fixa (position:fixed) que aparece ao fazer scroll do #view-today.
// Opacidade calculada a partir do scrollTop vs. fundo do bloco de macros.
function setupTodaySticky() {
  const sticky = document.getElementById('today-sticky');
  const view   = document.getElementById('view-today');
  const macro  = view ? view.querySelector('.macro-summary') : null;
  if (!sticky || !view || !macro) return;

  // Largura/posição reais de #view-today — descontar a scrollbar.
  // offsetWidth inclui scrollbar, clientWidth não → a diferença é a largura
  // exacta da scrollbar em qualquer OS/browser.
  const scrollbarW = view.offsetWidth - view.clientWidth;
  const viewRect = view.getBoundingClientRect();
  sticky.style.left  = viewRect.left + 'px';
  sticky.style.width = (viewRect.width - scrollbarW) + 'px';
  sticky.style.right = 'auto';

  // Reajustar em resize (ligado uma só vez).
  if (!window._stickyResizeBound) {
    window._stickyResizeBound = true;
    window.addEventListener('resize', () => {
      const s = document.getElementById('today-sticky');
      const v = document.getElementById('view-today');
      if (s && v) {
        const sw = v.offsetWidth - v.clientWidth;
        const r  = v.getBoundingClientRect();
        s.style.left  = r.left + 'px';
        s.style.width = (r.width - sw) + 'px';
      }
    });
  }

  // Offset os chips pelo header da data (sticky), para não o cobrir.
  const dateHeader = view.querySelector('.diary-header');
  const headerH = dateHeader ? dateHeader.offsetHeight : 0;
  sticky.style.top = headerH + 'px';

  // remover listener anterior se existir
  if (view._stickyListener) {
    view.removeEventListener('scroll', view._stickyListener);
  }

  const chipKcal   = sticky.querySelector('#sticky-chip-kcal');
  const chipMacros = sticky.querySelector('#sticky-chip-macros');

  view._stickyListener = function() {
    const macroBottom = macro.offsetTop + macro.offsetHeight;
    const fadeRange   = macro.offsetHeight * 0.5;
    const offset      = 80; // px de scroll extra para a chip de macros

    // kcal chip — aparece primeiro
    const p1 = (view.scrollTop - (macroBottom - fadeRange)) / fadeRange;
    const o1 = Math.min(1, Math.max(0, p1));

    // macros chip — começa offset px depois
    const p2 = (view.scrollTop - (macroBottom - fadeRange + offset)) / fadeRange;
    const o2 = Math.min(1, Math.max(0, p2));

    if (chipKcal)   chipKcal.style.opacity   = o1;
    if (chipMacros) chipMacros.style.opacity = o2;

    // container sempre presente; pointer-events só quando há chip visível
    sticky.style.opacity      = '1';
    sticky.style.pointerEvents = (o1 > 0 || o2 > 0) ? 'auto' : 'none';
  };

  view.addEventListener('scroll', view._stickyListener);
  // estado inicial
  view._stickyListener();
}

function setDateLabel() {
  const d = new Date(currentDate+'T12:00:00');
  const fullEl = document.getElementById('today-date-full');
  if (fullEl) fullEl.textContent = d.toLocaleDateString('pt-PT',{day:'numeric',month:'long'});
  const wdEl = document.getElementById('today-weekday');
  if (wdEl) wdEl.textContent = d.toLocaleDateString('pt-PT',{weekday:'long'});
  const moEl = document.getElementById('today-month');
  if (moEl) moEl.textContent = d.toLocaleDateString('pt-PT',{month:'short'}).replace('.','').toUpperCase();
}

function changeDay(delta) {
  const d = new Date(currentDate + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  currentDate = d.toISOString().split('T')[0];
  setDateLabel();
  loadToday();
  updateLogDateLabel();
}

function pickDate() {
  openDatePicker(currentDate, date => {
    currentDate = date;
    setDateLabel();
    loadToday();
    updateLogDateLabel();
  });
}

// ── MEAL LOCKS (localStorage) ────────────────────────────────────────────────
// Bloqueio por (data + refeição): impede log/edição de entradas nessa refeição.
function getMealLocks() {
  try { return JSON.parse(localStorage.getItem('meal_locks') || '{}'); }
  catch { return {}; }
}
function isMealLocked(date, meal) {
  return !!getMealLocks()[date + '_' + meal];
}
function toggleMealLock(date, meal) {
  const locks = getMealLocks();
  const key = date + '_' + meal;
  if (locks[key]) delete locks[key];
  else locks[key] = true;
  localStorage.setItem('meal_locks', JSON.stringify(locks));
}



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
      if (pct !== null) topRight = `<span style="font-size:10px;color:var(--text3);font-family:var(--mono)">${pct}%</span>`;
      valLine = `<span class="macro-cell-val" style="color:${m.color}">${val}</span>`;
    } else {
      // Floor (P/F): abaixo → restante + %; atingido → só ✓; fat >90 sinaliza.
      const tgtHTML = hasTargets ? `<span class="macro-cell-tgt" style="color:var(--text3)">≥${m.floor}</span>` : '';
      valLine = `<span class="macro-cell-val" style="color:${m.color}">${val}</span>${tgtHTML}`;
      if (hasTargets && m.floor > 0) {
        const pct = Math.round(rawPct(m.actual, m.floor));
        if (val < m.floor) {
          topRight = `<span style="display:inline-flex;align-items:baseline;gap:4px;font-family:var(--mono)"><span style="font-size:10px;color:var(--red)">−${r(m.floor - m.actual)} ↓</span><span style="font-size:10px;color:var(--text3)">${pct}%</span></span>`;
        } else if (m.key === 'fat' && val > 90) {
          topRight = `<span style="font-size:10px;color:var(--red);font-family:var(--mono)">&gt;90 ↑</span>`;
        } else {
          topRight = `<span style="font-size:11px;color:var(--accent);font-family:var(--mono)">✓</span>`;
        }
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

  const summary = document.querySelector('#view-today .macro-summary');
  summary.innerHTML = `
    <div class="diary-kcal-row" style="justify-content:flex-start;align-items:baseline;gap:8px">
      <span class="diary-kcal-num" id="tot-kcal" style="font-size:28px;color:${kcalColor}">${kcalNum}</span>
      <span class="diary-kcal-tgt" style="cursor:pointer" onclick="go('targets')" title="Ver targets">${hasTargets ? '/ ' + t.calories + ' kcal' : 'kcal'}</span>
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



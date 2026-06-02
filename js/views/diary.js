let diaryEntries = [];

const NUTRIENT_MAP = {
  calories: { key: 'calories', label: 'Calorias', unit: 'kcal', color: 'var(--accent)' },
  protein:  { key: 'protein',  label: 'Proteína', unit: 'g',    color: 'var(--blue)'   },
  carbs:    { key: 'carbs',    label: 'Hidratos',  unit: 'g',    color: 'var(--yellow)' },
  fat:      { key: 'fat',      label: 'Gordura',   unit: 'g',    color: 'var(--orange)' },
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
  let badgeHTML = '';
  if (hasTargets) {
    const rem = t.calories - kcalNum;
    badgeHTML = rem >= 0
      ? `<div class="diary-kcal-badge within">${rem} rest.</div>`
      : `<div class="diary-kcal-badge over">+${Math.abs(rem)} kcal</div>`;
  }

  // ── MACROS (grid) ──
  const macros = [
    { key: 'protein', label: 'PROT', actual: tot.prot, target: t.protein, color: 'var(--blue)'   },
    { key: 'carbs',   label: 'HIDR', actual: tot.carb, target: t.carbs,   color: 'var(--yellow)' },
    { key: 'fat',     label: 'GORD', actual: tot.fat,  target: t.fat,     color: 'var(--orange)' },
  ];
  const cellsHTML = macros.map(m => {
    const tgtHTML = hasTargets ? `<span class="macro-cell-tgt">/${m.target}g</span>` : '';
    const bar = hasTargets ? buildSegmentedBar(m.actual, m.target, m.key) : '';
    const rem = r(m.target - m.actual);
    let remHTML = '';
    if (hasTargets && rem > 0)      remHTML = `<span class="macro-cell-rem">· ${rem}↓</span>`;
    else if (hasTargets && rem < 0) remHTML = `<span class="macro-cell-rem">· +${Math.abs(rem)}</span>`;
    return `<div class="macro-cell" data-nutrient="${m.key}">
      <div class="macro-cell-label">${m.label}</div>
      <div class="macro-cell-valrow"><span class="macro-cell-val" style="color:${m.color}">${r(m.actual)}</span>${tgtHTML}${remHTML}</div>
      ${bar}
    </div>`;
  }).join('');

  const summary = document.querySelector('#view-today .macro-summary');
  summary.innerHTML = `
    <div class="diary-kcal-row">
      <div class="diary-kcal-main">
        <span class="diary-kcal-num" id="tot-kcal" style="color:${kcalColor}">${kcalNum}</span>
        <span class="diary-kcal-tgt">${hasTargets ? '/ ' + t.calories + ' kcal' : 'kcal'}</span>
      </div>
      ${badgeHTML}
    </div>
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
      ? `<div class="meal-macros">G ${r(mfat)} · C ${r(mcarb)} · P ${r(mprot)}</div>`
      : '';
    div.innerHTML = `
      <div class="meal-header">
        <div class="meal-header-left">
          <div class="meal-head-line"><span class="meal-name">${label}</span>${kcalInline}</div>
          ${macroStr}
        </div>
        <div class="meal-header-right">
          <span style="color:var(--accent);font-family:var(--mono);font-size:13px;letter-spacing:.06em">+ LOG</span>
        </div>
      </div>`;
    const leftEl  = div.querySelector('.meal-header-left');
    const rightEl = div.querySelector('.meal-header-right');
    leftEl.addEventListener('click', e => {
      e.stopPropagation();
      if (mes.length > 0) openMealBreakdown(k, diaryEntries);
      else openLogForMeal(k);
    });
    rightEl.addEventListener('click', e => {
      e.stopPropagation();
      openLogForMeal(k);
    });

    if (mes.length === 0) {
      const noEntry = document.createElement('div');
      noEntry.className = 'no-entries';
      noEntry.textContent = 'Sem registos';
      div.appendChild(noEntry);
    } else {
      mes.forEach(entry => {
        const entryEl = document.createElement('div');
        entryEl.className = 'diary-entry';
        entryEl.style.cursor = 'pointer';
        entryEl.innerHTML = `
          <div class="entry-info">
            <div class="entry-name"></div>
            <div class="entry-detail">${entry.grams ? entry.grams + 'g · ' : ''}G ${r(entry.fat)}g · C ${r(entry.carbs)}g · P ${r(entry.protein)}g</div>
          </div>
          <div class="entry-kcal">${r(entry.calories)}</div>`;
        entryEl.querySelector('.entry-name').innerHTML = highlightFoodKeywords(entry.food_name);
        entryEl.addEventListener('click', () => openEditEntry(entry.id));
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



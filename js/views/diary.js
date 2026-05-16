let diaryEntries = [];

const NUTRIENT_MAP = {
  calories: { key: 'calories',      label: 'Calorias',      unit: 'kcal', color: 'var(--accent)' },
  protein:  { key: 'protein',       label: 'Proteína',      unit: 'g',    color: 'var(--blue)'   },
  carbs:    { key: 'carbs',         label: 'Hidratos',       unit: 'g',    color: 'var(--yellow)' },
  fat:      { key: 'fat',           label: 'Gordura',         unit: 'g',    color: 'var(--orange)' },
  satfat:   { key: 'saturated_fat', label: 'Gord. Saturada',  unit: 'g',    color: '#f97316'       },
  fiber:    { key: 'fiber',         label: 'Fibra',           unit: 'g',    color: 'var(--accent)' },
  sugar:    { key: 'sugar',         label: 'Açúcar',          unit: 'g',    color: '#e879f9'       },
};

function renderToday(entries, t) {
  diaryEntries = entries;
  const tot = {kcal:0, fat:0, satfat:0, carb:0, sugar:0, fiber:0, prot:0};
  entries.forEach(e => {
    tot.kcal  += +e.calories;
    tot.fat   += +e.fat;
    tot.satfat+= +(e.saturated_fat||0);
    tot.carb  += +e.carbs;
    tot.sugar += +(e.sugar||0);
    tot.fiber += +(e.fiber||0);
    tot.prot  += +e.protein;
  });

  const r = n => Math.round(n);
  document.getElementById('tot-kcal').textContent = r(tot.kcal);
  document.getElementById('tot-kcal-label').textContent = `/ ${t.calories} kcal`;
  const rem = t.calories - r(tot.kcal);
  const remEl = document.getElementById('kcal-rem');
  remEl.textContent = rem>=0 ? `${rem} restantes` : `${Math.abs(rem)} excesso`;
  remEl.style.color = rem>=0 ? 'var(--text2)' : 'var(--red)';

  const rawPct = (v, m) => m > 0 ? v / m * 100 : 0;
  const pct    = (v, m) => Math.min(100, rawPct(v, m)) + '%';

  const bars = [
    // Primary — split num/tgt display
    { bar: 'bar-p', numEl: 'val-p-num', tgtEl: 'val-p-tgt', nutrient: 'protein', actual: tot.prot,   target: t.protein       },
    { bar: 'bar-c', numEl: 'val-c-num', tgtEl: 'val-c-tgt', nutrient: 'carbs',   actual: tot.carb,   target: t.carbs         },
    { bar: 'bar-g', numEl: 'val-g-num', tgtEl: 'val-g-tgt', nutrient: 'fat',     actual: tot.fat,    target: t.fat           },
    // Secondary — single val element
    { bar: 'bar-gs', val: 'val-gs', nutrient: 'satfat', actual: tot.satfat, target: t.saturated_fat },
    { bar: 'bar-f',  val: 'val-f',  nutrient: 'fiber',  actual: tot.fiber,  target: t.fiber         },
    { bar: 'bar-a',  val: 'val-a',  nutrient: 'sugar',  actual: tot.sugar,  target: t.sugar         },
  ];

  bars.forEach(({ bar, val, numEl, tgtEl, nutrient, actual, target }) => {
    const p     = rawPct(actual, target);
    const color = entries.length > 0 ? getNutrientColor(nutrient, p) : 'var(--surface3)';
    const barEl = document.getElementById(bar);
    if (barEl) { barEl.style.width = Math.min(100, p) + '%'; barEl.style.background = color; }
    if (val) {
      const el = document.getElementById(val);
      if (el) { el.textContent = `${r(actual)}/${target}g`; el.style.color = entries.length > 0 ? color : 'var(--text2)'; }
    }
    if (numEl) {
      const el = document.getElementById(numEl);
      if (el) { el.textContent = r(actual); el.style.color = entries.length > 0 ? color : 'var(--text2)'; }
    }
    if (tgtEl) {
      const el = document.getElementById(tgtEl);
      if (el) el.textContent = `/${target}g`;
    }
  });

  // Tap on primary rows (.mpr) / secondary chips (.msc) → open nutrient ranking
  [
    { barId: 'bar-p',  nutrientKey: 'protein', isPrimary: true  },
    { barId: 'bar-c',  nutrientKey: 'carbs',   isPrimary: true  },
    { barId: 'bar-g',  nutrientKey: 'fat',     isPrimary: true  },
    { barId: 'bar-gs', nutrientKey: 'satfat',  isPrimary: false },
    { barId: 'bar-f',  nutrientKey: 'fiber',   isPrimary: false },
    { barId: 'bar-a',  nutrientKey: 'sugar',   isPrimary: false },
  ].forEach(({ barId, nutrientKey, isPrimary }) => {
    const n      = NUTRIENT_MAP[nutrientKey];
    const fillEl = document.getElementById(barId);
    if (!n || !fillEl) return;
    if (isPrimary) {
      const mprEl = fillEl.closest('.mpr'); // full row: name + val + bar
      if (mprEl) {
        mprEl.style.cursor = 'pointer';
        mprEl.onclick = () => openNutrientSheet(diaryEntries, n);
      }
    } else {
      const mscEl = fillEl.closest('.msc'); // full chip: label + val + bar
      if (mscEl) {
        mscEl.style.cursor = 'pointer';
        mscEl.onclick = () => openNutrientSheet(diaryEntries, n);
      }
    }
  });

  const kcalPct = rawPct(tot.kcal, t.calories);
  const kcalColor = entries.length > 0 ? getNutrientColor('calories', kcalPct) : 'var(--accent)';
  const kcalEl = document.getElementById('tot-kcal');
  kcalEl.style.color = kcalColor;
  kcalEl.style.cursor = 'pointer';
  kcalEl.onclick = () => openNutrientSheet(diaryEntries, NUTRIENT_MAP.calories);
  const kcalBarEl = document.getElementById('bar-kcal');
  if (kcalBarEl) {
    kcalBarEl.style.width = Math.min(100, kcalPct) + '%';
    kcalBarEl.style.background = kcalColor;
    kcalBarEl.parentElement.style.cursor = 'pointer';
    kcalBarEl.parentElement.onclick = () => openNutrientSheet(diaryEntries, NUTRIENT_MAP.calories);
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
    const macroStr = mes.length > 0
      ? `<div class="meal-macros">G ${r(mfat)}g · C ${r(mcarb)}g · P ${r(mprot)}g</div>`
      : '';
    div.innerHTML = `
      <div class="meal-header">
        <div class="meal-header-left" style="cursor:pointer;flex:1;min-width:0">
          <div class="meal-name">${label}</div>
          ${macroStr}
        </div>
        <div class="meal-header-right" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:12px 0 12px 12px;flex-shrink:0">
          <div class="meal-kcal">${r(mkcal)} kcal</div>
          <div style="color:var(--text3);font-size:18px;line-height:1">+</div>
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
        entryEl.querySelector('.entry-name').textContent = entry.food_name;
        entryEl.addEventListener('click', () => openEditEntry(entry.id));
        div.appendChild(entryEl);
      });
    }

    container.appendChild(div);
  });
}

function setDateLabel() {
  const today = new Date().toISOString().split('T')[0];
  const d = new Date(currentDate+'T12:00:00');
  document.getElementById('today-title').textContent = 'Diário';
  document.getElementById('today-date-label').textContent = d.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
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



let diaryEntries = [];

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
    // Primary — split num/tgt display + expand detail
    { bar: 'bar-p',  numEl: 'val-p-num', tgtEl: 'val-p-tgt', pctEl: 'detail-pct-protein', remEl: 'detail-rem-protein', nutrient: 'protein', actual: tot.prot,   target: t.protein       },
    { bar: 'bar-c',  numEl: 'val-c-num', tgtEl: 'val-c-tgt', pctEl: 'detail-pct-carbs',   remEl: 'detail-rem-carbs',   nutrient: 'carbs',   actual: tot.carb,   target: t.carbs         },
    { bar: 'bar-g',  numEl: 'val-g-num', tgtEl: 'val-g-tgt', pctEl: 'detail-pct-fat',     remEl: 'detail-rem-fat',     nutrient: 'fat',     actual: tot.fat,    target: t.fat           },
    // Secondary — single val element
    { bar: 'bar-gs', val: 'val-gs', nutrient: 'satfat', actual: tot.satfat, target: t.saturated_fat },
    { bar: 'bar-f',  val: 'val-f',  nutrient: 'fiber',  actual: tot.fiber,  target: t.fiber         },
    { bar: 'bar-a',  val: 'val-a',  nutrient: 'sugar',  actual: tot.sugar,  target: t.sugar         },
  ];

  bars.forEach(({ bar, val, numEl, tgtEl, pctEl, remEl, nutrient, actual, target }) => {
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
    if (pctEl) {
      const el = document.getElementById(pctEl);
      if (el) { el.textContent = Math.round(Math.min(100, p)) + '%'; el.style.color = color; }
    }
    if (remEl) {
      const el = document.getElementById(remEl);
      if (el) {
        const rem = target - r(actual);
        el.textContent = rem > 0 ? `${rem}g por atingir` : 'Meta atingida!';
        el.style.color = rem > 0 ? 'var(--text3)' : 'var(--accent)';
      }
    }
  });

  const kcalPct = rawPct(tot.kcal, t.calories);
  const kcalColor = entries.length > 0 ? getNutrientColor('calories', kcalPct) : 'var(--accent)';
  document.getElementById('tot-kcal').style.color = kcalColor;
  const kcalBarEl = document.getElementById('bar-kcal');
  if (kcalBarEl) { kcalBarEl.style.width = Math.min(100, kcalPct) + '%'; kcalBarEl.style.background = kcalColor; }

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
    const rows = mes.length===0
      ? `<div class="no-entries">Sem registos</div>`
      : mes.map(e=>`
        <div class="diary-entry" onclick="openEditEntry(${e.id})" style="cursor:pointer">
          <div class="entry-info">
            <div class="entry-name">${e.food_name}</div>
            <div class="entry-detail">${e.grams?e.grams+'g · ':''}G ${r(e.fat)}g · C ${r(e.carbs)}g · P ${r(e.protein)}g</div>
          </div>
          <div class="entry-kcal">${r(e.calories)}</div>
        </div>`).join('');
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
      </div>${rows}`;
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
}

function pickDate() {
  openDatePicker(currentDate, date => {
    currentDate = date;
    setDateLabel();
    loadToday();
  });
}

function pickLogDate() {
  openDatePicker(currentDate, date => {
    currentDate = date;
    setDateLabel();
    updateLogDateLabel();
  });
}

function updateLogDateLabel() {
  const today = new Date().toISOString().split('T')[0];
  const d = new Date(currentDate+'T12:00:00');
  const dateStr = d.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
  const el = document.getElementById('log-date-label');
  if (el) el.textContent = currentDate === today ? `Hoje — ${dateStr}` : dateStr;
}

async function loadLogTotalsStrip() {
  const strip = document.getElementById('log-totals-strip');
  if (!strip || !db) return;
  const { data } = await db.from('diary').select('calories,protein,carbs,fat').eq('date', currentDate);
  if (!data) return;
  const t = await getTargetsForDate(currentDate);
  const r = n => Math.round(n);
  const tot = { kcal:0, prot:0, carb:0, fat:0 };
  data.forEach(e => { tot.kcal+=+e.calories; tot.prot+=+e.protein; tot.carb+=+e.carbs; tot.fat+=+e.fat; });
  const rem = t.calories - r(tot.kcal);
  const remColor = rem >= 0 ? 'var(--text2)' : 'var(--red)';
  strip.innerHTML = `
    <div style="font-family:var(--mono);font-size:12px">
      <span style="color:var(--accent);font-weight:600">${r(tot.kcal)}</span>
      <span style="color:var(--text3)">/${t.calories}</span>
    </div>
    <div style="font-family:var(--mono);font-size:11px;color:${remColor}">${rem>=0?rem+'↓':Math.abs(rem)+'↑'} kcal</div>
    <div style="font-family:var(--mono);font-size:11px;color:var(--blue)">P ${r(tot.prot)}g</div>
    <div style="font-family:var(--mono);font-size:11px;color:var(--yellow)">H ${r(tot.carb)}g</div>
    <div style="font-family:var(--mono);font-size:11px;color:var(--orange)">G ${r(tot.fat)}g</div>`;
}

function toggleMacroDetail(key) {
  const detail = document.getElementById('detail-' + key);
  const row    = document.getElementById('mpr-' + key);
  if (!detail || !row) return;
  const isOpen = detail.classList.contains('open');
  detail.classList.toggle('open', !isOpen);
  row.classList.toggle('mpr-expanded', !isOpen);
}

async function loadRecentFoods() {
  const el = document.getElementById('recent-foods');
  if (!db || !el) return;
  const { data } = await db.from('diary')
    .select('food_id, food_name')
    .not('food_id', 'is', null)
    .order('logged_at', { ascending: false })
    .limit(50);

  if (!data || !data.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);font-family:var(--mono)">Sem histórico ainda</div>';
    return;
  }

  const seen = new Set();
  const recents = [];
  for (const e of data) {
    if (!seen.has(e.food_id)) {
      seen.add(e.food_id);
      recents.push(e);
      if (recents.length >= 8) break;
    }
  }

  el.innerHTML = recents.map(e =>
    `<button class="recent-chip" onclick="pickFood(${e.food_id})">${e.food_name}</button>`
  ).join('');
}

function renderToday(entries) {
  const t = getTargets();
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
    { bar: 'bar-g',  val: 'val-g',  nutrient: 'fat',      actual: tot.fat,    target: t.fat,           label: `${r(tot.fat)}/${t.fat}g` },
    { bar: 'bar-gs', val: 'val-gs', nutrient: 'satfat',   actual: tot.satfat, target: t.saturated_fat, label: `${r(tot.satfat)}/${t.saturated_fat}g` },
    { bar: 'bar-c',  val: 'val-c',  nutrient: 'carbs',    actual: tot.carb,   target: t.carbs,         label: `${r(tot.carb)}/${t.carbs}g` },
    { bar: 'bar-a',  val: 'val-a',  nutrient: 'sugar',    actual: tot.sugar,  target: t.sugar,         label: `${r(tot.sugar)}/${t.sugar}g` },
    { bar: 'bar-f',  val: 'val-f',  nutrient: 'fiber',    actual: tot.fiber,  target: t.fiber,         label: `${r(tot.fiber)}/${t.fiber}g` },
    { bar: 'bar-p',  val: 'val-p',  nutrient: 'protein',  actual: tot.prot,   target: t.protein,       label: `${r(tot.prot)}/${t.protein}g` },
  ];

  bars.forEach(({ bar, val, nutrient, actual, target, label }) => {
    const p = rawPct(actual, target);
    const color = entries.length > 0 ? getNutrientColor(nutrient, p) : 'var(--surface3)';
    document.getElementById(bar).style.width      = Math.min(100, p) + '%';
    document.getElementById(bar).style.background = color;
    document.getElementById(val).textContent      = label;
    document.getElementById(val).style.color      = entries.length > 0 ? color : 'var(--text2)';
  });

  const kcalPct = rawPct(tot.kcal, t.calories);
  const kcalColor = entries.length > 0 ? getNutrientColor('calories', kcalPct) : 'var(--accent)';
  document.getElementById('tot-kcal').style.color = kcalColor;

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
      <div class="meal-header" onclick="openLogForMeal('${k}')" style="cursor:pointer">
        <div class="meal-header-top">
          <div class="meal-name">${label}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="meal-kcal">${r(mkcal)} kcal</div>
            <div style="color:var(--text3);font-size:18px;line-height:1">+</div>
          </div>
        </div>
        ${macroStr}
      </div>${rows}`;
    container.appendChild(div);
  });
}

function setDateLabel() {
  const today = new Date().toISOString().split('T')[0];
  const d = new Date(currentDate+'T12:00:00');
  document.getElementById('today-title').textContent = currentDate === today ? 'Diário' : 'Diário';
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
  const t = getTargets();
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

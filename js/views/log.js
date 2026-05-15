let loadTotalsGen = 0;

async function searchDB() {
  const q = document.getElementById('log-q').value.trim().toLowerCase();
  const res = document.getElementById('log-results');
  if (q.length<1) { res.innerHTML='<div class="loading">Começa a escrever para pesquisar</div>'; return; }
  const { data, error } = await db.from('foods').select('*').ilike('name',`%${q}%`).limit(25);
  if (error) {
    console.error('searchDB error:', error.message);
    res.innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'empty-state';
    msg.textContent = 'Erro ao pesquisar. Verifica a ligação.';
    res.appendChild(msg);
    return;
  }
  if (!data||!data.length) {
    const q2 = document.getElementById('log-q').value.trim();
    const q2h = q2.replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    res.innerHTML = `<div style="padding:12px 20px">
      <div style="font-size:13px;color:var(--text3);margin-bottom:10px">Sem resultados para "${q2h}"</div>
      <button class="btn btn-secondary" style="font-size:13px;padding:10px" onclick="openAddFoodFromLog('${q2h}')">+ Criar "${q2h}"</button>
    </div>`;
    return;
  }
  res.innerHTML = data.map(f=>`
    <div class="sr-item" onclick="pickFood(${f.id})">
      <div><div class="sr-name">${f.name}</div><div class="sr-detail">${f.brand?f.brand+' · ':''}${f.calories_per_100g} kcal · P${f.protein_per_100g} C${f.carbs_per_100g} G${f.fat_per_100g}</div></div>
      <div class="sr-kcal">${f.calories_per_100g}<br><span style="font-size:9px;color:var(--text3)">kcal/100g</span></div>
    </div>`).join('');
}

async function pickFood(id) {
  const {data} = await db.from('foods').select('*').eq('id',id).single();
  if (!data) return;
  selectedFood=data;
  document.getElementById('log-stage-search').classList.remove('active');
  document.getElementById('log-stage-grams').classList.add('active');

  const servingBtn = data.serving_size_g
    ? `<button class="btn btn-secondary" style="margin-top:8px;padding:8px 14px;font-size:13px;width:auto" onclick="document.getElementById('log-grams').value=${data.serving_size_g};updatePreview()">1 porção (${data.serving_size_g}g)</button>`
    : '';

  document.getElementById('log-food-card').innerHTML=`
    <div class="food-card-name">${data.name}</div>
    <div class="food-card-sub">${data.brand?data.brand+' · ':''}${data.calories_per_100g} kcal/100g · P${data.protein_per_100g}g C${data.carbs_per_100g}g G${data.fat_per_100g}g</div>
    ${servingBtn}`;

  const gi = document.getElementById('log-grams');
  gi.value = '';
  updatePreview();
  setTimeout(()=>gi.focus(),100);
}

function updatePreview() {
  if (!selectedFood) return;
  const g = parseFloat(document.getElementById('log-grams').value)||0;
  const c = v=>Math.round((parseFloat(v)||0)/100*g);
  document.getElementById('prev-kcal').textContent   = c(selectedFood.calories_per_100g);
  document.getElementById('prev-fat').textContent    = c(selectedFood.fat_per_100g);
  document.getElementById('prev-satfat').textContent = c(selectedFood.saturated_fat_per_100g);
  document.getElementById('prev-carb').textContent   = c(selectedFood.carbs_per_100g);
  document.getElementById('prev-sugar').textContent  = c(selectedFood.sugar_per_100g);
  document.getElementById('prev-fiber').textContent  = c(selectedFood.fiber_per_100g);
  document.getElementById('prev-prot').textContent   = c(selectedFood.protein_per_100g);
}

function backToSearch() {
  document.getElementById('log-stage-search').classList.add('active');
  document.getElementById('log-stage-grams').classList.remove('active');
  selectedFood=null;
}

async function saveQuick() {
  const name = document.getElementById('q-name').value.trim();
  if (!name) { toast('Indica o nome'); return; }
  const {error} = await db.from('diary').insert({
    date:currentDate, meal:selectedMeal, food_name:name, grams:null,
    calories:      parseFloat(document.getElementById('q-kcal').value)||0,
    fat:           parseFloat(document.getElementById('q-fat').value)||0,
    saturated_fat: parseFloat(document.getElementById('q-satfat').value)||0,
    carbs:         parseFloat(document.getElementById('q-carb').value)||0,
    sugar:         parseFloat(document.getElementById('q-sugar').value)||0,
    fiber:         parseFloat(document.getElementById('q-fiber').value)||0,
    protein:       parseFloat(document.getElementById('q-prot').value)||0
  });
  if (error) { toast('Erro ao guardar'); return; }
  toast('Registado'); closeLog(); clearQuick(); loadToday(); go('today');
}

function clearQuick() {
  ['q-name','q-kcal','q-fat','q-satfat','q-carb','q-sugar','q-fiber','q-prot'].forEach(id=>document.getElementById(id).value='');
}

function openLogForMeal(mealKey) {
  selectedMeal = mealKey;
  mealManuallySelected = true;
  updateMealSelectorLabel(mealKey);
  updateSheetMealTabs();
  openLog('db');
}

function openAddFoodFromLog(prefillName) {
  fromLogContext = true;
  openAddFood();
  if (prefillName) {
    setTimeout(() => { document.getElementById('f-name').value = prefillName; }, 100);
  }
}

function updateSheetMealTabs() {
  document.querySelectorAll('#sheet-meal-tabs .meal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.meal === selectedMeal);
  });
}

function selectSheetMeal(mealKey) {
  selectedMeal = mealKey;
  mealManuallySelected = true;
  updateSheetMealTabs();
}

function getMealByHour() {
  const h = new Date().getHours();
  if (h >= 6  && h < 10) return 'breakfast';
  if (h >= 10 && h < 12) return 'morning';
  if (h >= 12 && h < 15) return 'lunch';
  if (h >= 15 && h < 18) return 'afternoon1';
  if (h >= 18 && h < 20) return 'afternoon2';
  if (h >= 20 && h < 23) return 'dinner';
  return 'supper';
}

// ── COLLAPSED MEAL SELECTOR ──────────────────────────────────────────────────

function updateMealSelectorLabel(mealKey) {
  const el = document.getElementById('meal-selector-label');
  if (el) el.textContent = (typeof MEALS !== 'undefined' && MEALS[mealKey]) || mealKey;
  document.querySelectorAll('.meal-selector-opt').forEach(b => {
    b.classList.toggle('active', b.dataset.meal === mealKey);
  });
}

function toggleMealSelector() {
  const grid = document.getElementById('meal-selector-grid');
  const chev = document.getElementById('meal-selector-chevron');
  if (!grid) return;
  const isOpen = grid.classList.toggle('open');
  if (chev) chev.textContent = isOpen ? '▴' : '▾';
}

function selectMealFromSelector(mealKey) {
  selectedMeal = mealKey;
  mealManuallySelected = true;
  updateMealSelectorLabel(mealKey);
  updateSheetMealTabs();
  // Collapse grid
  const grid = document.getElementById('meal-selector-grid');
  const chev = document.getElementById('meal-selector-chevron');
  if (grid) grid.classList.remove('open');
  if (chev) chev.textContent = '▾';
}

// ── LOG MEALS SHEET (Refeição chip) ─────────────────────────────────────────

async function openLogMeals() {
  let overlay = document.getElementById('log-meals-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'log-meals-overlay';
    overlay.className = 'sheet-overlay';
    overlay.style.zIndex = '210';
    overlay.innerHTML = `
      <div class="sheet" style="max-height:80dvh;overflow-y:auto">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div class="sheet-title">Aplicar refeição</div>
          <div class="sheet-close" id="log-meals-close">×</div>
        </div>
        <div id="log-meals-list"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
    document.getElementById('log-meals-close').onclick = () => overlay.classList.remove('open');
  }

  const listEl = document.getElementById('log-meals-list');
  listEl.innerHTML = '<div class="loading">A carregar...</div>';
  overlay.classList.add('open');

  if (!db) { listEl.innerHTML = '<div class="loading">Sem ligação</div>'; return; }

  const { data: templates } = await db
    .from('meal_templates').select('id, name').order('name');

  if (!templates || !templates.length) {
    listEl.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--text3)">Sem refeições guardadas.<br><br>Cria uma na tab <b style="color:var(--text2)">Comida → Refeições</b>.</div>';
    return;
  }

  const ids = templates.map(t => t.id);
  const { data: items } = await db
    .from('meal_template_items').select('template_id').in('template_id', ids);
  const countMap = new Map();
  (items || []).forEach(i => countMap.set(i.template_id, (countMap.get(i.template_id) || 0) + 1));

  listEl.innerHTML = templates.map(t => {
    const n = countMap.get(t.id) || 0;
    const sub = n === 1 ? '1 alimento' : `${n} alimentos`;
    return `<div class="meal-tpl-row log-meals-tpl" data-idx="">
      <div class="meal-tpl-info">
        <div class="meal-tpl-name">${t.name}</div>
        <div class="meal-tpl-sub">${sub}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.log-meals-tpl').forEach((row, idx) => {
    const t = templates[idx];
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      overlay.classList.remove('open');
      openApplyMeal(t.id, t.name);
    });
  });
}

// ── LOG DATE / STRIP / RECENTS ───────────────────────────────────────────────

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
  const gen = ++loadTotalsGen;
  const strip = document.getElementById('log-totals-strip');
  if (!strip || !db) return;
  const { data } = await db.from('diary').select('calories,protein,carbs,fat').eq('date', currentDate);
  if (!data) return;
  const t = await getTargetsForDate(currentDate);
  if (gen !== loadTotalsGen) return;
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

// ── SAVE DIARY HANDLER (DOM side of saveDiary) ───────────────────────────────

async function handleSaveDiary() {
  const ok = await saveDiary();
  if (!ok) return;
  // Reset UI — voltar ao stage de pesquisa sem fechar o sheet
  selectedFood = null;
  document.getElementById('log-stage-grams').classList.remove('active');
  document.getElementById('log-stage-search').classList.add('active');
  document.getElementById('log-q').value = '';
  document.getElementById('log-results').innerHTML =
    '<div class="loading">Começa a escrever para pesquisar</div>';
  loadToday();
  loadLogTotalsStrip();
  setTimeout(() => document.getElementById('log-q').focus(), 100);
}

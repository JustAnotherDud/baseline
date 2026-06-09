let loadTotalsGen = 0;
let lastSearchResults = [];
let expandedGroups = new Set();

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
  lastSearchResults = data;
  renderSearchResults(data);
}

function groupFoodResults(foods) {
  const map = {};
  foods.forEach(f => {
    if (!map[f.name]) map[f.name] = [];
    map[f.name].push(f);
  });
  return map; // { "Iogurte Grego": [food1, food2, food3], ... }
}

function renderSearchResults(foods) {
  expandedGroups = new Set(); // reset expansão a cada render de nova pesquisa
  const container = document.getElementById('log-results');
  container.innerHTML = '';

  const groups = groupFoodResults(foods);

  Object.entries(groups).forEach(([name, items]) => {
    if (items.length === 1) {
      container.appendChild(buildFoodItem(items[0]));
    } else {
      container.appendChild(buildFoodGroup(name, items));
    }
  });
}

function buildFoodItem(food) {
  const item = document.createElement('div');
  item.className = 'sr-item';
  item.innerHTML = `
      <div><div class="sr-name">${highlightFoodKeywords(food.name)}</div><div class="sr-detail">${food.brand?food.brand+' · ':''}${food.calories_per_100g} kcal · P${food.protein_per_100g} C${food.carbs_per_100g} F${food.fat_per_100g}</div></div>
      <div class="sr-kcal">${food.calories_per_100g}<br><span style="font-size:9px;color:var(--text3)">kcal/100g</span></div>`;
  item.onclick = () => pickFood(food.id);
  return item;
}

function buildFoodGroup(name, items) {
  const wrapper = document.createElement('div');
  wrapper.className = 'food-group';

  // Header do grupo
  const header = document.createElement('div');
  header.className = 'food-group-header';
  header.innerHTML = `
    <span class="food-group-name">${highlightFoodKeywords(name)}</span>
    <div class="food-group-meta">
      <span class="food-group-count">${items.length} marcas</span>
      <span class="food-group-chevron">›</span>
    </div>
  `;
  header.onclick = () => toggleFoodGroup(name, items, wrapper);
  wrapper.appendChild(header);

  return wrapper;
}

function toggleFoodGroup(name, items, wrapper) {
  const chevron = wrapper.querySelector('.food-group-chevron');
  const existing = wrapper.querySelector('.food-group-brands');

  if (existing) {
    existing.remove();
    chevron.classList.remove('open');
    expandedGroups.delete(name);
  } else {
    const brandsEl = document.createElement('div');
    brandsEl.className = 'food-group-brands';
    items.forEach(food => {
      const item = document.createElement('div');
      item.className = 'food-brand-item';
      item.innerHTML = `
        <span class="food-brand-name">${food.brand || 'Genérico'}</span>
        <span class="food-brand-kcal">${Math.round(food.calories_per_100g)} kcal</span>
      `;
      item.onclick = () => pickFood(food.id);
      brandsEl.appendChild(item);
    });
    wrapper.appendChild(brandsEl);
    chevron.classList.add('open');
    expandedGroups.add(name);
  }
}

async function pickFood(id) {
  const {data} = await db.from('foods').select('*').eq('id',id).single();
  if (!data) return;
  selectedFood=data;
  document.getElementById('log-stage-search').classList.remove('active');
  document.getElementById('log-stage-grams').classList.add('active');

  const serving = data.serving_size_g;
  const servingBtn = serving
    ? `<button id="dose-btn" class="btn btn-secondary" style="margin-top:8px;padding:8px 14px;font-size:13px;width:auto">+ porção (${serving}g)</button>`
    : '';

  document.getElementById('log-food-card').innerHTML=`
    <div class="food-card-name">${data.name}</div>
    <div class="food-card-sub">${data.brand?data.brand+' · ':''}${data.calories_per_100g} kcal/100g · P${data.protein_per_100g}g C${data.carbs_per_100g}g F${data.fat_per_100g}g</div>
    ${servingBtn}`;

  const doseBtn = document.getElementById('dose-btn');
  if (doseBtn) {
    doseBtn.addEventListener('click', () => {
      const current = parseFloat(document.getElementById('log-grams').value) || 0;
      document.getElementById('log-grams').value = current + serving;
      updatePreview();
    });
  }

  const gi = document.getElementById('log-grams');
  gi.value = '';
  updatePreview();
  setTimeout(()=>gi.focus(),100);
}

function updatePreview() {
  if (!selectedFood) return;
  const g = parseFloat(document.getElementById('log-grams').value)||0;
  const c = v=>Math.round((parseFloat(v)||0)/100*g);
  document.getElementById('prev-kcal').textContent  = c(selectedFood.calories_per_100g);
  document.getElementById('prev-fat').textContent   = c(selectedFood.fat_per_100g);
  document.getElementById('prev-carb').textContent  = c(selectedFood.carbs_per_100g);
  document.getElementById('prev-prot').textContent  = c(selectedFood.protein_per_100g);
  if (selectedFood && selectedFood.serving_size_g) {
    const doses = g > 0 ? (g / selectedFood.serving_size_g).toFixed(1) : '';
    const infoEl = document.getElementById('dose-info');
    if (infoEl) infoEl.textContent = doses ? `${doses}×` : '';
  }
}

function backToSearch() {
  document.getElementById('log-stage-search').classList.add('active');
  document.getElementById('log-stage-grams').classList.remove('active');
  selectedFood=null;
  const infoEl = document.getElementById('dose-info');
  if (infoEl) infoEl.textContent = '';
}

async function saveQuick() {
  const name = document.getElementById('q-name').value.trim();
  if (!name) { toast('Indica o nome'); return; }
  const {error} = await db.from('diary').insert({
    date:currentDate, meal:selectedMeal, food_name:name, grams:null,
    calories: parseFloat(document.getElementById('q-kcal').value)||0,
    fat:      parseFloat(document.getElementById('q-fat').value)||0,
    carbs:    parseFloat(document.getElementById('q-carb').value)||0,
    fiber:    parseFloat(document.getElementById('q-fiber').value)||0,
    protein:  parseFloat(document.getElementById('q-prot').value)||0
  });
  if (error) { toast('Erro ao guardar'); return; }
  toast('Registado'); closeLog(); clearQuick(); go('today');
}

function clearQuick() {
  ['q-name','q-kcal','q-fat','q-carb','q-fiber','q-prot'].forEach(id=>document.getElementById(id).value='');
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
  const sel = document.getElementById('sheet-meal-select');
  if (sel) sel.value = selectedMeal;
}

function selectSheetMealFromDropdown(mealKey) {
  selectedMeal = mealKey;
  mealManuallySelected = true;
  updateMealSelectorLabel(mealKey);
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
  pushSheetState();
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

  renderMealTemplateList(listEl, templates, countMap, {
    showDelete: false,
    onItemClick: t => {
      overlay.classList.remove('open');
      openApplyMeal(t.id, t.name);
    },
  });
}

// ── LOG DATE / STRIP / RECENTS ───────────────────────────────────────────────

function pickLogDate() {
  openDatePicker(currentDate, date => {
    currentDate = date;
    setDateLabel();
    loadToday();
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
  const hasTargets = t && t.calories > 0;
  let kcalHtml = `
    <div style="font-family:var(--mono);font-size:12px">
      <span style="color:var(--accent);font-weight:600">${r(tot.kcal)}</span>`;
  if (hasTargets) kcalHtml += `<span style="color:var(--text3)">/${t.calories}</span>`;
  kcalHtml += `</div>`;
  let remHtml = '';
  if (hasTargets) {
    const rem = t.calories - r(tot.kcal);
    const remColor = rem >= 0 ? 'var(--text2)' : 'var(--red)';
    remHtml = `<div style="font-family:var(--mono);font-size:11px;color:${remColor}">${rem>=0?rem+'↓':Math.abs(rem)+'↑'} kcal</div>`;
  }
  strip.innerHTML = kcalHtml + remHtml + `
    <div style="font-family:var(--mono);font-size:11px;color:var(--orange)">F ${r(tot.fat)}g</div>
    <div style="font-family:var(--mono);font-size:11px;color:var(--yellow)">C ${r(tot.carb)}g</div>
    <div style="font-family:var(--mono);font-size:11px;color:var(--blue)">P ${r(tot.prot)}g</div>`;
}

// ── SAVE DIARY HANDLER (DOM side of saveDiary) ───────────────────────────────

async function handleSaveDiary() {
  const rawGrams = document.getElementById('log-grams').value;
  const parsed = parseGramsExpr(rawGrams);
  if (!parsed || parsed <= 0) { toast('Quantidade inválida'); return; }
  document.getElementById('log-grams').value = parsed;
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

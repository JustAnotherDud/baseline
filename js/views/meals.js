// ── MEAL TEMPLATES ──────────────────────────────────────────────────────────

let mealItems = []; // items being built in openCreateMeal sheet

async function loadMeals() {
  const el = document.getElementById('meals-list');
  if (!db || !el) return;

  const { data: templates, error } = await db
    .from('meal_templates')
    .select('id, name, created_at')
    .order('name');

  if (error) { el.innerHTML = '<div class="loading">Erro ao carregar refeições</div>'; return; }

  if (!templates || !templates.length) {
    el.innerHTML = '<div class="empty-meals">Sem refeições guardadas. Cria a primeira abaixo.</div>';
    return;
  }

  // Fetch item counts for all templates in one query
  const ids = templates.map(t => t.id);
  const { data: items } = await db
    .from('meal_template_items')
    .select('template_id')
    .in('template_id', ids);

  const countMap = new Map();
  (items || []).forEach(i => countMap.set(i.template_id, (countMap.get(i.template_id) || 0) + 1));

  renderMealTemplateList(el, templates, countMap, {
    showDelete: true,
    onItemClick: t => openApplyMeal(t.id, t.name),
    onDeleteClick: id => deleteMeal(id),
  });
}

async function deleteMeal(id) {
  if (!confirm('Eliminar esta refeição?')) return;
  const { error } = await db.from('meal_templates').delete().eq('id', id);
  if (error) { toast('Erro ao eliminar'); return; }
  toast('Refeição eliminada');
  loadMeals();
}

// ── CREATE MEAL SHEET ────────────────────────────────────────────────────────

function openCreateMeal(prefillName, prefillItems) {
  pushSheetState();
  mealItems = [];
  let overlay = document.getElementById('meal-create-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'meal-create-overlay';
    overlay.className = 'sheet-overlay';
    overlay.style.zIndex = '250';
    overlay.innerHTML = `
      <div class="sheet" style="max-height:90dvh;overflow-y:auto">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div class="sheet-title">Nova refeição</div>
          <div class="sheet-close" id="meal-create-close">×</div>
        </div>
        <div class="form-body">
          <label>
            <span class="lt">Nome da refeição *</span>
            <input type="text" id="mc-name" placeholder="ex: Pequeno-almoço habitual" autocomplete="off">
          </label>
          <div class="divider"></div>
          <div class="section-label" style="margin-bottom:8px">Alimentos</div>
          <div id="mc-items"></div>
          <button class="btn btn-secondary" style="margin-top:4px" onclick="mcAddItem()">+ Adicionar alimento</button>
          <div class="divider"></div>
          <button class="btn btn-primary" onclick="saveMeal()">Guardar refeição</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
    document.getElementById('meal-create-close').onclick = () => overlay.classList.remove('open');
  }

  // Pre-fill if called from meal breakdown "guardar"
  if (prefillName) {
    document.getElementById('mc-name').value = prefillName;
  } else {
    document.getElementById('mc-name').value = '';
  }

  if (prefillItems && prefillItems.length) {
    mealItems = prefillItems.map((e, i) => ({ id: i, ...e }));
    mcItemCounter = prefillItems.length; // next id starts after prefilled range
    renderMcItems();
  } else {
    mealItems = [];
    mcItemCounter = 0;
    mcAddItem();
  }

  overlay.classList.add('open');
  setTimeout(() => document.getElementById('mc-name').focus(), 300);
}

function closeMealCreate() {
  const overlay = document.getElementById('meal-create-overlay');
  if (overlay) overlay.classList.remove('open');
}

let mcItemCounter = 0;

function mcAddItem() {
  const id = ++mcItemCounter;
  mealItems.push({ id, food_id: null, food_name: '', grams: '', calories: 0, protein: 0, carbs: 0, fat: 0, saturated_fat: 0, sugar: 0, fiber: 0 });
  renderMcItems();
  // Focus the new search input
  setTimeout(() => {
    const inputs = document.querySelectorAll('.mc-food-search');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function mcRemoveItem(id) {
  mealItems = mealItems.filter(i => i.id !== id);
  renderMcItems();
}

function renderMcItems() {
  const container = document.getElementById('mc-items');
  if (!container) return;
  if (!mealItems.length) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text3);margin-bottom:8px">Nenhum alimento adicionado ainda.</div>';
    return;
  }
  container.innerHTML = mealItems.map(item => `
    <div class="mc-item" id="mc-item-${item.id}">
      <div class="mc-item-header">
        <div class="mc-item-name">${item.food_name ? escHtml(item.food_name) : '<span style="color:var(--text3)">Sem alimento</span>'}</div>
        <button class="meal-tpl-del" onclick="mcRemoveItem(${item.id})">✕</button>
      </div>
      ${item.food_id ? `
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <label style="flex:1;margin:0">
            <span class="lt">Gramas</span>
            <input type="number" inputmode="decimal" class="mc-grams"
              data-id="${item.id}" value="${item.grams}"
              placeholder="0" oninput="mcGramsChange(${item.id}, this.value)">
          </label>
          <div class="mc-item-kcal" style="font-family:var(--mono);font-size:11px;color:var(--text3);padding-top:18px;white-space:nowrap">
            ${item.calories ? Math.round(item.calories) + ' kcal' : ''}
          </div>
        </div>` : `
        <div style="margin-top:6px">
          <input type="search" class="mc-food-search" data-id="${item.id}"
            placeholder="Pesquisar alimento..."
            oninput="mcSearchFood(${item.id}, this.value)"
            autocomplete="off">
          <div class="mc-search-results" id="mc-results-${item.id}"></div>
        </div>`}
    </div>`).join('');
}

async function mcSearchFood(itemId, q) {
  const res = document.getElementById(`mc-results-${itemId}`);
  if (!res) return;
  if (!q || q.trim().length < 1) { res.innerHTML = ''; return; }
  const { data } = await db.from('foods').select('*').ilike('name', `%${q.trim()}%`).limit(10);
  if (!data || !data.length) {
    res.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:4px 0">Sem resultados</div>';
    return;
  }
  // Render markup without passing food data through HTML attributes
  // (JSON contains double-quotes that would break onclick="..." attributes)
  res.innerHTML = data.map((f, idx) =>
    `<div class="mc-food-option" data-idx="${idx}">
      <div style="font-size:13px;color:var(--text)">${escHtml(f.name)}</div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--text3)">${f.calories_per_100g} kcal · P${f.protein_per_100g} C${f.carbs_per_100g} F${f.fat_per_100g}</div>
    </div>`
  ).join('');
  // Attach listeners with food objects captured in closure — no JSON serialisation needed
  res.querySelectorAll('.mc-food-option').forEach(el => {
    const f = data[+el.dataset.idx];
    el.addEventListener('click', () => mcPickFood(itemId, f));
  });
}

function mcPickFood(itemId, f) {
  const item = mealItems.find(i => i.id === itemId);
  if (!item) return;
  item.food_id   = f.id;
  item.food_name = f.name;
  item._food     = f; // keep reference for grams calculation
  item.grams     = f.serving_size_g || '';
  if (item.grams) mcGramsChange(itemId, item.grams);
  renderMcItems();
}

function mcGramsChange(itemId, val) {
  const item = mealItems.find(i => i.id === itemId);
  if (!item || !item._food) return;
  const g = parseFloat(val) || 0;
  const f = item._food;
  const factor = g / 100;
  item.grams         = g;
  item.calories      = (f.calories_per_100g      || 0) * factor;
  item.protein       = (f.protein_per_100g       || 0) * factor;
  item.carbs         = (f.carbs_per_100g         || 0) * factor;
  item.fat           = (f.fat_per_100g           || 0) * factor;
  item.saturated_fat = (f.saturated_fat_per_100g || 0) * factor;
  item.sugar         = (f.sugar_per_100g         || 0) * factor;
  item.fiber         = (f.fiber_per_100g         || 0) * factor;
  // Update only the kcal label — no full re-render to preserve input focus
  const itemEl = document.getElementById(`mc-item-${itemId}`);
  if (itemEl) {
    const kcalEl = itemEl.querySelector('.mc-item-kcal');
    if (kcalEl) kcalEl.textContent = g > 0 ? Math.round(item.calories) + ' kcal' : '';
  }
}

let _savingMeal = false;
async function saveMeal() {
  if (_savingMeal) return;
  _savingMeal = true;
  try {
    const name = (document.getElementById('mc-name').value || '').trim();
    if (!name) { toast('Dá um nome à refeição'); return; }

    // Filter to items with a food selected and valid grams
    const validItems = mealItems.filter(i => i.food_id && parseFloat(i.grams) > 0);
    if (!validItems.length) { toast('Adiciona pelo menos um alimento com gramas'); return; }

    // Insert template
    const { data: tpl, error: e1 } = await db
      .from('meal_templates')
      .insert({ name })
      .select()
      .single();
    if (e1 || !tpl) { toast('Erro ao guardar refeição'); return; }

    // Insert items
    const rows = validItems.map(i => ({
      template_id:   tpl.id,
      food_id:       i.food_id,
      food_name:     i.food_name,
      grams:         parseFloat(i.grams),
      calories:      i.calories,
      protein:       i.protein,
      carbs:         i.carbs,
      fat:           i.fat,
      saturated_fat: i.saturated_fat,
      sugar:         i.sugar,
      fiber:         i.fiber,
    }));

    const { error: e2 } = await db.from('meal_template_items').insert(rows);
    if (e2) { toast('Erro ao guardar itens'); return; }

    toast('Refeição guardada ✓');
    closeMealCreate();
    loadMeals();
  } finally {
    _savingMeal = false;
  }
}

// ── APPLY MEAL TO DIARY ──────────────────────────────────────────────────────

let _applyMealItems = null; // items loaded for the current apply sheet
let openApplyMealGen = 0;

async function openApplyMeal(templateId, templateName) {
  pushSheetState();
  const gen = ++openApplyMealGen;
  let overlay = document.getElementById('apply-meal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'apply-meal-overlay';
    overlay.className = 'sheet-overlay';
    overlay.style.zIndex = '220';
    overlay.innerHTML = `
      <div class="sheet" style="max-height:80dvh;overflow-y:auto">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div id="apply-meal-title" class="sheet-title"></div>
          <div class="sheet-close" id="apply-meal-close">×</div>
        </div>
        <div class="form-body">
          <div id="apply-meal-items"></div>
          <div class="divider"></div>
          <label>
            <span class="lt">Adicionar a</span>
            <select id="apply-meal-select"></select>
          </label>
          <button class="btn btn-primary" id="apply-meal-btn">Adicionar ao diário</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
    document.getElementById('apply-meal-close').onclick = () => overlay.classList.remove('open');
    document.getElementById('apply-meal-btn').onclick = applyMealToDiary;
    populateMealSelect(document.getElementById('apply-meal-select'));
  }

  document.getElementById('apply-meal-title').textContent = templateName.toUpperCase();

  // Default to current selectedMeal
  const sel = document.getElementById('apply-meal-select');
  sel.value = (typeof selectedMeal !== 'undefined' ? selectedMeal : null)
              || (typeof getMealByHour === 'function' ? getMealByHour() : 'breakfast');

  // Show overlay immediately, load items async
  const itemsEl = document.getElementById('apply-meal-items');
  itemsEl.innerHTML = '<div class="loading">A carregar...</div>';
  _applyMealItems = null;
  overlay.classList.add('open');

  const { data: items, error } = await db
    .from('meal_template_items')
    .select('*')
    .eq('template_id', templateId)
    .order('id');

  if (error || !items || !items.length) {
    itemsEl.innerHTML = '<div style="font-size:13px;color:var(--text3)">Sem alimentos nesta refeição.</div>';
    return;
  }

  if (gen !== openApplyMealGen) return;
  _applyMealItems = items;
  const r = n => Math.round(+(n || 0) * 10) / 10;
  const totalKcal = items.reduce((s, i) => s + +(i.calories || 0), 0);

  itemsEl.innerHTML = items.map(i => `
    <div class="apply-meal-item">
      <div class="apply-meal-item-name">${escHtml(i.food_name)}</div>
      <div class="apply-meal-item-detail">${i.grams}g · ${Math.round(+(i.calories||0))} kcal · P${r(i.protein)}g C${r(i.carbs)}g F${r(i.fat)}g</div>
    </div>`).join('')
    + `<div class="apply-meal-total">${Math.round(totalKcal)} kcal total</div>`;
}

let _applyingMeal = false;
async function applyMealToDiary() {
  if (_applyingMeal) return;
  _applyingMeal = true;
  try {
    if (!_applyMealItems || !_applyMealItems.length) return;
    const meal = document.getElementById('apply-meal-select').value;
    const rows = _applyMealItems.map(i => ({
      date:          currentDate,
      meal,
      food_id:       i.food_id || null,
      food_name:     i.food_name,
      grams:         +(i.grams),
      calories:      +(i.calories),
      protein:       +(i.protein),
      carbs:         +(i.carbs),
      fat:           +(i.fat),
      saturated_fat: +(i.saturated_fat || 0),
      sugar:         +(i.sugar || 0),
      fiber:         +(i.fiber || 0),
    }));

    const { error } = await db.from('diary').insert(rows);
    if (error) { toast('Erro ao adicionar'); return; }

    const n = rows.length;
    toast(`${n} alimento${n !== 1 ? 's' : ''} adicionado${n !== 1 ? 's' : ''} ✓`);
    document.getElementById('apply-meal-overlay').classList.remove('open');
    _applyMealItems = null;
    selectedMeal = meal;
    loadToday();
    go('today');
  } finally {
    _applyingMeal = false;
  }
}

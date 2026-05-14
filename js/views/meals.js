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

  el.innerHTML = templates.map(t => {
    const n = countMap.get(t.id) || 0;
    const sub = n === 1 ? '1 alimento' : `${n} alimentos`;
    return `
    <div class="meal-tpl-row">
      <div class="meal-tpl-info" onclick="openMealDetail(${t.id})">
        <div class="meal-tpl-name">${t.name}</div>
        <div class="meal-tpl-sub">${sub}</div>
      </div>
      <button class="meal-tpl-del" onclick="deleteMeal(${t.id}, event)">✕</button>
    </div>`;
  }).join('');
}

async function deleteMeal(id, e) {
  if (e) e.stopPropagation();
  if (!confirm('Eliminar esta refeição?')) return;
  const { error } = await db.from('meal_templates').delete().eq('id', id);
  if (error) { toast('Erro ao eliminar'); return; }
  toast('Refeição eliminada');
  loadMeals();
}

// ── CREATE MEAL SHEET ────────────────────────────────────────────────────────

function openCreateMeal(prefillName, prefillItems) {
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
    renderMcItems();
  } else {
    mealItems = [];
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
        <div class="mc-item-name">${item.food_name || '<span style="color:var(--text3)">Sem alimento</span>'}</div>
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
          <div style="font-family:var(--mono);font-size:11px;color:var(--text3);padding-top:18px;white-space:nowrap">
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
      <div style="font-size:13px;color:var(--text)">${f.name}</div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--text3)">${f.calories_per_100g} kcal · P${f.protein_per_100g} H${f.carbs_per_100g} G${f.fat_per_100g}</div>
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
  item.grams        = g;
  item.calories     = (f.calories_per_100g     || 0) * factor;
  item.protein      = (f.protein_per_100g      || 0) * factor;
  item.carbs        = (f.carbs_per_100g        || 0) * factor;
  item.fat          = (f.fat_per_100g          || 0) * factor;
  item.saturated_fat= (f.saturated_fat_per_100g|| 0) * factor;
  item.sugar        = (f.sugar_per_100g        || 0) * factor;
  item.fiber        = (f.fiber_per_100g        || 0) * factor;
  // Update kcal display inline without full re-render
  const itemEl = document.getElementById(`mc-item-${itemId}`);
  if (itemEl) {
    const kcalEl = itemEl.querySelector('.mc-grams');
    // re-render only this item's kcal label
    renderMcItems();
  }
}

async function saveMeal() {
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
}

// ── MEAL DETAIL (future use) ─────────────────────────────────────────────────
async function openMealDetail(id) {
  // Placeholder — future fase 2 will allow logging a template
  const { data } = await db
    .from('meal_templates')
    .select('name')
    .eq('id', id)
    .single();
  if (data) toast(`"${data.name}" — em breve: registar refeição`);
}

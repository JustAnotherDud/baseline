let loadTodayGen = 0;
let currentMeals = [];   // v_meal_day do dia em vista (ordem do dia; `no` só para mostrar)

// app_config: cost_tracking_start e cost_min_coverage. null até carregar: a UI
// de custo fica escondida. 0.9 só se a chave faltar na BD.
let costConfig = null;
async function loadCostConfig() {
  if (costConfig || !db) return;
  const { data } = await db.from('app_config').select('key,value')
    .in('key', ['cost_tracking_start', 'cost_min_coverage']);
  const m = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  if (m.cost_tracking_start) costConfig = { start: m.cost_tracking_start, minCoverage: +(m.cost_min_coverage ?? 0.9) };
}

// Sem linha para a data: null (sem target).
async function getTargetsForDate(dateStr) {
  if (!db) return null;
  const { data } = await db
    .from('daily_targets')
    .select('calories,fat,saturated_fat,carbs,sugar,fiber,protein')
    .eq('date', dateStr)
    .maybeSingle();
  return data || null;
}

async function loadToday() {
  if (!db) return;
  const gen = ++loadTodayGen;
  const [{ data, error }, meals] = await Promise.all([
    db.from('diary').select('*').eq('date', currentDate).order('logged_at'),
    fetchMeals(currentDate),
  ]);
  if (error) { toast('Erro ao carregar diário'); return; }
  await loadCostConfig();
  const targets = await getTargetsForDate(currentDate)
    || { calories: 0, fat: 0, saturated_fat: 0, carbs: 0, sugar: 0, fiber: 0, protein: 0 };
  if (gen !== loadTodayGen) return;
  currentMeals = meals || [];
  renderToday(data || [], targets);
}

async function fetchMeals(dateStr) {
  if (!db) return null;
  const { data, error } = await db.from('v_meal_day').select('*').eq('date', dateStr).order('no');
  return error ? null : data;
}

// Cria uma refeição vazia (RPC meal_new); devolve o id, ou null em erro.
async function createMeal(dateStr, name = null, startedAt = null) {
  const { data, error } = await db.rpc('meal_new', { p_date: dateStr, p_name: name, p_started_at: startedAt });
  if (error || data == null) { toast('Erro ao criar refeição'); return null; }
  return data;
}

// Refeição onde gravar: a escolhida, ou uma nova ('new'). Depois de criada fica escolhida:
// os registos seguintes vão para ela.
async function resolveMealId() {
  if (selectedMealId !== 'new') return selectedMealId;
  const id = await createMeal(currentDate);
  if (id == null) return null;
  selectedMealId = id;
  mealManuallySelected = true;
  currentMeals = (await fetchMeals(currentDate)) || currentMeals;
  populateMealSelect(document.getElementById('sheet-meal-select'), id);
  return id;
}

async function saveDiary(extra = {}) {
  if (!selectedFood) return false;
  const g = parseFloat(document.getElementById('log-grams').value);
  if (!g || g <= 0) { toast('Indica a quantidade em gramas'); return false; }
  const c = v => Math.round((parseFloat(v)||0)/100*g*10)/10;
  const price = priceOverridePayload(selectedFood,
    document.getElementById('log-price-eur').value, document.getElementById('log-price-qty').value);
  if (price.error) { toast(price.error); return false; }
  const mealId = await resolveMealId();
  if (mealId == null) return false;
  const { error } = await db.from('diary').insert({
    date:currentDate, meal_id:mealId,
    food_id:selectedFood.id, food_name:selectedFood.name,
    grams:g,
    ...mapNutrients(k => c(selectedFood[k + '_per_100g'])),
    has_tara:      !!extra.has_tara,
    ...price,
  });
  if (error) { toast('Erro ao guardar'); return false; }
  toast(`${selectedFood.name} guardado ✓`);
  return true;
}

async function saveEditEntry() {
  if (!editingEntry) return;
  const isQuick = !editingEntry.grams && editingEntry.grams !== 0;
  const taraEl = document.getElementById('edit-tara-box');
  const hasTara = !!(taraEl && taraEl.classList.contains('checked'));

  if (isQuick) {
    const n = id => { const el = document.getElementById(id); return el ? parseFloat(el.value) || 0 : 0; };
    const costEl = document.getElementById('eq-cost');
    const cost = manualCostPatch(editingEntry, costEl ? costEl.value : '');
    if (cost.error) { toast(cost.error); return; }
    const { error } = await db.from('diary').update({
      ...mapNutrients(k => n('eq-' + k)),
      has_tara:      hasTara,
      ...cost,
    }).eq('id', editingEntry.id);
    if (error) { toast('Erro ao guardar'); return; }
    toast('Atualizado');
    closeEditEntry();
    loadToday();
    return;
  }

  const rawEdit = document.getElementById('edit-grams').value;
  const g = parseGramsExpr(rawEdit);
  if (!g || g <= 0) { toast('Indica a quantidade'); return; }

  const orig = editingEntry.grams || g;
  const factor = g / orig;
  const r = v => Math.round((parseFloat(v) || 0) * factor * 1000) / 1000;   // 3 casas: edições seguidas não acumulam arredondamento

  // O custo recalcula-se na BD (trigger) a partir do snapshot da entrada.
  const price = editPricePatch(editingEntry,
    document.getElementById('edit-price-eur').value, document.getElementById('edit-price-qty').value,
    !!editingEntry._resetPrice);
  if (price.error) { toast(price.error); return; }

  const { error } = await db.from('diary').update({
    grams:         g,
    ...mapNutrients(k => r(editingEntry[k])),
    has_tara:      hasTara,
    ...price,
  }).eq('id', editingEntry.id);

  if (error) { toast('Erro ao guardar'); return; }
  toast('Atualizado');
  closeEditEntry();
  loadToday();
}


async function delEntryFromEdit() {
  if (!editingEntry) return;
  if (!confirm('Eliminar este registo?')) return;
  const { error } = await db.from('diary').delete().eq('id', editingEntry.id);
  if (error) { toast('Erro ao eliminar'); return; }
  toast('Eliminado');
  closeEditEntry();
  loadToday();
}

async function getDayScores(year, month) {
  if (!db) return new Map();
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const nm   = month === 11 ? 0 : month + 1;
  const ny   = month === 11 ? year + 1 : year;
  const to   = `${ny}-${String(nm + 1).padStart(2, '0')}-01`;
  try {
    const [diaryRes, targetsRes] = await Promise.all([
      db.from('diary').select('date,calories,protein,carbs,fat').gte('date', from).lt('date', to),
      db.from('daily_targets').select('date,calories,protein,carbs,fat').gte('date', from).lt('date', to),
    ]);

    // Aggregate diary client-side by date
    const diaryMap = new Map();
    (diaryRes.data || []).forEach(e => {
      if (!diaryMap.has(e.date)) diaryMap.set(e.date, { calories: 0, protein: 0, carbs: 0, fat: 0 });
      const t = diaryMap.get(e.date);
      t.calories += +(e.calories || 0);
      t.protein  += +(e.protein  || 0);
      t.carbs    += +(e.carbs    || 0);
      t.fat      += +(e.fat      || 0);
    });

    // Targets by date
    const targetsMap = new Map();
    (targetsRes.data || []).forEach(t => targetsMap.set(t.date, t));

    // Score each day that has diary entries
    const result = new Map();
    diaryMap.forEach((totals, date) => {
      const target = targetsMap.get(date);
      if (!target) { result.set(date, 'neutral'); return; }
      let greens = 0;
      ['calories', 'protein', 'carbs', 'fat'].forEach(n => {
        const pct = target[n] > 0 ? totals[n] / target[n] * 100 : 0;
        if (getNutrientColor(n, pct) === 'var(--accent)') greens++;
      });
      result.set(date, greens >= 3 ? 'green' : greens === 2 ? 'yellow' : 'red');
    });

    return result;
  } catch {
    return new Map();
  }
}

async function moveEntryToMeal(entryId, newMealId) {
  if (!db) return false;
  const { error } = await db
    .from('diary')
    .update({ meal_id: newMealId })
    .eq('id', entryId);
  if (error) { toast('Erro ao mover entrada'); return false; }
  return true;
}

// Templates por nome e número de itens de cada um.
async function fetchMealTemplates() {
  const { data: templates, error } = await db.from('meal_templates').select('id, name').order('name');
  const countMap = new Map();
  if (error || !templates || !templates.length) return { templates: templates || [], countMap, error };
  const { data: items } = await db
    .from('meal_template_items').select('template_id').in('template_id', templates.map(t => t.id));
  (items || []).forEach(i => countMap.set(i.template_id, (countMap.get(i.template_id) || 0) + 1));
  return { templates, countMap, error: null };
}

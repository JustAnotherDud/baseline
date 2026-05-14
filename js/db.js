async function getTargetsForDate(dateStr) {
  if (!db) return getTargets();

  // 1. Tenta daily_targets para esta data específica
  const { data: daily } = await db
    .from('daily_targets')
    .select('calories,fat,saturated_fat,carbs,sugar,fiber,protein')
    .eq('date', dateStr)
    .maybeSingle();

  if (daily) {
    return {
      calories:      daily.calories,
      fat:           daily.fat,
      saturated_fat: daily.saturated_fat,
      carbs:         daily.carbs,
      sugar:         daily.sugar,
      fiber:         daily.fiber,
      protein:       daily.protein,
    };
  }

  // 2. Sem entrada específica → usa targets em cache (último push do DCB)
  return getTargets();
}

async function loadToday() {
  if (!db) return;
  const { data, error } = await db.from('diary').select('*').eq('date', currentDate).order('logged_at');
  if (error) { toast('Erro ao carregar diário'); return; }
  const targets = await getTargetsForDate(currentDate);
  renderToday(data || [], targets);
}

async function saveDiary() {
  if (!selectedFood) return false;
  const g = parseFloat(document.getElementById('log-grams').value);
  if (!g || g <= 0) { toast('Indica a quantidade em gramas'); return false; }
  const c = v => Math.round((parseFloat(v)||0)/100*g*10)/10;
  const { error } = await db.from('diary').insert({
    date:currentDate, meal:selectedMeal,
    food_id:selectedFood.id, food_name:selectedFood.name,
    grams:g,
    calories:      c(selectedFood.calories_per_100g),
    protein:       c(selectedFood.protein_per_100g),
    carbs:         c(selectedFood.carbs_per_100g),
    fat:           c(selectedFood.fat_per_100g),
    saturated_fat: c(selectedFood.saturated_fat_per_100g),
    sugar:         c(selectedFood.sugar_per_100g),
    fiber:         c(selectedFood.fiber_per_100g),
  });
  if (error) { toast('Erro ao guardar'); return false; }
  toast(`${selectedFood.name} guardado ✓`);
  return true;
}

async function saveEditEntry() {
  if (!editingEntry) return;
  const g = parseFloat(document.getElementById('edit-grams').value);
  if (!g || g <= 0) { toast('Indica a quantidade'); return; }

  const orig = editingEntry.grams || g;
  const factor = g / orig;
  const r = v => Math.round((parseFloat(v) || 0) * factor * 10) / 10;

  const { error } = await db.from('diary').update({
    grams:         g,
    calories:      r(editingEntry.calories),
    protein:       r(editingEntry.protein),
    carbs:         r(editingEntry.carbs),
    fat:           r(editingEntry.fat),
    saturated_fat: r(editingEntry.saturated_fat),
    sugar:         r(editingEntry.sugar),
    fiber:         r(editingEntry.fiber),
  }).eq('id', editingEntry.id);

  if (error) { toast('Erro ao guardar'); return; }
  toast('Actualizado');
  closeEditEntry();
  loadToday();
}

async function delEntry(id) {
  if (!confirm('Eliminar este registo?')) return;
  const {error} = await db.from('diary').delete().eq('id',id);
  if (error) { toast('Erro ao eliminar'); return; }
  toast('Eliminado'); loadToday();
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

async function getActivePhase(dateStr) {
  if (!db) return null;
  const { data, error } = await db
    .from('phases')
    .select('id, label, objetivo')
    .lte('start_date', dateStr)
    .or(`end_date.is.null,end_date.gte.${dateStr}`)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function getPhaseTargets(phaseId, dayType) {
  if (!db) return null;
  const { data, error } = await db
    .from('phase_targets')
    .select('*')
    .eq('phase_id', phaseId)
    .eq('day_type', dayType)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}


async function fetchTargetsFromSupabase(dayType) {
  if (!db) return null;
  const { data, error } = await db.from('targets').select('*').eq('day_type', dayType).single();
  if (error || !data) return null;
  return {
    calories:      data.calories,
    fat:           data.fat,
    saturated_fat: data.saturated_fat,
    carbs:         data.carbs,
    sugar:         data.sugar,
    fiber:         data.fiber,
    protein:       data.protein,
  };
}

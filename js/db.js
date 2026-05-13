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

  // 2. Fallback: day_type activo na tabela targets
  const dayType = localStorage.getItem('nt_day_type') || 'training_plus_work';
  const t = await fetchTargetsFromSupabase(dayType);
  if (t) return t;

  // 3. Fallback final: cachedTargets (localStorage / memória)
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
  if (!selectedFood) return;
  const g = parseFloat(document.getElementById('log-grams').value);
  if (!g||g<=0) { toast('Indica a quantidade em gramas'); return; }
  const c = v => Math.round((parseFloat(v)||0)/100*g*10)/10;
  const {error} = await db.from('diary').insert({
    date:currentDate, meal:selectedMeal,
    food_id:selectedFood.id, food_name:selectedFood.name,
    grams:g,
    calories:c(selectedFood.calories_per_100g),
    protein:c(selectedFood.protein_per_100g),
    carbs:c(selectedFood.carbs_per_100g),
    fat:c(selectedFood.fat_per_100g),
    saturated_fat:c(selectedFood.saturated_fat_per_100g),
    sugar:c(selectedFood.sugar_per_100g),
    fiber:c(selectedFood.fiber_per_100g)
  });
  if (error) { toast('Erro ao guardar'); return; }
  toast(`${selectedFood.name} guardado ✓`);
  loadToday();
  // Voltar ao stage de pesquisa sem fechar o sheet
  selectedFood = null;
  document.getElementById('log-stage-grams').classList.remove('active');
  document.getElementById('log-stage-search').classList.add('active');
  document.getElementById('log-q').value = '';
  document.getElementById('log-results').innerHTML = '<div class="loading">Começa a escrever para pesquisar</div>';
  loadLogTotalsStrip();
  setTimeout(() => document.getElementById('log-q').focus(), 100);
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

async function getDaysWithEntries(year, month) {
  if (!db) return new Set();
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const nm   = month === 11 ? 0 : month + 1;
  const ny   = month === 11 ? year + 1 : year;
  const to   = `${ny}-${String(nm + 1).padStart(2, '0')}-01`;
  try {
    const { data } = await db.from('diary').select('date').gte('date', from).lt('date', to);
    if (!data) return new Set();
    return new Set(data.map(e => e.date));
  } catch {
    return new Set();
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

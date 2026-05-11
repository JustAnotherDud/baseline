async function loadToday() {
  if (!db) return;
  const { data, error } = await db.from('diary').select('*').eq('date', currentDate).order('logged_at');
  if (error) { toast('Erro ao carregar diário'); return; }
  renderToday(data || []);
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
  toast(`${selectedFood.name} registado`);
  closeLog(); loadToday(); go('today');
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

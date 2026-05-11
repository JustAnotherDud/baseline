async function loadTargetsForDayType(dayType) {
  document.getElementById('targets-loading').style.display = 'block';
  document.getElementById('targets-display').style.opacity = '0.4';
  const t = await fetchTargetsFromSupabase(dayType);
  document.getElementById('targets-loading').style.display = 'none';
  document.getElementById('targets-display').style.opacity = '1';
  if (!t) { toast('Erro ao carregar targets'); return; }
  cachedTargets = t;
  localStorage.setItem('nt_targets', JSON.stringify(t));
  localStorage.setItem('nt_day_type', dayType);
  document.getElementById('t-kcal').value  = t.calories;
  document.getElementById('t-fat').value   = t.fat;
  document.getElementById('t-satfat').value= t.saturated_fat;
  document.getElementById('t-carb').value  = t.carbs;
  document.getElementById('t-sugar').value = t.sugar;
  document.getElementById('t-fiber').value = t.fiber;
  document.getElementById('t-prot').value  = t.protein;
  loadToday();
}

function setFieldsEditable(editable) {
  ['t-kcal','t-fat','t-satfat','t-carb','t-sugar','t-fiber','t-prot'].forEach(id => {
    const el = document.getElementById(id);
    el.readOnly = !editable;
    el.style.opacity = editable ? '1' : '0.6';
  });
  document.getElementById('save-custom-btn').style.display = editable ? 'block' : 'none';
  document.getElementById('targets-hint').style.display = editable ? 'none' : 'block';
}

async function onDayTypeChange() {
  const dayType = document.getElementById('day-type-select').value;
  if (dayType === 'custom') {
    setFieldsEditable(true);
    localStorage.setItem('nt_day_type', 'custom');
    return;
  }
  setFieldsEditable(false);
  await loadTargetsForDayType(dayType);
}

function saveCustomTargets() {
  const t = {
    calories:      parseFloat(document.getElementById('t-kcal').value)||2300,
    fat:           parseFloat(document.getElementById('t-fat').value)||70,
    saturated_fat: parseFloat(document.getElementById('t-satfat').value)||20,
    carbs:         parseFloat(document.getElementById('t-carb').value)||230,
    sugar:         parseFloat(document.getElementById('t-sugar').value)||150,
    fiber:         parseFloat(document.getElementById('t-fiber').value)||30,
    protein:       parseFloat(document.getElementById('t-prot').value)||160,
  };
  cachedTargets = t;
  localStorage.setItem('nt_targets', JSON.stringify(t));
  localStorage.setItem('nt_day_type', 'custom');
  toast('Targets personalizados guardados');
  loadToday();
}

function loadTargetsForm() {
  const saved = JSON.parse(localStorage.getItem('nt_targets') || 'null');
  const dayType = localStorage.getItem('nt_day_type') || 'training_plus_work';
  if (saved) cachedTargets = saved;
  document.getElementById('day-type-select').value = dayType;
  if (saved) {
    document.getElementById('t-kcal').value   = saved.calories;
    document.getElementById('t-fat').value    = saved.fat;
    document.getElementById('t-satfat').value = saved.saturated_fat;
    document.getElementById('t-carb').value   = saved.carbs;
    document.getElementById('t-sugar').value  = saved.sugar;
    document.getElementById('t-fiber').value  = saved.fiber;
    document.getElementById('t-prot').value   = saved.protein;
  }
  if (dayType === 'custom') {
    setFieldsEditable(true);
  } else {
    setFieldsEditable(false);
    loadTargetsForDayType(dayType);
  }
}

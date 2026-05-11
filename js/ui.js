let toastT;
function toast(msg) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),2400);
}

function overlayClose(e, id) { if(e.target.id===id) document.getElementById(id).classList.remove('open'); }

function openLog(mode) {
  if (!mealManuallySelected) {
    selectedMeal = getMealByHour();
    document.querySelectorAll('#log-meal-tabs .meal-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.meal === selectedMeal);
    });
  }
  document.getElementById('log-sheet-title').textContent = mode==='db' ? 'Pesquisar alimento' : 'Entrada rápida';
  document.getElementById('log-db').style.display    = mode==='db'    ? 'block' : 'none';
  document.getElementById('log-quick').style.display = mode==='quick' ? 'block' : 'none';
  if (mode==='db') {
    document.getElementById('log-stage-search').classList.add('active');
    document.getElementById('log-stage-grams').classList.remove('active');
    document.getElementById('log-q').value='';
    document.getElementById('log-results').innerHTML='<div class="loading">Começa a escrever para pesquisar</div>';
    loadRecentFoods();
    setTimeout(()=>document.getElementById('log-q').focus(),300);
  } else {
    clearQuick();
    setTimeout(()=>document.getElementById('q-name').focus(),300);
  }
  document.getElementById('sheet-log').classList.add('open');
  loadLogTotalsStrip();
}

function closeLog() {
  document.getElementById('sheet-log').classList.remove('open');
  selectedFood=null;
}

function openAddFood() {
  editingFoodId=null;
  document.getElementById('food-sheet-title').textContent='Novo alimento';
  document.getElementById('del-food-btn').style.display='none';
  ['f-name','f-brand','f-serving','f-kcal','f-prot','f-carb','f-fat','f-satfat','f-sugar','f-fiber'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('sheet-food').classList.add('open');
  setTimeout(()=>document.getElementById('f-name').focus(),300);
}

function closeAddFood() {
  document.getElementById('sheet-food').classList.remove('open');
  editingFoodId = null;
  fromLogContext = false;
}

async function openEditEntry(id) {
  const { data, error } = await db.from('diary').select('*').eq('id', id).single();
  if (error || !data) return;
  editingEntry = data;

  document.getElementById('edit-food-card').innerHTML = `
    <div class="food-card-name">${data.food_name}</div>
    <div class="food-card-sub">${data.grams ? 'Peso original: ' + data.grams + 'g' : 'Entrada rápida'}</div>`;

  document.getElementById('edit-grams').value = data.grams || '';
  updateEditPreview();
  document.getElementById('sheet-edit').classList.add('open');
  setTimeout(() => document.getElementById('edit-grams').focus(), 300);
}

function closeEditEntry() {
  document.getElementById('sheet-edit').classList.remove('open');
  editingEntry = null;
}

function updateEditPreview() {
  if (!editingEntry) return;
  const g = parseFloat(document.getElementById('edit-grams').value) || 0;
  const orig = editingEntry.grams || 1;
  const factor = g / orig;
  const c = (v) => Math.round((parseFloat(v) || 0) * factor);
  document.getElementById('ep-kcal').textContent   = c(editingEntry.calories);
  document.getElementById('ep-fat').textContent    = c(editingEntry.fat);
  document.getElementById('ep-satfat').textContent = c(editingEntry.saturated_fat);
  document.getElementById('ep-carb').textContent   = c(editingEntry.carbs);
  document.getElementById('ep-sugar').textContent  = c(editingEntry.sugar);
  document.getElementById('ep-fiber').textContent  = c(editingEntry.fiber);
  document.getElementById('ep-prot').textContent   = c(editingEntry.protein);
}

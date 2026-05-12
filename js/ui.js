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
  updateSheetMealTabs();
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

function openDatePicker(selectedVal, onSelect) {
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DAYS   = ['D','S','T','Q','Q','S','S'];
  const today  = new Date().toISOString().split('T')[0];

  let overlay = document.getElementById('dp-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dp-overlay';
    overlay.className = 'sheet-overlay';
    overlay.style.zIndex = '300';
    overlay.innerHTML = `
      <div class="sheet" style="max-height:420px">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div style="display:flex;align-items:center;gap:8px">
            <button id="dp-prev" style="background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer;padding:4px 10px;line-height:1">←</button>
            <div id="dp-label" class="sheet-title" style="min-width:150px;text-align:center"></div>
            <button id="dp-next" style="background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer;padding:4px 10px;line-height:1">→</button>
          </div>
          <div class="sheet-close" id="dp-close">×</div>
        </div>
        <div style="padding:10px 14px 20px">
          <div id="dp-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  const parts = selectedVal.split('-');
  let viewYear  = parseInt(parts[0]);
  let viewMonth = parseInt(parts[1]) - 1;

  function render() {
    document.getElementById('dp-label').textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    const grid = document.getElementById('dp-grid');
    grid.innerHTML = '';

    DAYS.forEach(d => {
      const el = document.createElement('div');
      el.textContent = d;
      el.style.cssText = 'font-family:var(--mono);font-size:10px;color:var(--text3);padding:5px 0;font-weight:500';
      grid.appendChild(el);
    });

    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    for (let i = 0; i < firstWeekday; i++) grid.appendChild(document.createElement('div'));

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const btn = document.createElement('button');
      btn.textContent = d;
      const isSel   = ds === selectedVal;
      const isToday = ds === today;
      btn.style.cssText = [
        'width:100%;aspect-ratio:1;border-radius:50%;cursor:pointer;font-size:14px',
        'font-family:var(--sans);transition:background .1s',
        isSel   ? 'background:var(--accent);color:#0a0a0a;font-weight:700;border:none'
                : isToday ? 'background:transparent;color:var(--accent);font-weight:600;border:1px solid var(--accent)'
                          : 'background:transparent;color:var(--text);border:none',
      ].join(';');
      btn.onclick = () => { overlay.classList.remove('open'); onSelect(ds); };
      grid.appendChild(btn);
    }
  }

  document.getElementById('dp-prev').onclick = () => {
    if (--viewMonth < 0) { viewMonth = 11; viewYear--; } render();
  };
  document.getElementById('dp-next').onclick = () => {
    if (++viewMonth > 11) { viewMonth = 0; viewYear++; } render();
  };
  document.getElementById('dp-close').onclick = () => overlay.classList.remove('open');
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };

  render();
  overlay.classList.add('open');
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

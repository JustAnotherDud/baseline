let allFoods = [];

const SORT_CONFIG = {
  name:     { asc: 'Nome A→Z', desc: 'Nome Z→A', default: 'asc'  },
  calories: { asc: 'Kcal ↓',   desc: 'Kcal ↑',   default: 'desc' },
  p_kcal:   { asc: 'P/Kcal ↓', desc: 'P/Kcal ↑', default: 'desc' },
  c_kcal:   { asc: 'C/Kcal ↓', desc: 'C/Kcal ↑', default: 'desc' },
  f_kcal:   { asc: 'F/Kcal ↓', desc: 'F/Kcal ↑', default: 'desc' },
};

// key -> macro field used for the per-kcal ratio chips
const RATIO_FIELD = { p_kcal: 'protein_per_100g', c_kcal: 'carbs_per_100g', f_kcal: 'fat_per_100g' };

let currentSortState = { sort: 'name', dir: 'asc' };

async function loadFoods() {
  if (!db) return;
  const { data, error } = await db.from('foods').select('*').order('name');
  if (error) {
    console.error('loadFoods error:', error.message);
    const list = document.getElementById('foods-list');
    if (list) {
      list.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'empty-state';
      msg.textContent = 'Erro ao carregar alimentos. Verifica a ligação.';
      list.appendChild(msg);
    }
    return;
  }
  allFoods = data || [];
  document.getElementById('foods-count').textContent = `${allFoods.length} alimentos`;
  filterFoods();
}

function sortFoods(foods) {
  const { sort, dir } = currentSortState;
  const arr = [...foods];
  const mul = dir === 'asc' ? 1 : -1;
  const ratio = (val, kcal) => kcal ? (val || 0) / kcal : 0;
  switch (sort) {
    case 'calories': return arr.sort((a,b) => mul * (a.calories_per_100g - b.calories_per_100g));
    case 'p_kcal':
    case 'c_kcal':
    case 'f_kcal': {
      const field = RATIO_FIELD[sort];
      return arr.sort((a,b) => mul * (ratio(a[field], a.calories_per_100g) - ratio(b[field], b.calories_per_100g)));
    }
    default:         return arr.sort((a,b) => mul * a.name.localeCompare(b.name, 'pt'));
  }
}

function setSortFoods(sort) {
  if (currentSortState.sort === sort) {
    currentSortState.dir = currentSortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortState = { sort, dir: SORT_CONFIG[sort].default };
  }
  document.querySelectorAll('.sort-chip[data-sort]').forEach(c => {
    const s = c.dataset.sort;
    const isActive = s === currentSortState.sort;
    c.classList.toggle('active', isActive);
    c.textContent = SORT_CONFIG[s][isActive ? currentSortState.dir : SORT_CONFIG[s].default];
  });
  filterFoods();
}

function filterFoods() {
  const raw = document.getElementById('foods-search').value;
  const terms = raw.split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0);
  const filtered = terms.length === 0
    ? allFoods
    : allFoods.filter(f =>
        terms.some(t =>
          f.name.toLowerCase().includes(t) ||
          (f.brand || '').toLowerCase().includes(t)
        )
      );
  renderFoods(sortFoods(filtered));
}

function renderFoods(foods) {
  const el = document.getElementById('foods-list');
  if (!foods.length) {
    el.innerHTML=`<div class="empty"><div class="empty-icon">🥗</div><div class="empty-text">Sem alimentos ainda.<br>Clica em + para adicionar o primeiro.</div></div>`;
    return;
  }

  const sort = currentSortState.sort;
  const HL = 'color:var(--accent);font-weight:600';
  const RATIO_META = {
    p_kcal: { field: 'protein_per_100g', label: 'P/kcal', macro: 'P' },
    c_kcal: { field: 'carbs_per_100g',   label: 'C/kcal', macro: 'C' },
    f_kcal: { field: 'fat_per_100g',     label: 'F/kcal', macro: 'F' },
  };
  const hlMacro = RATIO_META[sort] ? RATIO_META[sort].macro : null;
  const macroStr = (letter, val) =>
    hlMacro === letter ? `<span style="${HL}">${letter}${val}</span>` : `${letter}${val}`;

  el.innerHTML = '';
  foods.forEach(f => {
    const pStr = macroStr('P', f.protein_per_100g);
    const cStr = macroStr('C', f.carbs_per_100g);
    const gStr = macroStr('F', f.fat_per_100g);

    // Right column: ratio for P/C/F per-kcal chips, otherwise kcal/100g
    // All values are numeric — safe for innerHTML
    let rightCol;
    if (RATIO_META[sort]) {
      const meta  = RATIO_META[sort];
      const kcal  = f.calories_per_100g || 0;
      const ratio = kcal ? (f[meta.field] / kcal).toFixed(2) : '—';
      rightCol = `<div class="fi-kcal" style="${HL}">${ratio}<br><span style="font-size:9px;color:var(--text3)">${meta.label}</span></div>`;
    } else {
      const kcalStyle = sort === 'calories' ? HL : '';
      rightCol = `<div class="fi-kcal" style="${kcalStyle}">${f.calories_per_100g}<br><span style="font-size:9px;color:var(--text3)">kcal/100g</span></div>`;
    }

    const item = document.createElement('div');
    item.className = 'food-item';
    item.onclick = () => editFood(f.id);

    const info = document.createElement('div');
    info.className = 'fi-info';

    // name and brand are user data — use textContent / createTextNode
    const nameEl = document.createElement('div');
    nameEl.className = 'fi-name';
    nameEl.innerHTML = highlightFoodKeywords(f.name);

    const detail = document.createElement('div');
    detail.className = 'fi-detail';
    const servingStr = f.serving_size_g ? ` · porção ${f.serving_size_g}g` : '';
    detail.innerHTML = `${pStr} ${cStr} ${gStr}${servingStr}`;
    if (f.brand) {
      detail.insertBefore(document.createTextNode(f.brand + ' · '), detail.firstChild);
    }

    const rightEl = document.createElement('div');
    rightEl.innerHTML = rightCol;

    info.appendChild(nameEl);
    info.appendChild(detail);
    item.appendChild(info);
    item.appendChild(rightEl.firstElementChild);
    el.appendChild(item);
  });
}

function editFood(id) {
  const f = allFoods.find(x=>x.id===id);
  if (!f) return;
  editingFoodId=id;
  document.getElementById('food-sheet-title').textContent='Editar alimento';
  document.getElementById('del-food-btn').style.display='block';
  document.getElementById('f-name').value=f.name;
  document.getElementById('f-brand').value=f.brand||'';
  document.getElementById('f-serving').value=f.serving_size_g||'';
  document.getElementById('f-kcal').value=f.calories_per_100g;
  document.getElementById('f-prot').value=f.protein_per_100g;
  document.getElementById('f-carb').value=f.carbs_per_100g;
  document.getElementById('f-fat').value=f.fat_per_100g;
  document.getElementById('f-satfat').value=f.saturated_fat_per_100g||'';
  document.getElementById('f-sugar').value=f.sugar_per_100g||'';
  document.getElementById('f-fiber').value=f.fiber_per_100g||'';
  document.getElementById('sheet-food').classList.add('open');
}

async function saveFood() {
  const name=document.getElementById('f-name').value.trim();
  const kcal=parseFloat(document.getElementById('f-kcal').value);
  const prot=parseFloat(document.getElementById('f-prot').value);
  const carb=parseFloat(document.getElementById('f-carb').value);
  const fat=parseFloat(document.getElementById('f-fat').value);
  if (!name||isNaN(kcal)||isNaN(prot)||isNaN(carb)||isNaN(fat)) { toast('Preenche os campos obrigatórios (*)'); return; }
  const food={
    name, brand:document.getElementById('f-brand').value.trim()||null,
    serving_size_g:parseFloat(document.getElementById('f-serving').value)||null,
    calories_per_100g:kcal, protein_per_100g:prot, carbs_per_100g:carb, fat_per_100g:fat,
    saturated_fat_per_100g:parseFloat(document.getElementById('f-satfat').value)||0,
    sugar_per_100g:parseFloat(document.getElementById('f-sugar').value)||0,
    fiber_per_100g:parseFloat(document.getElementById('f-fiber').value)||0
  };
  let error, data2;
  if (editingFoodId) {
    ({ error } = await db.from('foods').update(food).eq('id',editingFoodId));
  } else {
    ({ error, data: data2 } = await db.from('foods').insert(food).select().single());
  }
  if (error) { toast('Erro ao guardar'); return; }
  toast(editingFoodId?'Actualizado':'Alimento adicionado');
  closeAddFood();
  loadFoods();
  if (!editingFoodId && fromLogContext && data2) {
    fromLogContext = false;
    document.getElementById('sheet-log').classList.add('open');
    await pickFood(data2.id);
  } else {
    fromLogContext = false;
  }
}

async function deleteFood() {
  if (!confirm('Eliminar este alimento?')) return;
  const {error}=await db.from('foods').delete().eq('id',editingFoodId);
  if (error) { toast('Erro ao eliminar'); return; }
  toast('Eliminado'); closeAddFood(); loadFoods();
}

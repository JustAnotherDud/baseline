const SORT_CONFIG = {
  name:     { asc: 'Nome A→Z',   desc: 'Nome Z→A',  default: 'asc'  },
  protein:  { asc: 'Proteína ↓', desc: 'Proteína ↑', default: 'desc' },
  calories: { asc: 'Kcal ↓',    desc: 'Kcal ↑',     default: 'desc' },
};

const MORE_SORTS = [
  { group: 'NUTRIENTES (por 100g)' },
  { key: 'carbs',  label: 'Hidratos ↑',       fn: f => f.carbs_per_100g || 0 },
  { key: 'fiber',  label: 'Fibra ↑',           fn: f => f.fiber_per_100g || 0 },
  { key: 'fat',    label: 'Gordura ↑',         fn: f => f.fat_per_100g || 0 },
  { key: 'satfat', label: 'Gord. Saturada ↑',  fn: f => f.saturated_fat_per_100g || 0 },
  { key: 'sugar',  label: 'Açúcar ↑',          fn: f => f.sugar_per_100g || 0 },
  { group: 'RÁCIOS' },
  { key: 'p_kcal', label: 'P/Kcal ↑',         fn: f => f.calories_per_100g ? f.protein_per_100g / f.calories_per_100g : 0 },
  { key: 'h_kcal', label: 'H/Kcal ↑',         fn: f => f.calories_per_100g ? f.carbs_per_100g / f.calories_per_100g : 0 },
  { key: 'f_kcal', label: 'Fibra/Kcal ↑',     fn: f => f.calories_per_100g ? (f.fiber_per_100g || 0) / f.calories_per_100g : 0 },
  { key: 'recent', label: 'Recente',           fn: f => f.id },
];
const MORE_SORT_MAP    = new Map(MORE_SORTS.filter(s => s.key).map(s => [s.key, s]));
const MORE_SORT_LABELS = Object.fromEntries(MORE_SORTS.filter(s => s.key).map(s => [s.key, s.label]));

let currentSortState = { sort: 'name', dir: 'asc' };
let currentMoreSort  = null;
let currentMoreDir   = 'desc';

async function loadFoods() {
  if (!db) return;
  const {data} = await db.from('foods').select('*').order('name');
  allFoods = data||[];
  document.getElementById('foods-count').textContent = `${allFoods.length} alimentos`;
  filterFoods();
}

function sortFoods(foods) {
  if (currentMoreSort) {
    const s   = MORE_SORT_MAP.get(currentMoreSort);
    const mul = currentMoreDir === 'asc' ? 1 : -1;
    return [...foods].sort((a, b) => mul * (s.fn(a) - s.fn(b)));
  }
  const { sort, dir } = currentSortState;
  const arr = [...foods];
  const mul = dir === 'asc' ? 1 : -1;
  switch (sort) {
    case 'protein':  return arr.sort((a,b) => mul * (a.protein_per_100g  - b.protein_per_100g));
    case 'calories': return arr.sort((a,b) => mul * (a.calories_per_100g - b.calories_per_100g));
    default:         return arr.sort((a,b) => mul * a.name.localeCompare(b.name, 'pt'));
  }
}

function setSortFoods(sort) {
  currentMoreSort = null;
  currentMoreDir  = 'desc';
  const moreChip = document.getElementById('sort-chip-more');
  if (moreChip) { moreChip.classList.remove('active'); moreChip.textContent = 'Mais ↓'; }
  closeMoreMenu();
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

function _moreMenuOutside(e) {
  const menu = document.getElementById('sort-more-menu');
  const chip = document.getElementById('sort-chip-more');
  if (menu && !menu.contains(e.target) && e.target !== chip) closeMoreMenu();
}

function closeMoreMenu() {
  const menu = document.getElementById('sort-more-menu');
  if (menu) menu.style.display = 'none';
  document.removeEventListener('click', _moreMenuOutside);
}

function toggleMoreMenu() {
  const menu = document.getElementById('sort-more-menu');
  if (!menu) return;
  if (menu.style.display !== 'none') { closeMoreMenu(); return; }

  // Rebuild each open to reflect current active sort + direction
  menu.innerHTML = MORE_SORTS.map(s => {
    if (s.group) return `<div class="sort-more-group">${s.group}</div>`;
    const isActive = s.key === currentMoreSort;
    const lbl = isActive && currentMoreDir === 'asc' ? s.label.replace('↑', '↓') : s.label;
    return `<div class="sort-more-item${isActive ? ' sort-more-item-active' : ''}" onclick="selectMoreSort('${s.key}')">${lbl}</div>`;
  }).join('');

  // Position with viewport overflow detection
  const chip  = document.getElementById('sort-chip-more');
  const rect  = chip.getBoundingClientRect();
  const menuW = 180;

  let left = rect.left;
  if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
  if (left < 8) left = 8;
  menu.style.left = `${left}px`;

  if (window.innerHeight - rect.bottom >= 300) {
    menu.style.top    = `${rect.bottom + 6}px`;
    menu.style.bottom = 'auto';
  } else {
    menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    menu.style.top    = 'auto';
  }

  menu.style.display = 'block';
  setTimeout(() => document.addEventListener('click', _moreMenuOutside), 0);
}

function selectMoreSort(key) {
  if (currentMoreSort === key) {
    currentMoreDir = currentMoreDir === 'desc' ? 'asc' : 'desc';
  } else {
    currentMoreSort = key;
    currentMoreDir  = 'desc';
  }
  currentSortState = { sort: null, dir: null };
  closeMoreMenu();
  document.querySelectorAll('.sort-chip[data-sort]').forEach(c => c.classList.remove('active'));
  const moreChip = document.getElementById('sort-chip-more');
  if (moreChip) {
    const base  = MORE_SORT_LABELS[key];
    const label = currentMoreDir === 'asc' ? base.replace('↑', '↓') : base;
    moreChip.textContent = label;
    moreChip.classList.add('active');
  }
  filterFoods();
}

function filterFoods() {
  const q = document.getElementById('foods-search').value.toLowerCase();
  const filtered = q ? allFoods.filter(f=>f.name.toLowerCase().includes(q)||(f.brand||'').toLowerCase().includes(q)) : allFoods;
  renderFoods(sortFoods(filtered));
}

function renderFoods(foods) {
  const el = document.getElementById('foods-list');
  if (!foods.length) {
    el.innerHTML=`<div class="empty"><div class="empty-icon">🥗</div><div class="empty-text">Sem alimentos ainda.<br>Clica em + para adicionar o primeiro.</div></div>`;
    return;
  }

  const activeSort = currentSortState.sort;
  const ms = currentMoreSort;
  const RATIO_LABEL = { p_kcal: 'P/kcal', h_kcal: 'H/kcal', f_kcal: 'Fb/kcal' };
  const HL = 'color:var(--accent);font-weight:600';

  el.innerHTML = foods.map(f => {
    // Protein — highlight when main 'protein' chip active
    const pStr = activeSort === 'protein'
      ? `<span style="${HL}">P${f.protein_per_100g}</span>`
      : `P${f.protein_per_100g}`;

    // Carbs — highlight when MORE carbs active
    const cStr = ms === 'carbs'
      ? `<span style="${HL}">C${f.carbs_per_100g}</span>`
      : `C${f.carbs_per_100g}`;

    // Fat — highlight when MORE fat active
    const gStr = ms === 'fat'
      ? `<span style="${HL}">G${f.fat_per_100g}</span>`
      : `G${f.fat_per_100g}`;

    // Right column: kcal default, swapped for hidden fields + ratios
    let rightCol;
    if (RATIO_LABEL[ms]) {
      const kcal  = f.calories_per_100g || 0;
      const ratio = kcal ? MORE_SORT_MAP.get(ms).fn(f).toFixed(2) : '—';
      rightCol = `<div class="fi-kcal" style="${HL}">${ratio}<br><span style="font-size:9px;color:var(--text3)">${RATIO_LABEL[ms]}</span></div>`;
    } else if (ms === 'fiber') {
      rightCol = `<div class="fi-kcal" style="${HL}">${f.fiber_per_100g || 0}g<br><span style="font-size:9px;color:var(--text3)">fb/100g</span></div>`;
    } else if (ms === 'satfat') {
      rightCol = `<div class="fi-kcal" style="${HL}">${f.saturated_fat_per_100g || 0}g<br><span style="font-size:9px;color:var(--text3)">gs/100g</span></div>`;
    } else if (ms === 'sugar') {
      rightCol = `<div class="fi-kcal" style="${HL}">${f.sugar_per_100g || 0}g<br><span style="font-size:9px;color:var(--text3)">a/100g</span></div>`;
    } else {
      const kcalStyle = activeSort === 'calories' ? HL : '';
      rightCol = `<div class="fi-kcal" style="${kcalStyle}">${f.calories_per_100g}<br><span style="font-size:9px;color:var(--text3)">kcal/100g</span></div>`;
    }

    return `
    <div class="food-item" onclick="editFood(${f.id})">
      <div class="fi-info">
        <div class="fi-name">${f.name}</div>
        <div class="fi-detail">${f.brand?f.brand+' · ':''}${pStr} ${cStr} ${gStr}${f.serving_size_g?' · porção '+f.serving_size_g+'g':''}</div>
      </div>
      ${rightCol}
    </div>`;
  }).join('');
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

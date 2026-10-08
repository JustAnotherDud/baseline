let allFoods = [];

const SORT_CONFIG = {
  name:     { asc: 'Nome A→Z', desc: 'Nome Z→A', default: 'asc'  },
  calories: { asc: 'Kcal ↓',   desc: 'Kcal ↑',   default: 'desc' },
  p_kcal:   { asc: 'P/Kcal ↓', desc: 'P/Kcal ↑', default: 'desc' },
  c_kcal:   { asc: 'C/Kcal ↓', desc: 'C/Kcal ↑', default: 'desc' },
  f_kcal:   { asc: 'F/Kcal ↓', desc: 'F/Kcal ↑', default: 'desc' },
  eur_100g: { asc: '€/100g ↓', desc: '€/100g ↑', default: 'asc'  },
  kcal_eur: { asc: 'Kcal/€ ↓', desc: 'Kcal/€ ↑', default: 'desc' },
  prot_eur: { asc: 'P/€ ↓',    desc: 'P/€ ↑',    default: 'desc' },
};

// Linha de ajuda por baixo dos chips: ordem activa (+ filtro de pesquisa, se houver).
const SORT_HELP = {
  name:     { asc: 'nome A→Z', desc: 'nome Z→A' },
  calories: { asc: 'menos kcal primeiro', desc: 'mais kcal primeiro' },
  p_kcal:   { asc: 'menos proteína por kcal primeiro', desc: 'mais proteína por kcal primeiro' },
  c_kcal:   { asc: 'menos hidratos por kcal primeiro', desc: 'mais hidratos por kcal primeiro' },
  f_kcal:   { asc: 'menos gordura por kcal primeiro', desc: 'mais gordura por kcal primeiro' },
  eur_100g: { asc: 'mais barato primeiro', desc: 'mais caro primeiro' },
  kcal_eur: { asc: 'menos kcal por € primeiro', desc: 'mais kcal por € primeiro' },
  prot_eur: { asc: 'menos proteína por € primeiro', desc: 'mais proteína por € primeiro' },
};

function foodsHelpLines(sort, dir, rawQuery) {
  const sortTxt = 'Ordem: ' + SORT_HELP[sort][dir] + (COST_SORT_META[sort] ? ' · sem preço no fim' : '');
  const q = describeFoodQuery(rawQuery);
  return { sort: sortTxt, filter: q ? 'Filtro: ' + q : '' };
}

// Chips de custo: valor mostrado na coluna direita. Sem preço: '—' e fim da lista.
const COST_SORT_META = {
  eur_100g: { label: '€/100g',  dec: 2 },
  kcal_eur: { label: 'kcal/€',  dec: 0 },
  prot_eur: { label: 'g P/€',   dec: 1 },
};

// Chips de rácio macro/kcal.
const RATIO_META = {
  p_kcal: { field: 'protein_per_100g', label: 'P/kcal', macro: 'P' },
  c_kcal: { field: 'carbs_per_100g',   label: 'C/kcal', macro: 'C' },
  f_kcal: { field: 'fat_per_100g',     label: 'F/kcal', macro: 'F' },
};

let currentSortState = { sort: 'name', dir: 'asc' };

// Alimento a abrir no editor assim que a lista carregar (vindo do sheet de uma entrada).
let pendingFoodEdit = null;

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
  promoStock = await fetchPromoStock();
  document.getElementById('foods-count').textContent = `${allFoods.length} alimentos`;
  filterFoods();
  if (pendingFoodEdit != null) {
    const id = pendingFoodEdit;
    pendingFoodEdit = null;
    if (allFoods.some(f => f.id === id)) editFood(id);
    else toast('O alimento já não existe');
  }
}

function sortFoods(foods) {
  return sortFoodsBy(foods, currentSortState.sort, currentSortState.dir);
}

function sortFoodsBy(foods, sort, dir) {
  const arr = [...foods];
  const mul = dir === 'asc' ? 1 : -1;
  const ratio = (val, kcal) => kcal ? (val || 0) / kcal : 0;
  if (COST_SORT_META[sort]) {
    // Sem preço vai sempre para o fim, qualquer que seja a direcção.
    return arr.sort((a, b) => {
      const x = foodCostMetric(a, sort), y = foodCostMetric(b, sort);
      if (x === null || y === null) return x === y ? a.name.localeCompare(b.name, 'pt') : x === null ? 1 : -1;
      return x === y ? 0 : mul * (x - y);   // grátis: kcal/€ e P/€ são Infinity
    });
  }
  switch (sort) {
    case 'calories': return arr.sort((a,b) => mul * (a.calories_per_100g - b.calories_per_100g));
    case 'p_kcal':
    case 'c_kcal':
    case 'f_kcal': {
      const field = RATIO_META[sort].field;
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
  const filtered = allFoods.filter(f => foodMatchesQuery(f, raw));
  document.getElementById('foods-count').textContent = filtered.length === allFoods.length
    ? `${allFoods.length} alimentos` : `${filtered.length} de ${allFoods.length} alimentos`;
  const help = foodsHelpLines(currentSortState.sort, currentSortState.dir, raw);
  document.getElementById('foods-help-sort').textContent = help.sort;
  const fEl = document.getElementById('foods-help-filter');
  fEl.textContent = help.filter;
  fEl.style.display = help.filter ? '' : 'none';
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
  const hlMacro = RATIO_META[sort] ? RATIO_META[sort].macro : null;
  const macroStr = (letter, val) =>
    hlMacro === letter ? `<span style="${HL}">${letter}${val}</span>` : `${letter}${val}`;

  el.innerHTML = '';
  foods.forEach(f => {
    const pStr = macroStr('P', f.protein_per_100g);
    const cStr = macroStr('C', f.carbs_per_100g);
    const gStr = macroStr('F', f.fat_per_100g);

    // Coluna direita: rácio no sort por rácio, senão kcal/100g (só números).
    let rightCol;
    if (COST_SORT_META[sort]) {
      const meta = COST_SORT_META[sort], v = foodCostMetric(f, sort);
      const val = v === null ? '—' : foodCostMetric(f, 'eur_100g') === 0 ? 'grátis' : (meta.dec ? v.toFixed(meta.dec).replace('.', ',') : Math.round(v));
      rightCol = `<div class="fi-kcal" style="${v === null ? '' : HL}">${val}<br><span style="font-size:9px;color:var(--text3)">${meta.label}</span></div>`;
    } else if (RATIO_META[sort]) {
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

    // Nome por highlightFoodKeywords (escapa); marca por text node.
    const nameEl = document.createElement('div');
    nameEl.className = 'fi-name';
    nameEl.innerHTML = highlightFoodKeywords(f.name);

    const detail = document.createElement('div');
    detail.className = 'fi-detail';
    const servingStr = f.serving_size_g ? ` · porção ${f.serving_size_g}g` : '';
    const stock = promoStock.get(f.id);
    const stockStr = stock > 0 ? ` · <span class="price-promo">↓ ${fmtG(stock)} g</span>` : '';
    detail.innerHTML = `${pStr} ${cStr} ${gStr}${servingStr}${foodPriceLabel(f)}${stockStr}`;
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
  document.getElementById('f-price-eur').value=f.price_eur??'';
  document.getElementById('f-price-qty').value=f.price_qty_g??'';
  updateFoodPriceCalc();
  document.getElementById('sheet-food').classList.add('open');
}

// €/100g calculado do preço da embalagem (só para mostrar).
function updateFoodPriceCalc() {
  const v = eurPer100g(document.getElementById('f-price-eur').value, document.getElementById('f-price-qty').value);
  document.getElementById('f-price-calc').textContent = v === null ? '' : `= ${formatEur(v, ' / 100g')}`;
}

let _savingFood = false;
async function saveFood() {
  if (_savingFood) return;
  _savingFood = true;
  try {
    const name=document.getElementById('f-name').value.trim();
    const kcal=parseFloat(document.getElementById('f-kcal').value);
    const prot=parseFloat(document.getElementById('f-prot').value);
    const carb=parseFloat(document.getElementById('f-carb').value);
    const fat=parseFloat(document.getElementById('f-fat').value);
    if (!name||isNaN(kcal)||isNaN(prot)||isNaN(carb)||isNaN(fat)) { toast('Preenche os campos obrigatórios (*)'); return; }
    const price = foodPricePayload(document.getElementById('f-price-eur').value, document.getElementById('f-price-qty').value);
    if (price.error) { toast(price.error); return; }
    const food={
      name, brand:document.getElementById('f-brand').value.trim()||null,
      serving_size_g:parseFloat(document.getElementById('f-serving').value)||null,
      calories_per_100g:kcal, protein_per_100g:prot, carbs_per_100g:carb, fat_per_100g:fat,
      saturated_fat_per_100g:parseFloat(document.getElementById('f-satfat').value)||0,
      sugar_per_100g:parseFloat(document.getElementById('f-sugar').value)||0,
      fiber_per_100g:parseFloat(document.getElementById('f-fiber').value)||0,
      ...price
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
  } finally {
    _savingFood = false;
  }
}

async function deleteFood() {
  if (!confirm('Eliminar este alimento?')) return;
  const {error}=await db.from('foods').delete().eq('id',editingFoodId);
  if (error) { toast('Erro ao eliminar'); return; }
  toast('Eliminado'); closeAddFood(); loadFoods();
}

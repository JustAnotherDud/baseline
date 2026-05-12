let currentSort = 'name';

async function loadFoods() {
  if (!db) return;
  const {data} = await db.from('foods').select('*').order('name');
  allFoods = data||[];
  document.getElementById('foods-count').textContent = `${allFoods.length} alimentos`;
  filterFoods();
}

function sortFoods(foods) {
  const arr = [...foods];
  switch (currentSort) {
    case 'protein':  return arr.sort((a,b) => b.protein_per_100g  - a.protein_per_100g);
    case 'calories': return arr.sort((a,b) => b.calories_per_100g - a.calories_per_100g);
    case 'recent':   return arr.sort((a,b) => b.id - a.id);
    default:         return arr.sort((a,b) => a.name.localeCompare(b.name, 'pt'));
  }
}

function setSortFoods(sort) {
  currentSort = sort;
  document.querySelectorAll('.sort-chip').forEach(c => c.classList.toggle('active', c.dataset.sort === sort));
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
  el.innerHTML = foods.map(f=>`
    <div class="food-item" onclick="editFood(${f.id})">
      <div class="fi-info">
        <div class="fi-name">${f.name}</div>
        <div class="fi-detail">${f.brand?f.brand+' · ':''}P${f.protein_per_100g} C${f.carbs_per_100g} G${f.fat_per_100g}${f.serving_size_g?' · porção '+f.serving_size_g+'g':''}</div>
      </div>
      <div class="fi-kcal">${f.calories_per_100g}<br><span style="font-size:9px;color:var(--text3)">kcal/100g</span></div>
    </div>`).join('');
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

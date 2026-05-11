async function searchDB() {
  const q = document.getElementById('log-q').value.trim().toLowerCase();
  const res = document.getElementById('log-results');
  if (q.length<1) { res.innerHTML='<div class="loading">Começa a escrever para pesquisar</div>'; return; }
  const {data} = await db.from('foods').select('*').ilike('name',`%${q}%`).limit(25);
  if (!data||!data.length) {
    const q2 = document.getElementById('log-q').value.trim();
    res.innerHTML = `<div style="padding:12px 20px">
      <div style="font-size:13px;color:var(--text3);margin-bottom:10px">Sem resultados para "${q2}"</div>
      <button class="btn btn-secondary" style="font-size:13px;padding:10px" onclick="openAddFoodFromLog('${q2.replace(/'/g,"\\'")}')">+ Criar "${q2}"</button>
    </div>`;
    return;
  }
  res.innerHTML = data.map(f=>`
    <div class="sr-item" onclick="pickFood(${f.id})">
      <div><div class="sr-name">${f.name}</div><div class="sr-detail">${f.brand?f.brand+' · ':''}${f.calories_per_100g} kcal · P${f.protein_per_100g} C${f.carbs_per_100g} G${f.fat_per_100g}</div></div>
      <div class="sr-kcal">${f.calories_per_100g}<br><span style="font-size:9px;color:var(--text3)">kcal/100g</span></div>
    </div>`).join('');
}

async function pickFood(id) {
  const {data} = await db.from('foods').select('*').eq('id',id).single();
  if (!data) return;
  selectedFood=data;
  document.getElementById('log-stage-search').classList.remove('active');
  document.getElementById('log-stage-grams').classList.add('active');

  const servingBtn = data.serving_size_g
    ? `<button class="btn btn-secondary" style="margin-top:8px;padding:8px 14px;font-size:13px;width:auto" onclick="document.getElementById('log-grams').value=${data.serving_size_g};updatePreview()">1 porção (${data.serving_size_g}g)</button>`
    : '';

  document.getElementById('log-food-card').innerHTML=`
    <div class="food-card-name">${data.name}</div>
    <div class="food-card-sub">${data.brand?data.brand+' · ':''}${data.calories_per_100g} kcal/100g · P${data.protein_per_100g}g C${data.carbs_per_100g}g G${data.fat_per_100g}g</div>
    ${servingBtn}`;

  const gi = document.getElementById('log-grams');
  gi.value = '';
  updatePreview();
  setTimeout(()=>gi.focus(),100);
}

function updatePreview() {
  if (!selectedFood) return;
  const g = parseFloat(document.getElementById('log-grams').value)||0;
  const c = v=>Math.round((parseFloat(v)||0)/100*g);
  document.getElementById('prev-kcal').textContent   = c(selectedFood.calories_per_100g);
  document.getElementById('prev-fat').textContent    = c(selectedFood.fat_per_100g);
  document.getElementById('prev-satfat').textContent = c(selectedFood.saturated_fat_per_100g);
  document.getElementById('prev-carb').textContent   = c(selectedFood.carbs_per_100g);
  document.getElementById('prev-sugar').textContent  = c(selectedFood.sugar_per_100g);
  document.getElementById('prev-fiber').textContent  = c(selectedFood.fiber_per_100g);
  document.getElementById('prev-prot').textContent   = c(selectedFood.protein_per_100g);
}

function backToSearch() {
  document.getElementById('log-stage-search').classList.add('active');
  document.getElementById('log-stage-grams').classList.remove('active');
  selectedFood=null;
}

async function saveQuick() {
  const name = document.getElementById('q-name').value.trim();
  if (!name) { toast('Indica o nome'); return; }
  const {error} = await db.from('diary').insert({
    date:currentDate, meal:selectedMeal, food_name:name, grams:null,
    calories:      parseFloat(document.getElementById('q-kcal').value)||0,
    fat:           parseFloat(document.getElementById('q-fat').value)||0,
    saturated_fat: parseFloat(document.getElementById('q-satfat').value)||0,
    carbs:         parseFloat(document.getElementById('q-carb').value)||0,
    sugar:         parseFloat(document.getElementById('q-sugar').value)||0,
    fiber:         parseFloat(document.getElementById('q-fiber').value)||0,
    protein:       parseFloat(document.getElementById('q-prot').value)||0
  });
  if (error) { toast('Erro ao guardar'); return; }
  toast('Registado'); closeLog(); clearQuick(); loadToday(); go('today');
}

function clearQuick() {
  ['q-name','q-kcal','q-fat','q-satfat','q-carb','q-sugar','q-fiber','q-prot'].forEach(id=>document.getElementById(id).value='');
}

function openLogForMeal(mealKey) {
  document.querySelectorAll('#log-meal-tabs .meal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.meal === mealKey);
  });
  selectedMeal = mealKey;
  mealManuallySelected = true;
  openLog('db');
}

function openAddFoodFromLog(prefillName) {
  fromLogContext = true;
  openAddFood();
  if (prefillName) {
    setTimeout(() => { document.getElementById('f-name').value = prefillName; }, 100);
  }
}

function getMealByHour() {
  const h = new Date().getHours();
  if (h >= 6  && h < 10) return 'breakfast';
  if (h >= 10 && h < 12) return 'morning';
  if (h >= 12 && h < 15) return 'lunch';
  if (h >= 15 && h < 18) return 'afternoon1';
  if (h >= 18 && h < 20) return 'afternoon2';
  if (h >= 20 && h < 23) return 'dinner';
  return 'supper';
}

function selectMeal(btn) {
  document.querySelectorAll('#log-meal-tabs .meal-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  selectedMeal = btn.dataset.meal;
  mealManuallySelected = true;
}

const { createClient } = supabase;
let db = null;
let currentDate = new Date().toISOString().split('T')[0];
let selectedMeal = 'breakfast';
let selectedFood = null;
let editingFoodId = null;
let editingEntry = null;
let fromLogContext = false;
let mealManuallySelected = false;

function init() {
  const url = localStorage.getItem('nt_url');
  const key = localStorage.getItem('nt_key');
  if (url && key) {
    db = createClient(url, key);
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    setDateLabel();
    updateLogDateLabel();
    loadTargetsForm();
    loadToday();
    loadFoods();
  } else {
    document.getElementById('setup-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
}

function saveSetup() {
  const url = document.getElementById('setup-url').value.trim().replace(/\/$/,'');
  const key = document.getElementById('setup-key').value.trim();
  if (!url || !key) { toast('Preenche os dois campos'); return; }
  localStorage.setItem('nt_url', url);
  localStorage.setItem('nt_key', key);
  init();
}

function resetSetup() {
  if (!confirm('Redefinir ligação Supabase?')) return;
  localStorage.removeItem('nt_url'); localStorage.removeItem('nt_key'); init();
}

let currentFoodsTab = 'foods'; // 'foods' | 'meals'

function go(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  const nb = document.getElementById('nav-'+view);
  if (nb) nb.classList.add('active');
  if (view==='today')    loadToday();
  if (view==='foods') {
    if (currentFoodsTab === 'foods') loadFoods();
    else loadMeals();
  }
  if (view==='log') {
    if (!mealManuallySelected) selectedMeal = getMealByHour();
    updateLogDateLabel();
    updateMealSelectorLabel(selectedMeal);
  }
  if (view==='settings') loadSettingsView();
  if (view==='stats')    loadStats();
}


function loadStats() {
  // Fase 2
}

function switchFoodsTab(tab) {
  currentFoodsTab = tab;
  // Sub-tab buttons
  document.getElementById('subtab-foods').classList.toggle('active', tab === 'foods');
  document.getElementById('subtab-meals').classList.toggle('active', tab === 'meals');
  // Panels
  document.getElementById('foods-panel').style.display = tab === 'foods' ? 'block' : 'none';
  document.getElementById('meals-panel').style.display = tab === 'meals' ? 'block' : 'none';
  // FAB — only on Alimentos
  const fab = document.getElementById('foods-fab');
  if (fab) fab.style.display = tab === 'foods' ? 'flex' : 'none';
  // Sub text
  document.getElementById('foods-count').textContent = '';
  if (tab === 'foods') loadFoods();
  else loadMeals();
}

async function loadSettingsView() {
  const today = new Date().toISOString().split('T')[0];
  const phase = await getActivePhase(today);
  const phaseNumEl  = document.getElementById('settings-phase-num');
  const objetivoEl  = document.getElementById('settings-objetivo');
  if (phase) {
    // Extract number from label e.g. "Fase 3" → "3", fallback to full label
    const num = phase.label.replace(/[^0-9]/g, '') || phase.label;
    if (phaseNumEl)  phaseNumEl.textContent  = num;
    if (objetivoEl)  objetivoEl.textContent  = phase.objetivo || '—';
  } else {
    if (phaseNumEl)  phaseNumEl.textContent  = '—';
    if (objetivoEl)  objetivoEl.textContent  = '—';
  }
}

async function clearCacheAndReload() {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  location.reload(true);
}

init();

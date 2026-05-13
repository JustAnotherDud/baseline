const { createClient } = supabase;
let db = null;
let currentDate = new Date().toISOString().split('T')[0];
let selectedMeal = 'breakfast';
let selectedFood = null;
let editingFoodId = null;
let editingEntry = null;
let allFoods = [];
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

function go(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  const nb = document.getElementById('nav-'+view);
  if (nb) nb.classList.add('active');
  if (view==='today')    loadToday();
  if (view==='foods')    loadFoods();
  if (view==='log')      updateLogDateLabel();
  if (view==='settings') loadSettingsView();
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

init();

const { createClient } = supabase;
let db = null;
let icuId = null;
let icuKey = null;
let hevyKey = '';
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
  icuId  = localStorage.getItem('icu_id')  || null;
  icuKey = localStorage.getItem('icu_key') || null;
  hevyKey = localStorage.getItem('hevy_key') || '';
  if (url && key) {
    db = createClient(url, key);
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    setDateLabel();
    updateLogDateLabel();
    loadTargetsForm();
    const _initialView = location.hash.replace('#', '') || 'today';
    history.replaceState({ view: _initialView }, '', '#' + _initialView);
    go(_initialView, false);
    loadFoods();
    window.addEventListener('popstate', () => {
      const _openSheet = document.querySelector('.sheet-overlay.open');
      if (_openSheet) {
        _openSheet.classList.remove('open');
      } else {
        const _view = location.hash.replace('#', '') || 'today';
        go(_view, false);
      }
    });
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
  const icuIdVal  = document.getElementById('setup-icu-id').value.trim();
  const icuKeyVal = document.getElementById('setup-icu-key').value.trim();
  if (icuIdVal)  localStorage.setItem('icu_id', icuIdVal);  else localStorage.removeItem('icu_id');
  if (icuKeyVal) localStorage.setItem('icu_key', icuKeyVal); else localStorage.removeItem('icu_key');
  init();
}

function resetSetup() {
  if (!confirm('Redefinir ligação Supabase?')) return;
  localStorage.removeItem('nt_url'); localStorage.removeItem('nt_key'); init();
}

let currentFoodsTab = 'foods'; // 'foods' | 'meals'

function pushSheetState() {
  history.pushState({ sheet: true }, '', location.hash);
}

function go(view, _pushState = true) {
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
  if (view==='forma') loadBody();
  if (view==='settings') loadSettingsView();
  if (view==='stats')    loadStats();
  if (_pushState) {
    history.pushState({ view }, '', '#' + view);
  }
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

  const icuIdEl  = document.getElementById('settings-icu-id');
  const icuKeyEl = document.getElementById('settings-icu-key');
  const savedId  = localStorage.getItem('icu_id');
  const savedKey = localStorage.getItem('icu_key');
  if (icuIdEl)  icuIdEl.textContent  = savedId ? savedId : '—';
  if (icuKeyEl) icuKeyEl.textContent = savedKey ? '••••••' : '—';

  const hevyEl = document.getElementById('hevy-key-display');
  if (hevyEl) hevyEl.textContent = hevyKey ? '••••••' + hevyKey.slice(-4) : 'Não configurado';
}

function editIcuSettings() {
  pushSheetState();
  let overlay = document.getElementById('icu-settings-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'icu-settings-overlay';
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div class="sheet-title">Intervals.icu</div>
          <div class="sheet-close" id="icu-settings-close">×</div>
        </div>
        <div style="padding:0 20px 20px;display:flex;flex-direction:column;gap:14px">
          <label>
            <span class="lt">Athlete ID</span>
            <input type="text" id="icu-settings-id" placeholder="i123456" autocomplete="off">
          </label>
          <label>
            <span class="lt">API Key</span>
            <input type="password" id="icu-settings-key" placeholder="••••••••" autocomplete="off">
          </label>
          <button class="btn btn-primary" onclick="saveIcuSettings()">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
    document.getElementById('icu-settings-close').onclick = () => overlay.classList.remove('open');
  }

  document.getElementById('icu-settings-id').value  = localStorage.getItem('icu_id')  || '';
  document.getElementById('icu-settings-key').value = localStorage.getItem('icu_key') || '';
  overlay.classList.add('open');
}

function saveIcuSettings() {
  const idVal  = document.getElementById('icu-settings-id').value.trim();
  const keyVal = document.getElementById('icu-settings-key').value.trim();
  if (idVal)  localStorage.setItem('icu_id', idVal);   else localStorage.removeItem('icu_id');
  if (keyVal) localStorage.setItem('icu_key', keyVal); else localStorage.removeItem('icu_key');
  icuId  = idVal  || null;
  icuKey = keyVal || null;
  document.getElementById('icu-settings-overlay').classList.remove('open');
  toast('Intervals.icu guardado');
  loadSettingsView();
  loadBody();
}

function editHevySettings() {
  pushSheetState();
  let overlay = document.getElementById('hevy-settings-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'hevy-settings-overlay';
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <span class="sheet-title">Hevy</span>
          <div class="sheet-close" onclick="document.getElementById('hevy-settings-overlay').classList.remove('open')">×</div>
        </div>
        <div style="padding:0 20px 20px;display:flex;flex-direction:column;gap:14px">
          <label>
            <span class="lt">API Key</span>
            <input type="password" id="hevy-key-input" placeholder="••••••••" autocomplete="off">
          </label>
          <button class="btn btn-primary" onclick="saveHevySettings()">Guardar</button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
    document.body.appendChild(overlay);
  }
  const input = document.getElementById('hevy-key-input');
  if (input) input.value = hevyKey || '';
  overlay.classList.add('open');
}

function saveHevySettings() {
  const key = document.getElementById('hevy-key-input')?.value?.trim() || '';
  if (key) localStorage.setItem('hevy_key', key); else localStorage.removeItem('hevy_key');
  hevyKey = key;
  document.getElementById('hevy-settings-overlay')?.classList.remove('open');
  toast('Hevy guardado');
  loadSettingsView();
  if (typeof loadBody === 'function') loadBody();
}

async function clearCacheAndReload() {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  location.reload(true);
}

init();

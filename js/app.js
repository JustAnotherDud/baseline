const { createClient } = supabase;
let db = null;
let icuId = null;
let icuKey = null;
let hevyKey = '';
let icuEnabled = true;
let hevyEnabled = true;
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
  icuEnabled = localStorage.getItem('icu_enabled') !== 'false';
  hevyEnabled = localStorage.getItem('hevy_enabled') !== 'false';
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
  // ICU configura-se em Settings → Intervals.icu, não no setup inicial.
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
  // Hash de view desconhecido (bookmark velho, typo) → cai para 'today'.
  let viewEl = document.getElementById('view-' + view);
  if (!viewEl) { view = 'today'; viewEl = document.getElementById('view-today'); }
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  viewEl.classList.add('active');
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
  const verEl = document.getElementById('settings-version');
  if (verEl && typeof APP_VERSION !== 'undefined') verEl.textContent = 'v' + APP_VERSION;

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

  // Estado ICU/Hevy (ID, key, toggle) vive nos sheets de configuração.
}

// Toggle ON/OFF dentro dos sheets de configuração (criados lazy e cacheados,
// por isso o estado é re-aplicado a cada abertura).
function updateSheetToggle(id, enabled) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.textContent = enabled ? 'ON' : 'OFF';
  btn.style.color = enabled ? 'var(--accent)' : 'var(--text3)';
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
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="lt">Integração</span>
            <button id="icu-sheet-toggle" class="settings-toggle-inline" style="margin-right:0" onclick="toggleIcu()"></button>
          </div>
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
  updateSheetToggle('icu-sheet-toggle', icuEnabled);
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
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="lt">Integração</span>
            <button id="hevy-sheet-toggle" class="settings-toggle-inline" style="margin-right:0" onclick="toggleHevy()"></button>
          </div>
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
  updateSheetToggle('hevy-sheet-toggle', hevyEnabled);
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

function toggleIcu() {
  icuEnabled = !icuEnabled;
  localStorage.setItem('icu_enabled', icuEnabled);
  updateSheetToggle('icu-sheet-toggle', icuEnabled);
  if (typeof loadBody === 'function') loadBody();
}

function toggleHevy() {
  hevyEnabled = !hevyEnabled;
  localStorage.setItem('hevy_enabled', hevyEnabled);
  updateSheetToggle('hevy-sheet-toggle', hevyEnabled);
  if (typeof loadBody === 'function') loadBody();
}

async function clearCacheAndReload() {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  location.reload(true);
}

// ── Refresh automático ───────────────────────────────────────────────────────
// Reflecte alterações feitas noutro dispositivo (ex.: registo no telemóvel
// enquanto o separador está aberto no PC). Recarrega a vista actual quando a
// app volta a ficar visível/focada + poll a cada 60s enquanto visível.
// Throttle de 15s para não duplicar pedidos (visibilitychange + focus disparam
// juntos ao voltar à app). Não recarrega com sheet aberto nem edição em curso,
// para não pisar o que o utilizador está a fazer.
let lastAutoRefresh = 0;

function refreshCurrentView() {
  if (!db || document.hidden) return;
  if (document.querySelector('.sheet-overlay.open') || editingEntry || selectedFood) return;
  const now = Date.now();
  if (now - lastAutoRefresh < 15000) return;
  lastAutoRefresh = now;
  const view = location.hash.replace('#', '') || 'today';
  if (view === 'today') loadToday();
  else if (view === 'foods') { if (currentFoodsTab === 'foods') loadFoods(); else loadMeals(); }
  else if (view === 'forma') loadBody();
  else if (view === 'stats') loadStats();
}

document.addEventListener('visibilitychange', refreshCurrentView);
window.addEventListener('focus', refreshCurrentView);
setInterval(refreshCurrentView, 60000);

init();

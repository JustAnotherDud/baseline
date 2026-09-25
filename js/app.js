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

let appStarted = false;

// Sessão Supabase Auth: as policies RLS só aceitam o utilizador
// `authenticated`; sem sessão a UI fica bloqueada no ecrã de login.
// supabase-js persiste a sessão em localStorage e renova o token sozinho.
async function init() {
  const url = localStorage.getItem('nt_url');
  const key = localStorage.getItem('nt_key');
  icuId  = localStorage.getItem('icu_id')  || null;
  icuKey = localStorage.getItem('icu_key') || null;
  hevyKey = localStorage.getItem('hevy_key') || '';
  icuEnabled = localStorage.getItem('icu_enabled') !== 'false';
  hevyEnabled = localStorage.getItem('hevy_enabled') !== 'false';
  if (!url || !key) { db = null; showLogin(); return; }
  if (!db) {
    db = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
    db.auth.onAuthStateChange((event, session) => {
      if (!session) showLogin();
    });
  }
  const { data: { session } } = await db.auth.getSession();
  if (session) startApp();
  else showLogin();
}

function showLogin() {
  const hasConn = !!(localStorage.getItem('nt_url') && localStorage.getItem('nt_key'));
  document.getElementById('setup-conn').style.display = hasConn ? 'none' : 'flex';
  document.getElementById('setup-sub').textContent = hasConn
    ? 'Sessão terminada. Entra com a tua conta.'
    : 'Introduz as credenciais do teu projecto Supabase e a tua conta.';
  document.getElementById('setup-password').value = '';
  document.getElementById('setup-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function startApp() {
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  setDateLabel();
  loadTargetsForm();
  const _initialView = location.hash.replace('#', '') || 'today';
  history.replaceState({ view: _initialView }, '', '#' + _initialView);
  go(_initialView, false);
  loadFoods();
  if (appStarted) return;
  appStarted = true;
  window.addEventListener('popstate', () => {
    const _openSheet = document.querySelector('.sheet-overlay.open');
    if (_openSheet) {
      _openSheet.classList.remove('open');
    } else {
      const _view = location.hash.replace('#', '') || 'today';
      go(_view, false);
    }
  });
}

async function saveSetup() {
  const hasConn = !!(localStorage.getItem('nt_url') && localStorage.getItem('nt_key'));
  const url = hasConn ? localStorage.getItem('nt_url')
    : document.getElementById('setup-url').value.trim().replace(/\/$/,'');
  const key = hasConn ? localStorage.getItem('nt_key')
    : document.getElementById('setup-key').value.trim();
  const email = document.getElementById('setup-email').value.trim();
  const password = document.getElementById('setup-password').value;
  if (!url || !key || !email || !password) { toast('Preenche todos os campos'); return; }
  const btn = document.getElementById('setup-submit');
  btn.disabled = true;
  try {
    if (!db) db = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) { if (!hasConn) db = null; toast('Login falhou: ' + error.message); return; }
    // URL/key só ficam guardados depois de um login válido.
    localStorage.setItem('nt_url', url);
    localStorage.setItem('nt_key', key);
    // ICU configura-se em Settings → Intervals.icu, não no setup inicial.
    await init();
  } finally {
    btn.disabled = false;
  }
}

async function logout() {
  if (!confirm('Terminar sessão?')) return;
  if (db) await db.auth.signOut();
  showLogin();
}

async function resetSetup() {
  if (!confirm('Redefinir ligação Supabase?')) return;
  if (db) await db.auth.signOut();
  db = null;
  localStorage.removeItem('nt_url'); localStorage.removeItem('nt_key'); init();
}

let currentFoodsTab = 'foods'; // 'foods' | 'meals'

function pushSheetState() {
  history.pushState({ sheet: true }, '', location.hash);
}

// Loader de cada view com dados que podem mudar noutro dispositivo.
function loadView(view) {
  if (view === 'today') loadToday();
  else if (view === 'foods') { if (currentFoodsTab === 'foods') loadFoods(); else loadMeals(); }
  else if (view === 'forma') loadBody();
  else if (view === 'stats') loadStats();
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
  loadView(view);
  if (view==='settings') loadSettingsView();
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
  if (verEl) verEl.textContent = 'v' + APP_VERSION;
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
  const overlay = ensureSheet('icu-settings-overlay', {
    header: `<div class="sheet-title">Intervals.icu</div>`,
    body: `
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
    </div>`,
  });

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
  const overlay = ensureSheet('hevy-settings-overlay', {
    header: `<span class="sheet-title">Hevy</span>`,
    body: `
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
    </div>`,
  });
  const input = document.getElementById('hevy-key-input');
  if (input) input.value = hevyKey || '';
  updateSheetToggle('hevy-sheet-toggle', hevyEnabled);
  overlay.classList.add('open');
}

function saveHevySettings() {
  const key = document.getElementById('hevy-key-input').value.trim();
  if (key) localStorage.setItem('hevy_key', key); else localStorage.removeItem('hevy_key');
  hevyKey = key;
  document.getElementById('hevy-settings-overlay').classList.remove('open');
  toast('Hevy guardado');
  loadSettingsView();
  loadBody();
}

function toggleIcu() {
  icuEnabled = !icuEnabled;
  localStorage.setItem('icu_enabled', icuEnabled);
  updateSheetToggle('icu-sheet-toggle', icuEnabled);
  loadBody();
}

function toggleHevy() {
  hevyEnabled = !hevyEnabled;
  localStorage.setItem('hevy_enabled', hevyEnabled);
  updateSheetToggle('hevy-sheet-toggle', hevyEnabled);
  loadBody();
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
  if (!db || document.hidden || document.getElementById('app').style.display === 'none') return;
  if (document.querySelector('.sheet-overlay.open') || editingEntry || selectedFood) return;
  const now = Date.now();
  if (now - lastAutoRefresh < 15000) return;
  lastAutoRefresh = now;
  loadView(location.hash.replace('#', '') || 'today');
}

document.addEventListener('visibilitychange', refreshCurrentView);
window.addEventListener('focus', refreshCurrentView);
setInterval(refreshCurrentView, 60000);

init();

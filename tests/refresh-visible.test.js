// Ao voltar à app (visibilitychange/focus) recarrega a vista actual: Diário e Manutenção leem daily_targets,
// que muda noutro dispositivo ou numa sincronização. Carrega js/app.js com stubs mínimos.
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

function boot({ hash = '', hidden = false } = {}) {
  const listeners = {};
  const calls = [];
  const spy = name => (...a) => { calls.push(name); return Promise.resolve(); };
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, textContent: '', value: '' });
  const document = {
    hidden,
    documentElement: {},
    getElementById: () => el(),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (t, f) => { listeners['document:' + t] = f; },
  };
  const extra = {
    document,
    window: { matchMedia: () => ({ matches: true }), addEventListener: (t, f) => { listeners['window:' + t] = f; } },
    supabase: { createClient: () => ({}) },
    setInterval: () => 0,
    history: { replaceState() {}, pushState() {} },
    location: { hash, reload() {} },
    ...Object.fromEntries(['loadToday', 'loadFoods', 'loadMeals', 'loadBody', 'loadStats', 'loadHistory', 'loadPromo', 'refreshTargets']
      .map(n => [n, spy(n)])),
  };
  const ctx = loadScript(['js/nutrition.js', 'js/app.js'], extra);
  vm.runInContext('db = {}', ctx);     // sessão aberta
  return { ctx, calls, listeners, document };
}

test('regista visibilitychange e focus para recarregar a vista actual', () => {
  const { listeners } = boot();
  assert.equal(typeof listeners['document:visibilitychange'], 'function');
  assert.equal(typeof listeners['window:focus'], 'function');
});

test('ao voltar à app: Manutenção recarrega os alvos (refreshTargets)', () => {
  const { calls, listeners } = boot({ hash: '#targets' });
  listeners['document:visibilitychange']();
  assert.deepEqual(calls, ['refreshTargets']);
});

test('ao voltar à app: Diário recarrega (loadToday); hash vazio = Diário', () => {
  const a = boot({ hash: '#today' });
  a.listeners['document:visibilitychange']();
  assert.deepEqual(a.calls, ['loadToday']);
  const b = boot({ hash: '' });
  b.listeners['document:visibilitychange']();
  assert.deepEqual(b.calls, ['loadToday']);
});

test('visibilitychange + focus seguidos (voltar à app) recarregam uma só vez (throttle 15 s)', () => {
  const { calls, listeners } = boot({ hash: '#targets' });
  listeners['document:visibilitychange']();
  listeners['window:focus']();
  assert.deepEqual(calls, ['refreshTargets']);
});

test('com a app escondida não recarrega (a mudança para hidden também dispara visibilitychange)', () => {
  const { calls, listeners } = boot({ hash: '#targets', hidden: true });
  listeners['document:visibilitychange']();
  assert.deepEqual(calls, []);
});

test('não pisa uma edição em curso (sheet aberto)', () => {
  const { calls, listeners, document } = boot({ hash: '#targets' });
  document.querySelector = sel => (sel === '.sheet-overlay.open' ? {} : null);
  listeners['document:visibilitychange']();
  assert.deepEqual(calls, []);
});

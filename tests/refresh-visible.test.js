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
    setDateLabel: spy('setDateLabel'),
  };
  const ctx = loadScript(['js/nutrition.js', 'js/views/targets.js', 'js/app.js'], extra);
  // os carregadores das vistas ficam espiões (as funções reais iam à BD)
  for (const n of ['loadToday', 'loadFoods', 'loadMeals', 'loadBody', 'loadStats', 'loadHistory', 'loadPromo', 'refreshTargets']) ctx[n] = spy(n);
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

// ── mudança de dia (meia-noite, Europe/Lisbon) ───────────────────────────────

test('lisbonDate: dia civil de Lisboa, com hora de verão e de inverno', () => {
  const { ctx } = boot();
  assert.equal(ctx.lisbonDate(new Date('2026-10-08T23:30:00Z')), '2026-10-09');   // verão: UTC+1, já é dia 9 em Lisboa
  assert.equal(ctx.lisbonDate(new Date('2026-12-01T23:30:00Z')), '2026-12-01');   // inverno: UTC+0
  assert.equal(ctx.lisbonDate(new Date('2026-12-01T00:00:00Z')), '2026-12-01');
});

test('meia-noite: quem estava em "hoje" avança para o novo hoje (Diário e Manutenção) e recarrega', () => {
  const { ctx, calls, listeners } = boot({ hash: '#targets' });
  vm.runInContext("appToday = '2026-10-08'; currentDate = '2026-10-08'; currentTargetsDate = '2026-10-08'", ctx);
  ctx.lisbonDate = () => '2026-10-09';
  listeners['document:visibilitychange']();
  assert.equal(vm.runInContext('currentDate', ctx), '2026-10-09');
  assert.equal(vm.runInContext('currentTargetsDate', ctx), '2026-10-09');
  assert.equal(vm.runInContext('appToday', ctx), '2026-10-09');
  assert.deepEqual(calls, ['setDateLabel', 'refreshTargets']);          // etiqueta do dia + recarga da vista actual
});

test('meia-noite: quem estava de propósito num dia passado (ou futuro) não é mexido', () => {
  const { ctx, calls, listeners } = boot({ hash: '#today' });
  vm.runInContext("appToday = '2026-10-08'; currentDate = '2026-10-05'; currentTargetsDate = '2026-10-12'", ctx);
  ctx.lisbonDate = () => '2026-10-09';
  listeners['document:visibilitychange']();
  assert.equal(vm.runInContext('currentDate', ctx), '2026-10-05');
  assert.equal(vm.runInContext('currentTargetsDate', ctx), '2026-10-12');
  assert.equal(vm.runInContext('appToday', ctx), '2026-10-09');          // o "hoje" da app avança na mesma
  assert.deepEqual(calls, ['loadToday']);                                // recarrega, sem mudar de dia
});

test('mesmo dia civil: não mexe em nada', () => {
  const { ctx, listeners } = boot({ hash: '#today' });
  vm.runInContext("appToday = '2026-10-08'; currentDate = '2026-10-08'", ctx);
  ctx.lisbonDate = () => '2026-10-08';
  listeners['document:visibilitychange']();
  assert.equal(vm.runInContext('currentDate', ctx), '2026-10-08');
});

test('avançar o dia só acontece depois dos guardas (sheet aberto: espera pelo próximo refresh)', () => {
  const { ctx, listeners, document } = boot({ hash: '#today' });
  vm.runInContext("appToday = '2026-10-08'; currentDate = '2026-10-08'", ctx);
  ctx.lisbonDate = () => '2026-10-09';
  document.querySelector = sel => (sel === '.sheet-overlay.open' ? {} : null);
  listeners['document:visibilitychange']();
  assert.equal(vm.runInContext('currentDate', ctx), '2026-10-08');
  document.querySelector = () => null;
  vm.runInContext('lastAutoRefresh = 0', ctx);
  listeners['document:visibilitychange']();
  assert.equal(vm.runInContext('currentDate', ctx), '2026-10-09');
});

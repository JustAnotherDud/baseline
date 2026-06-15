const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

// localStorage stateful (o stub default de _load.js é no-op; aqui precisamos
// de persistência entre chamadas para exercitar toggle/isLocked).
function makeLS(initial = {}) {
  const store = { ...initial };
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    _store: store,
  };
}

// diary.js só declara funções/constantes no topo — carrega sem efeitos.
function loadDiary(ls) {
  return loadScript('js/views/diary.js', {
    localStorage: ls,
    document: { documentElement: {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  });
}

test('isMealLocked: falso por omissão', () => {
  const { isMealLocked } = loadDiary(makeLS());
  assert.equal(isMealLocked('2026-06-15', 'lunch'), false);
});

test('toggleMealLock: bloqueia e desbloqueia', () => {
  const { isMealLocked, toggleMealLock } = loadDiary(makeLS());
  toggleMealLock('2026-06-15', 'lunch');
  assert.equal(isMealLocked('2026-06-15', 'lunch'), true);
  toggleMealLock('2026-06-15', 'lunch');
  assert.equal(isMealLocked('2026-06-15', 'lunch'), false);
});

test('locks são independentes por data e por refeição', () => {
  const { isMealLocked, toggleMealLock } = loadDiary(makeLS());
  toggleMealLock('2026-06-15', 'lunch');
  assert.equal(isMealLocked('2026-06-15', 'lunch'),  true);
  assert.equal(isMealLocked('2026-06-15', 'dinner'), false); // outra refeição
  assert.equal(isMealLocked('2026-06-16', 'lunch'),  false); // outro dia
});

test('getMealLocks: localStorage corrompido → {} (try/catch)', () => {
  const ls = makeLS({ meal_locks: '{ não é json' });
  const { getMealLocks, isMealLocked } = loadDiary(ls);
  assert.deepEqual({ ...getMealLocks() }, {});
  assert.equal(isMealLocked('2026-06-15', 'lunch'), false);
});

test('persiste a chave data_refeição em meal_locks', () => {
  const ls = makeLS();
  const { toggleMealLock } = loadDiary(ls);
  toggleMealLock('2026-06-15', 'breakfast');
  assert.deepEqual(JSON.parse(ls._store.meal_locks), { '2026-06-15_breakfast': true });
});

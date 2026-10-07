// Refeições dinâmicas: helpers de js/nutrition.js (rótulo, hora, quais mostrar, quais abertas).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

const c = loadScript('js/nutrition.js');
const plain = x => JSON.parse(JSON.stringify(x));

test('mealLabel: nome livre, senão "Refeição N" (número só para mostrar)', () => {
  assert.equal(c.mealLabel({ name: 'Pós-treino', no: 3 }), 'Pós-treino');
  assert.equal(c.mealLabel({ name: '  Jantar ', no: 3 }), 'Jantar');
  assert.equal(c.mealLabel({ name: null, no: 2 }), 'Refeição 2');
  assert.equal(c.mealLabel({ name: '   ', no: 4 }), 'Refeição 4');
  assert.equal(c.mealLabel({ no: '?' }), 'Refeição ?');
});

test('fmtHM / hmToTimestamp: hora local, ida e volta', () => {
  assert.equal(c.fmtHM(null), '');
  assert.equal(c.fmtHM('lixo'), '');
  const ts = c.hmToTimestamp('2026-10-08', '07:05');
  assert.equal(c.fmtHM(ts), '07:05');
  assert.equal(c.fmtHM(c.hmToTimestamp('2026-10-08', '7:05')), '07:05');
  assert.equal(c.hmToTimestamp('2026-10-08', ''), null);
  assert.equal(c.hmToTimestamp('2026-10-08', '24:00'), null);
  assert.equal(c.hmToTimestamp('2026-10-08', '12:60'), null);
  assert.equal(c.hmToTimestamp('08/10/2026', '12:00'), null);
});

test('mealOptionText: nome e hora', () => {
  const ts = c.hmToTimestamp('2026-10-08', '12:40');
  assert.equal(c.mealOptionText({ name: 'Almoço', no: 2, sort_at: ts }), 'Almoço · 12:40');
  assert.equal(c.mealOptionText({ name: null, no: 5, sort_at: null }), 'Refeição 5');
});

const M = (id, n, extra = {}) => ({ id, name: null, no: id, date: '2026-10-08', n_entries: n, is_latest: false, ...extra });

test('diaryMeals: vazias escondem-se, menos a mais recente do dia (enquanto o dia não acabou)', () => {
  const meals = [M(1, 2), M(2, 0), M(3, 1), M(4, 0, { is_latest: true })];
  const ids = (ms, today) => plain(c.diaryMeals(ms, [], today).map(m => m.id));
  assert.deepEqual(ids(meals, '2026-10-08'), [1, 3, 4]);          // 2 (vazia, não é a mais recente) some
  assert.deepEqual(ids(meals, '2026-10-09'), [1, 3]);             // o dia acabou: a vazia some também
  assert.deepEqual(ids(meals, '2026-10-07'), [1, 3, 4]);          // dia futuro (pré-registo): a vazia mais recente fica
});

test('diaryMeals: vazia que não é a mais recente nunca aparece; com entradas aparece sempre', () => {
  const meals = [M(1, 0), M(2, 1, { is_latest: true })];
  assert.deepEqual(plain(c.diaryMeals(meals, [], '2026-10-08').map(m => m.id)), [2]);
  assert.deepEqual(plain(c.diaryMeals([M(1, 3)], [], '2030-01-01').map(m => m.id)), [1]);
});

test('diaryMeals: entradas de refeição desconhecida ganham refeição provisória (nunca escondidas)', () => {
  const entries = [{ id: 1, meal_id: 99, date: '2026-10-08', logged_at: '2026-10-08T10:00:00Z' },
                   { id: 2, meal_id: 99, date: '2026-10-08', logged_at: '2026-10-08T10:05:00Z' }];
  const out = c.diaryMeals([M(1, 1)], entries, '2026-10-08');
  assert.deepEqual(plain(out.map(m => m.id)), [1, 99]);
  assert.equal(c.mealLabel(out[1]), 'Refeição ?');
});

test('aberta por defeito: a mais recente com entradas; toques da sessão mandam', () => {
  const visible = [M(1, 2), M(2, 1), M(3, 0, { is_latest: true })];
  const entries = [{ meal_id: 1 }, { meal_id: 1 }, { meal_id: 2 }];
  const openId = c.mealOpenDefault(visible, entries);
  assert.equal(openId, 2);                                          // a vazia (3) não conta
  const ov = new Map();
  assert.equal(c.isMealCollapsed(1, openId, ov), true);
  assert.equal(c.isMealCollapsed(2, openId, ov), false);
  ov.set(1, false); ov.set(2, true);                                // utilizador abriu a 1 e fechou a 2
  assert.equal(c.isMealCollapsed(1, openId, ov), false);
  assert.equal(c.isMealCollapsed(2, openId, ov), true);
  assert.equal(c.mealOpenDefault([M(3, 0, { is_latest: true })], []), null);
});

test('db.js: populateMealSelect e moveEntryToMeal usam ids, não chaves de slot', () => {
  const opts = [];
  const sel = { set innerHTML(v) { opts.push(v); }, value: '' };
  const s = loadScript(['js/nutrition.js', 'js/ui.js'], {
    document: { documentElement: {}, getElementById: () => null, querySelectorAll: () => [] },
    history: { pushState: () => {} },
  });
  s.currentMeals = [{ id: 7, name: 'Almoço', no: 1, sort_at: null }, { id: 8, name: null, no: 2, sort_at: null }];
  s.populateMealSelect(sel, 8);
  assert.match(opts[0], /<option value="7">Almoço<\/option>/);
  assert.match(opts[0], /<option value="8">Refeição 2<\/option>/);
  assert.match(opts[0], /<option value="new">\+ Nova refeição<\/option>$/);
  s.populateMealSelect(sel, 'new', true);
  assert.match(opts[1], /^<option value="new">/);                  // aplicar modelo: "Nova" primeiro
});

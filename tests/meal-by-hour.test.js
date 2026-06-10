const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

// Carrega log.js com um Date stub que devolve sempre a hora pretendida.
// Cada chamada re-carrega o ficheiro para isolar o contexto de variáveis globais.
function ctxAtHour(h) {
  class FakeDate { getHours() { return h; } }
  return loadScript('js/views/log.js', {
    Date: FakeDate,
    document: { documentElement: {}, getElementById: () => null, querySelectorAll: () => [] },
    history: { pushState: () => {} },
    location: { hash: '' },
    setTimeout: () => {},
    clearTimeout: () => {},
  });
}

// ── limites de cada faixa (boundaries verificadas com node -e) ───────────────
// Implementação: [6,10)→breakfast [10,12)→morning [12,15)→lunch
//                [15,18)→afternoon1 [18,20)→afternoon2 [20,23)→dinner else→supper

test('05h → supper (antes do breakfast)', () => {
  assert.equal(ctxAtHour(5).getMealByHour(), 'supper');
});

test('06h → breakfast (limite inferior)', () => {
  assert.equal(ctxAtHour(6).getMealByHour(), 'breakfast');
});

test('09h → breakfast', () => {
  assert.equal(ctxAtHour(9).getMealByHour(), 'breakfast');
});

test('10h → morning (limite inferior)', () => {
  assert.equal(ctxAtHour(10).getMealByHour(), 'morning');
});

test('12h → lunch (limite inferior)', () => {
  assert.equal(ctxAtHour(12).getMealByHour(), 'lunch');
});

test('14h → lunch', () => {
  assert.equal(ctxAtHour(14).getMealByHour(), 'lunch');
});

test('15h → afternoon1 (limite inferior)', () => {
  assert.equal(ctxAtHour(15).getMealByHour(), 'afternoon1');
});

test('18h → afternoon2 (limite inferior)', () => {
  assert.equal(ctxAtHour(18).getMealByHour(), 'afternoon2');
});

test('20h → dinner (limite inferior)', () => {
  assert.equal(ctxAtHour(20).getMealByHour(), 'dinner');
});

test('22h → dinner', () => {
  assert.equal(ctxAtHour(22).getMealByHour(), 'dinner');
});

test('23h → supper (fim exclusivo de dinner)', () => {
  assert.equal(ctxAtHour(23).getMealByHour(), 'supper');
});

test('00h → supper (madrugada)', () => {
  assert.equal(ctxAtHour(0).getMealByHour(), 'supper');
});

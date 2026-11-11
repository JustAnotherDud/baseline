const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

// body.js lê getComputedStyle no topo; o stub em _load.js cobre isso.
const ctx = loadScript('js/views/body.js');
const { tNum, buildBodyTrendRows, bodyFilterByPeriod } = ctx;

// ── tNum ─────────────────────────────────────────────────────────────────────
test("tNum('3.5') → 3.5", () => assert.equal(tNum('3.5'), 3.5));
test("tNum('abc') → null", () => assert.equal(tNum('abc'), null));
test("tNum(null) → null", () => assert.equal(tNum(null), null));
test("tNum(0) → 0 (zero é um número finito válido)", () => assert.equal(tNum(0), 0));

// ── buildBodyTrendRows ─────────────────────────────────────────────────────────
test('buildBodyTrendRows: ordena por data e converte as colunas de body_comp', () => {
  const rows = buildBodyTrendRows([
    { date: '2026-06-05', weight_kg: '80.5', body_fat_pct: '15', muscle_mass_kg: null },
    { date: '2026-06-01', weight_kg: '81', body_fat_pct: null, muscle_mass_kg: '65' },
    { date: null, weight_kg: '99' },
  ]);
  assert.deepEqual([...rows.map(r => r.date)], ['2026-06-01', '2026-06-05']);
  assert.deepEqual({ ...rows[1] }, { date: '2026-06-05', weight: 80.5, fat: 15, lbm: null });
});

// ── bodyFilterByPeriod ────────────────────────────────────────────────────────
test("bodyFilterByPeriod('all') devolve todas as rows", () => {
  const rows = [{ date: '2026-06-11' }, { date: '2026-01-01' }, { date: '2020-01-01' }];
  assert.equal(bodyFilterByPeriod(rows, 'all').length, 3);
});

test("bodyFilterByPeriod('week') inclui hoje e today-7, exclui today-8", () => {
  // today é 2026-06-13 → cutoff = 2026-06-06 (today - 7 dias)
  // bodyFilterByPeriod usa >= cutoffStr, portanto cutoffStr está incluído.
  const rows = [
    { date: '2026-06-13' }, // hoje → incluído
    { date: '2026-06-10' }, // dentro → incluído
    { date: '2026-06-06' }, // exactamente no cutoff → INCLUÍDO (>=)
    { date: '2026-06-05' }, // antes do cutoff → excluído
  ];
  const fakeToday = new Date('2026-06-13T12:00:00');
  const result = bodyFilterByPeriod(rows, 'week', fakeToday);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(r => r.date), ['2026-06-13', '2026-06-10', '2026-06-06']);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

// body.js lê getComputedStyle no topo; o stub em _load.js cobre isso.
const ctx = loadScript('js/views/body.js');
const { tNum, tFmtHM, calcGymVolume, bodyFilterByPeriod, tWeekTotals, tDeltaPct } = ctx;

// ── tNum ─────────────────────────────────────────────────────────────────────
test("tNum('3.5') → 3.5", () => assert.equal(tNum('3.5'), 3.5));
test("tNum('abc') → null", () => assert.equal(tNum('abc'), null));
test("tNum(null) → null", () => assert.equal(tNum(null), null));
test("tNum(0) → 0 (zero é um número finito válido)", () => assert.equal(tNum(0), 0));

// ── tFmtHM ───────────────────────────────────────────────────────────────────
test("tFmtHM(3661) → '1:01' (1h 1m 1s, minutos com pad)", () => {
  assert.equal(tFmtHM(3661), '1:01');
});
test("tFmtHM(0) → '0:00'", () => assert.equal(tFmtHM(0), '0:00'));
test("tFmtHM(null) → '—'", () => assert.equal(tFmtHM(null), '—'));

// ── calcGymVolume ─────────────────────────────────────────────────────────────
test('calcGymVolume: todos os sets com weight e reps truthy (incluindo warmup)', () => {
  const workout = {
    exercises: [{
      sets: [
        { type: 'normal', weight_kg: 100, reps: 5 },   // conta: 500
        { type: 'warmup', weight_kg: 60,  reps: 5 },   // conta: 300
        { type: 'normal', weight_kg: 100, reps: 0 },   // ignorado (reps falsy)
      ],
    }],
  };
  assert.equal(calcGymVolume(workout), 800);
});

test('calcGymVolume({}) → 0 (sem exercises)', () => {
  assert.equal(calcGymVolume({}), 0);
});

// ── tDeltaPct ────────────────────────────────────────────────────────────────
test('tDeltaPct(110, 100) → 10 (aumento de 10%)', () => {
  assert.equal(tDeltaPct(110, 100), 10);
});
test('tDeltaPct(50, 0) → null (divisão por zero)', () => {
  assert.equal(tDeltaPct(50, 0), null);
});
test('tDeltaPct(50, null) → null (prev null)', () => {
  assert.equal(tDeltaPct(50, null), null);
});

// ── tWeekTotals ───────────────────────────────────────────────────────────────
test('tWeekTotals: 2 actividades dentro, 1 exactamente em end (exclusivo)', () => {
  const start = new Date('2026-06-01T00:00:00');
  const end   = new Date('2026-06-08T00:00:00');
  const acts = [
    { start_date_local: '2026-06-03T10:00:00', distance: 1000, moving_time: 600,  icu_training_load: 50 },
    { start_date_local: '2026-06-05T10:00:00', distance: 2000, moving_time: 1200, icu_training_load: 80 },
    // Esta actividade é exactamente em `end` → d < end é falso → fica de fora
    { start_date_local: '2026-06-08T00:00:00', distance: 500,  moving_time: 300,  icu_training_load: 30 },
  ];
  const tot = tWeekTotals(acts, start, end);
  assert.equal(tot.meters, 3000);
  assert.equal(tot.secs, 1800);
  assert.equal(tot.load, 130);
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

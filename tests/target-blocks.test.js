const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');
const { deriveBlocks, energyNotes } = loadScript('js/views/targets.js');

// deriveBlocks só conhece a forma actual de blocks_active (plans/039 fase 3):
// `core_kcal` e `activity_kcal_by_id`. Tudo o resto fica de fora.

// Os valores voltam do sandbox node:vm, que é outro realm: deepStrictEqual
// compara prototypes e falha em arrays/objectos estruturalmente iguais.
// Spread normaliza para este realm.
const arr = a => (a == null ? a : [...a]);

test('só core_kcal e activity_kcal_by_id contam como blocos', () => {
  const { chips, sum } = deriveBlocks({
    core_kcal: 2739.3,
    activity_kcal_by_id: {},
    energy_diag: { expenditure_estimate_kcal: 3352 },
    work_kcal: 595.7,
  });
  assert.deepEqual(arr(chips.map(c => c.label)), ['Núcleo']);
  assert.equal(sum, 2739);
});

test('actividades expandem uma entrada por id, agregadas na soma', () => {
  const { chips, sum } = deriveBlocks({
    core_kcal: 2700,
    activity_kcal_by_id: { i1: 300, i2: 200 },
  });
  assert.deepEqual(arr(chips.map(c => c.label)), ['Núcleo', 'Atividade i1', 'Atividade i2']);
  assert.equal(sum, 3200);
});

test('uma só actividade não leva o id no rótulo', () => {
  const { chips } = deriveBlocks({ activity_kcal_by_id: { i1: 300 } });
  assert.deepEqual(arr(chips.map(c => c.label)), ['Atividade']);
});

test('blocos a zero não aparecem', () => {
  const { chips } = deriveBlocks({ core_kcal: 0, activity_kcal_by_id: { i1: 0 } });
  assert.deepEqual(arr(chips), []);
});

test('energyNotes: sem diag devolve vazio', () => {
  assert.deepEqual(arr(energyNotes(null)), []);
  assert.deepEqual(arr(energyNotes(undefined)), []);
  assert.deepEqual(arr(energyNotes({})), []);
});

test('energyNotes: gasto medido com margem e janela', () => {
  const notes = energyNotes({
    expenditure_estimate_kcal: 3352,
    expenditure_se_kcal: 108,
    lookback_days_used: 56,
    days_logged_in_window: 40,
  });
  assert.equal(notes.length, 1);
  assert.match(notes[0], /3350 ±110 kcal\/dia · janela 56d \(40d logados\)/);
});

test('energyNotes: ingestão 7d face ao gasto, arredondada a 10', () => {
  const neg = energyNotes({ expenditure_estimate_kcal: 3352, intake_7d_delta_kcal: -123.4 });
  assert.match(neg[1], /Ingestão 7d −120 kcal face ao gasto/);
  const pos = energyNotes({ expenditure_estimate_kcal: 3352, intake_7d_delta_kcal: 87 });
  assert.match(pos[1], /Ingestão 7d \+90 kcal/);
  assert.equal(energyNotes({ expenditure_estimate_kcal: 3352 }).length, 1);
  assert.equal(energyNotes({ expenditure_estimate_kcal: 3352, intake_7d_delta_kcal: null }).length, 1);
});

test('energyNotes: fallback modelado diz-se explicitamente', () => {
  const notes = energyNotes({ energy_source: 'modeled_fallback' });
  assert.equal(notes.length, 1);
  assert.match(notes[0], /fallback modelado/);
});

test('energyNotes: unallocated > 0 é sinalizado como bug', () => {
  // Estruturalmente 0 desde plans/035 (sem tectos). Se voltar, é regressão.
  const notes = energyNotes({ expenditure_estimate_kcal: 3352, unallocated_kcal: 382 });
  assert.equal(notes.length, 2);
  assert.match(notes[1], /382 kcal descartadas/);
});

test('energyNotes: floors_conflict aceita booleano e string', () => {
  assert.match(energyNotes({ floors_conflict: true })[0], /conflito/);
  assert.match(energyNotes({ floors_conflict: 'true' })[0], /conflito/);
  assert.deepEqual(arr(energyNotes({ floors_conflict: false })), []);
});

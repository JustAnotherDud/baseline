const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');
const { deriveBlocks, energyNotes } = loadScript('js/views/targets.js');

// Regressões desta função: dois bugs shippados em duas rondas seguidas, ambos
// do mesmo tipo -- um campo novo em blocks_active que não era kcal passou o
// teste `+value > 0` e desenhou um chip falso. A blacklist (NON_BLOCK_KEYS)
// que os corrigia um a um foi substituída em plans/035 pela convenção de
// sufixo `_kcal`. Estes testes fixam a convenção para que a próxima chave
// nova falhe aqui e não em produção.

// Mesmo motivo do `norm` em macro-floor.test.js: os valores voltam do sandbox
// node:vm, que é outro realm -- deepStrictEqual compara prototypes e falha em
// arrays/objectos estruturalmente iguais. Spread normaliza para este realm.
const norm = o => (o == null ? o : { ...o });
const arr = a => (a == null ? a : [...a]);

test('só chaves terminadas em _kcal contam como blocos', () => {
  const { chips, sum } = deriveBlocks({
    baseline_kcal: 2739.3,
    work_kcal: 595.7,
    gym_kcal: 0,
    activity_kcal_by_id: {},
    run_type_context: null,
    run_type_source: 'default',
    gym_planned: false,
    gym_source: 'default',
  });
  assert.deepEqual(arr(chips.map(c => c.label)), ['Baseline', 'Trabalho']);
  assert.equal(sum, 3335);
});

test('gym_planned=true (booleano) não vira chip de 1kcal', () => {
  // Bug real, plans/033: +true === 1 passava o teste `n > 0`.
  const { chips } = deriveBlocks({ gym_planned: true, gym_kcal: 250 });
  assert.deepEqual(arr(chips.map(c => c.label)), ['Ginásio']);
  assert.equal(chips[0].value, 250);
});

test('campos em horas ou médias de diagnóstico não viram chips', () => {
  // Bug real, plans/034: work_hours_today (6 horas) desenhou "6kcal".
  const { chips, sum } = deriveBlocks({
    work_hours_today: 6,
    avg_work_kcal_per_day: 411.5,
    work_kcal_per_hour: 108.3,
    energy_lookback_days_used: 28,
    baseline_kcal: 2739,
  });
  assert.deepEqual(arr(chips.map(c => c.label)), ['Baseline']);
  assert.equal(sum, 2739);
});

test('energy_diag é objecto aninhado — nunca é lido como bloco', () => {
  const { chips, sum } = deriveBlocks({
    baseline_kcal: 2739,
    energy_diag: { expenditure_estimate_kcal: 3352, avg_work_kcal_per_day: 411 },
  });
  assert.deepEqual(arr(chips.map(c => c.label)), ['Baseline']);
  assert.equal(sum, 2739);
});

test('actividades expandem uma entrada por id, agregadas na soma', () => {
  const { chips, sum } = deriveBlocks({
    baseline_kcal: 2700,
    activity_kcal_by_id: { i1: 300, i2: 200 },
  });
  assert.deepEqual(arr(chips.map(c => c.label)), ['Baseline', 'Actividade i1', 'Actividade i2']);
  assert.equal(sum, 3200);
});

test('uma só actividade não leva o id no rótulo', () => {
  const { chips } = deriveBlocks({ activity_kcal_by_id: { i1: 300 } });
  assert.deepEqual(arr(chips.map(c => c.label)), ['Actividade']);
});

test('blocos a zero não aparecem', () => {
  const { chips } = deriveBlocks({ gym_kcal: 0, work_kcal: 0, baseline_kcal: 2700 });
  assert.deepEqual(arr(chips.map(c => c.label)), ['Baseline']);
});

test('chave _kcal desconhecida aparece sozinha, com rótulo derivado', () => {
  // O objectivo original do derive genérico: um bloco novo do backend não
  // desaparece em silêncio só por o frontend ainda não o conhecer.
  const { chips } = deriveBlocks({ steps_kcal: 120 });
  assert.deepEqual(norm(chips[0]), { label: 'Steps', value: 120 });
});

test('linha pré-035 (sem baseline_kcal) não rebenta', () => {
  const { chips, sum } = deriveBlocks({
    run_type_context: 'z2_curto',
    work_kcal_today: 596,
    activity_kcal_by_id: { i1: 300 },
  });
  assert.deepEqual(arr(chips.map(c => c.label)), ['Actividade']);
  assert.equal(sum, 300);
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
    lookback_days_used: 28,
    days_logged_in_window: 19,
  });
  assert.equal(notes.length, 1);
  assert.match(notes[0], /3352 ±108 kcal\/dia · janela 28d \(19d logados\)/);
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

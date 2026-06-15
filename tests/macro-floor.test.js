const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');
const { macroFloorState } = loadScript('js/nutrition.js');

// macroFloorState devolve um objecto criado no sandbox vm (realm diferente),
// por isso deepEqual directo falha por prototype. Spread normaliza para o realm
// do teste antes de comparar.
const norm = o => (o == null ? o : { ...o });

test('floor inválido (0 ou ausente) → null', () => {
  assert.equal(macroFloorState('fat', 50, 0), null);
  assert.equal(macroFloorState('protein', 50, undefined), null);
});

test('proteína abaixo do floor → below, com deficit e pct', () => {
  assert.deepEqual(norm(macroFloorState('protein', 100, 140)), { status: 'below', pct: 71, deficit: 40 });
});

test('proteína no/acima do floor → met (nunca over)', () => {
  assert.deepEqual(norm(macroFloorState('protein', 140, 140)), { status: 'met', pct: 100 });
  assert.deepEqual(norm(macroFloorState('protein', 184, 140)), { status: 'met', pct: 131 });
  assert.deepEqual(norm(macroFloorState('protein', 300, 140)), { status: 'met', pct: 214 });
});

test('gordura: abaixo do floor → below', () => {
  assert.deepEqual(norm(macroFloorState('fat', 50, 70)), { status: 'below', pct: 71, deficit: 20 });
});

test('gordura: dentro de [floor, 90] → met', () => {
  assert.deepEqual(norm(macroFloorState('fat', 70, 70)), { status: 'met', pct: 100 });
  assert.deepEqual(norm(macroFloorState('fat', 90, 70)), { status: 'met', pct: 129 });
});

test('gordura: >90 → over (só gordura)', () => {
  assert.deepEqual(norm(macroFloorState('fat', 91, 70)), { status: 'over', pct: 130 });
  assert.deepEqual(norm(macroFloorState('fat', 95, 70)), { status: 'over', pct: 136 });
});

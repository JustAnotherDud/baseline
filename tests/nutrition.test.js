const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');
const { getNutrientColor } = loadScript('js/nutrition.js');

// ── calories: verde 90–110, amarelo 80–89.9 e 110.1–120, vermelho fora ─────────
test('calories: 90–110% é verde', () => {
  assert.equal(getNutrientColor('calories', 90), 'var(--accent)');
  assert.equal(getNutrientColor('calories', 110), 'var(--accent)');
  assert.equal(getNutrientColor('calories', 100), 'var(--accent)');
});

test('calories: 80–89.9 e 110.1–120 é amarelo', () => {
  assert.equal(getNutrientColor('calories', 89.9), 'var(--yellow)');
  assert.equal(getNutrientColor('calories', 110.1), 'var(--yellow)');
  assert.equal(getNutrientColor('calories', 120), 'var(--yellow)');
});

test('calories: abaixo de 80 e acima de 120 é vermelho', () => {
  assert.equal(getNutrientColor('calories', 79.9), 'var(--red)');
  assert.equal(getNutrientColor('calories', 120.1), 'var(--red)');
});

// ── protein: verde 86–130, amarelo 63–85.9 e 130.1–150, vermelho fora ──────────
test('protein: 86–130% é verde', () => {
  assert.equal(getNutrientColor('protein', 86), 'var(--accent)');
  assert.equal(getNutrientColor('protein', 130), 'var(--accent)');
});

test('protein: 63–85.9 e 130.1–150 é amarelo', () => {
  assert.equal(getNutrientColor('protein', 63), 'var(--yellow)');
  assert.equal(getNutrientColor('protein', 150), 'var(--yellow)');
});

test('protein: abaixo de 63 e acima de 150 é vermelho', () => {
  assert.equal(getNutrientColor('protein', 62.9), 'var(--red)');
  assert.equal(getNutrientColor('protein', 150.1), 'var(--red)');
});

// ── fat: verde 85–160, amarelo 54–84.9 e 160.1–200, vermelho fora ───────────────
test('fat: 85–160% é verde', () => {
  assert.equal(getNutrientColor('fat', 85), 'var(--accent)');
  assert.equal(getNutrientColor('fat', 160), 'var(--accent)');
});

test('fat: 54–84.9 e 160.1–200 é amarelo', () => {
  assert.equal(getNutrientColor('fat', 54), 'var(--yellow)');
  assert.equal(getNutrientColor('fat', 200), 'var(--yellow)');
});

test('fat: acima de 200 é vermelho', () => {
  assert.equal(getNutrientColor('fat', 200.1), 'var(--red)');
});

// ── carbs: verde 85–135, amarelo 70–84.9 e 135.1–150, vermelho fora ────────────
test('carbs: 85–135% é verde', () => {
  assert.equal(getNutrientColor('carbs', 85), 'var(--accent)');
  assert.equal(getNutrientColor('carbs', 135), 'var(--accent)');
});

test('carbs: 70–84.9 e 135.1–150 é amarelo', () => {
  assert.equal(getNutrientColor('carbs', 70), 'var(--yellow)');
  assert.equal(getNutrientColor('carbs', 150), 'var(--yellow)');
});

test('carbs: 151+ é vermelho', () => {
  assert.equal(getNutrientColor('carbs', 151), 'var(--red)');
});

// ── fiber: verde ≥90, amarelo 70–89.9, vermelho <70 ────────────────────────────
test('fiber: ≥90% é verde', () => {
  assert.equal(getNutrientColor('fiber', 90), 'var(--accent)');
  assert.equal(getNutrientColor('fiber', 100), 'var(--accent)');
});

test('fiber: 70–89.9 é amarelo', () => {
  assert.equal(getNutrientColor('fiber', 89.9), 'var(--yellow)');
  assert.equal(getNutrientColor('fiber', 70), 'var(--yellow)');
});

test('fiber: <70 é vermelho', () => {
  assert.equal(getNutrientColor('fiber', 69.9), 'var(--red)');
});

// ── nutriente desconhecido → sempre verde (default branch) ──────────────────────
// É o comportamento actual; não necessariamente o desejado — qualquer mudança
// aqui deve ser deliberada.
test('nutriente desconhecido (sugar) → accent', () => {
  assert.equal(getNutrientColor('sugar', 50), 'var(--accent)');
  assert.equal(getNutrientColor('saturatedfat', 200), 'var(--accent)');
});

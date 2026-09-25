// Os 8 sítios que copiam ou escalam os 7 nutrientes de um registo.
// Fixam os valores escritos na BD (ou passados adiante) antes de os juntar.
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

// Objectos do sandbox vêm de outro realm: comparar como JSON.
const plain = x => JSON.parse(JSON.stringify(x));

// DOM mínimo: qualquer id existe; cada elemento aceita o que o código lhe faz.
function fakeElement() {
  const classes = new Set();
  const el = {
    value: '', textContent: '', innerHTML: '', style: {}, dataset: {},
    classList: {
      add: c => classes.add(c), remove: c => classes.delete(c),
      contains: c => classes.has(c), toggle: (c, on) => (on ?? !classes.has(c)) ? classes.add(c) : classes.delete(c),
    },
    appendChild() {}, after() {}, addEventListener() {}, setAttribute() {}, focus() {}, select() {},
    querySelector: () => fakeElement(), querySelectorAll: () => [],
    closest: () => fakeElement(),
  };
  return el;
}
function fakeDocument() {
  const els = {};
  return {
    els,
    documentElement: {},
    body: { appendChild() {} },
    getElementById: id => (els[id] ??= fakeElement()),
    createElement: () => fakeElement(),
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

// Supabase falso: regista cada query; responses[table](q) dá a resposta.
function fakeDb(responses = {}) {
  const calls = [];
  const db = {
    from(table) {
      const q = { table, op: 'select', payload: null, eq: [] };
      calls.push(q);
      const chain = {
        insert(p) { q.op = 'insert'; q.payload = p; return chain; },
        update(p) { q.op = 'update'; q.payload = p; return chain; },
        delete() { q.op = 'delete'; return chain; },
        select() { return chain; }, order() { return chain; }, in() { return chain; },
        single() { return chain; }, maybeSingle() { return chain; },
        eq(k, v) { q.eq.push([k, v]); return chain; },
        then(ok, ko) { return Promise.resolve(responses[table]?.(q) ?? { data: null, error: null }).then(ok, ko); },
      };
      return chain;
    },
  };
  return { db, calls };
}

function load(files, extra = {}) {
  const document = fakeDocument();
  const toasts = [];
  const ctx = loadScript(files, {
    document, setTimeout: () => {},
    currentDate: '2026-09-25', selectedMeal: 'lunch', ...extra,
  });
  // Recargas e navegação ficam fora do teste.
  ctx.toast = m => toasts.push(m);
  for (const f of ['loadToday', 'loadMeals', 'closeEditEntry', 'closeMealCreate', 'pushSheetState', 'go']) ctx[f] = () => {};
  return { ctx, document, toasts };
}

const ARROZ = {
  id: 3, name: 'Arroz', calories_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28.2,
  fat_per_100g: 0.3, saturated_fat_per_100g: 0.1, sugar_per_100g: null, fiber_per_100g: 0.4,
};

test('1. saveDiary: nutrientes por 100g × gramas, 1 decimal', async () => {
  const { db, calls } = fakeDb();
  const { ctx, document } = load(['js/ui.js', 'js/db.js'], { db, selectedFood: ARROZ });
  document.getElementById('log-grams').value = '150';
  assert.equal(await ctx.saveDiary({ has_tara: true }), true);
  assert.deepEqual(plain(calls[0]), {
    table: 'diary', op: 'insert', eq: [],
    payload: {
      date: '2026-09-25', meal: 'lunch', food_id: 3, food_name: 'Arroz', grams: 150,
      calories: 195, protein: 4.1, carbs: 42.3, fat: 0.5, saturated_fat: 0.2, sugar: 0, fiber: 0.6,
      has_tara: true,
    },
  });
});

test('2. saveEditEntry (entrada rápida): lê os 7 campos do sheet', async () => {
  const { db, calls } = fakeDb();
  const { ctx, document } = load(['js/ui.js', 'js/db.js'], { db, editingEntry: { id: 9, grams: null } });
  const set = (id, v) => { document.getElementById(id).value = v; };
  set('eq-calories', '250'); set('eq-protein', '10'); set('eq-carbs', ''); set('eq-fat', '5.5');
  set('eq-satfat', '1'); set('eq-sugar', '0'); set('eq-fiber', 'abc');
  document.getElementById('edit-tara-box').classList.add('checked');
  await ctx.saveEditEntry();
  assert.deepEqual(plain(calls[0]), {
    table: 'diary', op: 'update', eq: [['id', 9]],
    payload: { calories: 250, protein: 10, carbs: 0, fat: 5.5, saturated_fat: 1, sugar: 0, fiber: 0, has_tara: true },
  });
});

test('3. saveEditEntry (com gramas): escala o snapshot pelo factor, 1 decimal', async () => {
  const { db, calls } = fakeDb();
  const entry = { id: 9, grams: 200, calories: 300, protein: 20.3, carbs: null, fat: 10, saturated_fat: 3, sugar: 1, fiber: 2 };
  const { ctx, document } = load(['js/ui.js', 'js/db.js'], { db, editingEntry: entry });
  document.getElementById('edit-grams').value = '100+50';
  await ctx.saveEditEntry();
  assert.deepEqual(plain(calls[0]), {
    table: 'diary', op: 'update', eq: [['id', 9]],
    payload: { grams: 150, calories: 225, protein: 15.2, carbs: 0, fat: 7.5, saturated_fat: 2.3, sugar: 0.8, fiber: 1.5, has_tara: false },
  });
});

test('4. donut "Guardar como refeição": prefill com snapshot e por-100g reconstruído', () => {
  const created = [];
  const { ctx, document, toasts } = load(['js/ui.js'], { openCreateMeal: (name, items) => created.push([name, items]) });
  const entries = [
    { id: 1, meal: 'lunch', food_id: 3, food_name: 'Arroz', grams: 200, calories: 260, protein: 5.4, carbs: 56.4, fat: 0.6, saturated_fat: null, sugar: 0, fiber: 0.8 },
    { id: 2, meal: 'lunch', food_id: null, food_name: 'Molho', grams: 50, calories: 40, protein: 1, carbs: 2, fat: 3, saturated_fat: 1, sugar: 1, fiber: 0 },
    { id: 3, meal: 'lunch', food_id: null, food_name: 'Rápida', grams: null, calories: 100, protein: 1, carbs: 1, fat: 1 },
    { id: 4, meal: 'dinner', food_id: 5, food_name: 'Outra', grams: 100, calories: 1, protein: 1, carbs: 1, fat: 1 },
  ];
  ctx.openMealBreakdown('lunch', entries);
  document.getElementById('meal-bd-save-btn').onclick();
  assert.deepEqual(toasts, ['1 entrada rápida não incluída']);
  assert.equal(created[0][0], 'Almoço');
  // O por-100g vem de dividir e multiplicar: comparar a 6 casas.
  const items = plain(created[0][1]);
  for (const it of items) if (it._food) for (const k in it._food) it._food[k] = Math.round(it._food[k] * 1e6) / 1e6;
  assert.deepEqual(items, [
    {
      food_id: 3, food_name: 'Arroz', grams: 200, calories: 260, protein: 5.4, carbs: 56.4, fat: 0.6,
      saturated_fat: 0, sugar: 0, fiber: 0.8,
      _food: {
        id: 3, calories_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28.2, fat_per_100g: 0.3,
        saturated_fat_per_100g: 0, sugar_per_100g: 0, fiber_per_100g: 0.4, serving_size_g: 200,
      },
    },
    {
      food_id: null, food_name: 'Molho', grams: 50, calories: 40, protein: 1, carbs: 2, fat: 3,
      saturated_fat: 1, sugar: 1, fiber: 0, _food: null,
    },
  ]);
});

test('5. mcGramsChange: por 100g × gramas, sem arredondar', () => {
  const { ctx } = load(['js/views/meals.js']);
  vm.runInContext(`mealItems = [{ id: 1, food_id: 3, food_name: 'Arroz', grams: '', _food: ${JSON.stringify(ARROZ)} }]`, ctx);
  ctx.mcGramsChange(1, '150');
  const [item] = plain(vm.runInContext('mealItems', ctx));
  assert.equal(item.grams, 150);
  const expected = { calories: 195, protein: 4.05, carbs: 42.3, fat: 0.45, saturated_fat: 0.15, sugar: 0, fiber: 0.6 };
  for (const [k, v] of Object.entries(expected)) assert.ok(Math.abs(item[k] - v) < 1e-9, `${k}: ${item[k]} ≠ ${v}`);
});

test('6. saveMeal: grava só itens com alimento e gramas, com os 7 nutrientes', async () => {
  const { db, calls } = fakeDb({ meal_templates: () => ({ data: { id: 7 }, error: null }) });
  const { ctx, document } = load(['js/views/meals.js'], { db });
  document.getElementById('mc-name').value = ' Almoço base ';
  vm.runInContext(`mealItems = [
    { id: 1, food_id: 3, food_name: 'Arroz', grams: '150', calories: 195, protein: 4.05, carbs: 42.3, fat: 0.45, saturated_fat: 0.15, sugar: 0, fiber: 0.6, _food: {} },
    { id: 2, food_id: null, food_name: '', grams: '', calories: 0, protein: 0, carbs: 0, fat: 0, saturated_fat: 0, sugar: 0, fiber: 0 },
    { id: 3, food_id: 4, food_name: 'Ovo', grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0, saturated_fat: 0, sugar: 0, fiber: 0 },
  ]`, ctx);
  await ctx.saveMeal();
  assert.deepEqual(plain(calls.map(c => [c.table, c.op, c.payload])), [
    ['meal_templates', 'insert', { name: 'Almoço base' }],
    ['meal_template_items', 'insert', [{
      template_id: 7, food_id: 3, food_name: 'Arroz', grams: 150,
      calories: 195, protein: 4.05, carbs: 42.3, fat: 0.45, saturated_fat: 0.15, sugar: 0, fiber: 0.6,
    }]],
  ]);
});

test('7. applyMealToDiary: copia os itens do template para o diário', async () => {
  const { db, calls } = fakeDb();
  const { ctx, document } = load(['js/views/meals.js'], { db });
  document.getElementById('apply-meal-select').value = 'dinner';
  vm.runInContext(`_applyMealItems = [
    { food_id: 3, food_name: 'Arroz', grams: '150', calories: '195', protein: 4.05, carbs: 42.3, fat: 0.45, saturated_fat: null, sugar: 0, fiber: 0.6 },
    { food_id: null, food_name: 'Molho', grams: 50, calories: 40, protein: 1, carbs: 2, fat: 3 },
  ]`, ctx);
  await ctx.applyMealToDiary();
  assert.deepEqual(plain(calls[0]), {
    table: 'diary', op: 'insert', eq: [],
    payload: [
      { date: '2026-09-25', meal: 'dinner', food_id: 3, food_name: 'Arroz', grams: 150,
        calories: 195, protein: 4.05, carbs: 42.3, fat: 0.45, saturated_fat: 0, sugar: 0, fiber: 0.6 },
      { date: '2026-09-25', meal: 'dinner', food_id: null, food_name: 'Molho', grams: 50,
        calories: 40, protein: 1, carbs: 2, fat: 3, saturated_fat: 0, sugar: 0, fiber: 0 },
    ],
  });
  assert.equal(ctx.selectedMeal, 'dinner');
});

test('8. mcAddItem: item novo com os 7 nutrientes a zero', () => {
  const { ctx } = load(['js/views/meals.js']);
  ctx.mcAddItem();
  assert.deepEqual(plain(vm.runInContext('mealItems', ctx)), [{
    id: 1, food_id: null, food_name: '', grams: '',
    calories: 0, protein: 0, carbs: 0, fat: 0, saturated_fat: 0, sugar: 0, fiber: 0,
  }]);
});

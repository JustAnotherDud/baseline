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
function fakeDb(responses = {}, rpcs = {}) {
  const calls = [];
  const db = {
    rpc(name, args) {
      calls.push({ rpc: name, args });
      return Promise.resolve(rpcs[name]?.(args) ?? { data: null, error: null });
    },
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
    currentDate: '2026-09-25', selectedMealId: 42, ...extra,
  });
  // Recargas e navegação ficam fora do teste.
  ctx.toast = m => toasts.push(m);
  for (const f of ['loadToday', 'closeEditEntry', 'pushSheetState', 'go']) ctx[f] = () => {};
  // refeição 42 existe: nenhum teste cria refeições (RPC meal_new) a não ser que o diga
  try { vm.runInContext("currentMeals = [{ id: 42, name: 'Almoço', no: 1, sort_at: null, n_entries: 1, is_latest: true }]", ctx); } catch {}
  return { ctx, document, toasts };
}

const ARROZ = {
  id: 3, name: 'Arroz', calories_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28.2,
  fat_per_100g: 0.3, saturated_fat_per_100g: 0.1, sugar_per_100g: null, fiber_per_100g: 0.4,
};

test('1. saveDiary: nutrientes por 100g × gramas, 1 decimal', async () => {
  const { db, calls } = fakeDb();
  const { ctx, document } = load(['js/nutrition.js', 'js/ui.js', 'js/db.js'], { db, selectedFood: ARROZ });
  document.getElementById('log-grams').value = '150';
  assert.equal(await ctx.saveDiary({ has_tara: true }), true);
  assert.deepEqual(plain(calls[0]), {
    table: 'diary', op: 'insert', eq: [],
    payload: {
      date: '2026-09-25', meal_id: 42, food_id: 3, food_name: 'Arroz', grams: 150,
      calories: 195, protein: 4.1, carbs: 42.3, fat: 0.5, saturated_fat: 0.2, sugar: 0, fiber: 0.6,
      has_tara: true,
    },
  });
});

test('2. saveEditEntry (entrada rápida): lê os 7 campos do sheet', async () => {
  const { db, calls } = fakeDb();
  const { ctx, document } = load(['js/nutrition.js', 'js/ui.js', 'js/db.js'], { db, editingEntry: { id: 9, grams: null } });
  const set = (id, v) => { document.getElementById(id).value = v; };
  set('eq-calories', '250'); set('eq-protein', '10'); set('eq-carbs', ''); set('eq-fat', '5.5');
  set('eq-saturated_fat', '1'); set('eq-sugar', '0'); set('eq-fiber', 'abc');
  document.getElementById('edit-tara-box').classList.add('checked');
  await ctx.saveEditEntry();
  assert.deepEqual(plain(calls[0]), {
    table: 'diary', op: 'update', eq: [['id', 9]],
    payload: { calories: 250, protein: 10, carbs: 0, fat: 5.5, saturated_fat: 1, sugar: 0, fiber: 0, has_tara: true },
  });
});

test('3. saveEditEntry (com gramas): escala o snapshot pelo factor, 3 casas (edições seguidas não acumulam arredondamento)', async () => {
  const { db, calls } = fakeDb();
  const entry = { id: 9, grams: 200, calories: 300, protein: 20.3, carbs: null, fat: 10, saturated_fat: 3, sugar: 1, fiber: 2 };
  const { ctx, document } = load(['js/nutrition.js', 'js/ui.js', 'js/db.js'], { db, editingEntry: entry });
  document.getElementById('edit-grams').value = '100+50';
  await ctx.saveEditEntry();
  assert.deepEqual(plain(calls[0]), {
    table: 'diary', op: 'update', eq: [['id', 9]],
    payload: { grams: 150, calories: 225, protein: 15.225, carbs: 0, fat: 7.5, saturated_fat: 2.25, sugar: 0.75, fiber: 1.5, has_tara: false },
  });
});

// ── Refeições dinâmicas ──────────────────────────────────────────────────────
const MEAL_FILES = ['js/nutrition.js', 'js/ui.js', 'js/db.js'];

test('16. saveDiary em "Nova refeição": cria a refeição (meal_new) e grava nela; as seguintes vão para ela', async () => {
  const { db, calls } = fakeDb({}, { meal_new: () => ({ data: 99, error: null }) });
  const { ctx, document } = load(MEAL_FILES, { db, selectedFood: ARROZ, selectedMealId: 'new' });
  document.getElementById('log-grams').value = '100';
  assert.equal(await ctx.saveDiary({}), true);
  const rpc = plain(calls.find(c => c.rpc));
  assert.deepEqual(rpc, { rpc: 'meal_new', args: { p_date: '2026-09-25', p_name: null, p_started_at: null } });
  assert.equal(plain(calls.find(c => c.op === 'insert').payload).meal_id, 99);
  assert.equal(ctx.selectedMealId, 99);
  assert.equal(await ctx.saveDiary({}), true);                       // 2.º registo: sem 2.ª refeição
  assert.equal(calls.filter(c => c.rpc === 'meal_new').length, 1);
  assert.equal(plain(calls.filter(c => c.op === 'insert')[1].payload).meal_id, 99);
});

test('17. saveDiary: refeição nova que falha = nada se grava', async () => {
  const { db, calls } = fakeDb({}, { meal_new: () => ({ data: null, error: { message: 'x' } }) });
  const { ctx, document, toasts } = load(MEAL_FILES, { db, selectedFood: ARROZ, selectedMealId: 'new' });
  document.getElementById('log-grams').value = '100';
  assert.equal(await ctx.saveDiary({}), false);
  assert.equal(calls.filter(c => c.op === 'insert').length, 0);
  assert.deepEqual(toasts, ['Erro ao criar refeição']);
});

test('18. saveDiary: validações antes de criar a refeição (gramas inválidas não deixam refeição vazia)', async () => {
  const { db, calls } = fakeDb();
  const { ctx, document } = load(MEAL_FILES, { db, selectedFood: ARROZ, selectedMealId: 'new' });
  document.getElementById('log-grams').value = '';
  assert.equal(await ctx.saveDiary({}), false);
  assert.equal(calls.length, 0);
});

test('19. sheet da refeição: criar usa meal_new com nome e hora; fora de hoje a hora é obrigatória', async () => {
  const { db, calls } = fakeDb({}, { meal_new: () => ({ data: 5, error: null }) });
  const { ctx, document, toasts } = load(MEAL_FILES, { db });
  document.getElementById('meal-edit-name').value = '  Pré-treino ';
  document.getElementById('meal-edit-time').value = '';
  await ctx.saveMealSheet(null);                                      // 2026-09-25 não é hoje, sem hora
  assert.deepEqual(toasts, ['Indica a hora da refeição']);
  assert.equal(calls.filter(c => c.rpc).length, 0);
  document.getElementById('meal-edit-time').value = '07:30';
  await ctx.saveMealSheet(null);
  const rpc = plain(calls.find(c => c.rpc)).args;
  assert.equal(rpc.p_date, '2026-09-25'); assert.equal(rpc.p_name, 'Pré-treino');
  assert.equal(ctx.fmtHM(rpc.p_started_at), '07:30');
  assert.equal(ctx.selectedMealId, 5);
});

test('20. sheet da refeição: editar só envia started_at se a hora mudou; nome vazio = null', async () => {
  const { db, calls } = fakeDb();
  const { ctx, document } = load(MEAL_FILES, { db });
  const ts = new Date(2026, 8, 25, 12, 40).toISOString();
  vm.runInContext(`currentMeals = [{ id: 42, name: 'Almoço', no: 1, date: '2026-09-25', sort_at: ${JSON.stringify(ts)}, started_at: null, n_entries: 2, is_latest: true }]`, ctx);
  document.getElementById('meal-edit-name').value = '';
  document.getElementById('meal-edit-time').value = '12:40';          // igual: não mexe na hora
  await ctx.saveMealSheet(42);
  assert.deepEqual(plain(calls[0]), { table: 'meals', op: 'update', payload: { name: null }, eq: [['id', 42]] });
  document.getElementById('meal-edit-name').value = 'Almoço tardio';
  document.getElementById('meal-edit-time').value = '14:15';
  await ctx.saveMealSheet(42);
  const p = plain(calls[1].payload);
  assert.equal(p.name, 'Almoço tardio'); assert.equal(ctx.fmtHM(p.started_at), '14:15');
});

test('21. eliminar refeição: a BD recusa se tem entradas (ON DELETE RESTRICT) e a PWA avisa', async () => {
  const { db, calls } = fakeDb({ meals: () => ({ data: null, error: { code: '23503' } }) });
  const { ctx, toasts } = load(MEAL_FILES, { db });
  await ctx.deleteEmptyMeal(42);
  assert.deepEqual(plain(calls[0]), { table: 'meals', op: 'delete', payload: null, eq: [['id', 42]] });
  assert.deepEqual(toasts, ['Só se elimina uma refeição vazia']);
});

test('22. mover entrada: grava meal_id', async () => {
  const { db, calls } = fakeDb({}, { meal_new: () => ({ data: 8, error: null }) });
  const { ctx } = load(MEAL_FILES, { db });
  assert.equal(await ctx.moveEntryToMeal(5, 43), true);
  assert.deepEqual(plain(calls[0]), { table: 'diary', op: 'update', payload: { meal_id: 43 }, eq: [['id', 5]] });
});

test('23. presetMealSelection: sem refeições = "Nova"; a regra das 2 h (meal_suggest) decide o resto', async () => {
  const { db } = fakeDb({}, { meal_suggest: () => ({ data: 42, error: null }) });
  const { ctx } = load(['js/nutrition.js', 'js/ui.js', 'js/views/log.js'], { db, mealManuallySelected: false });
  await ctx.presetMealSelection();
  assert.equal(ctx.selectedMealId, 42);                               // sugestão da BD
  const { db: db2 } = fakeDb({}, { meal_suggest: () => ({ data: null, error: null }) });
  const b = load(['js/nutrition.js', 'js/ui.js', 'js/views/log.js'], { db: db2, mealManuallySelected: false });
  await b.ctx.presetMealSelection();
  assert.equal(b.ctx.selectedMealId, 'new');                          // última entrada há > 2 h: refeição nova
});

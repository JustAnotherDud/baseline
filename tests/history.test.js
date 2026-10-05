// Histórico: formatação de uma linha de v_day_totals (nutrition.js) e paginação (views/history.js).
// A agregação, o colapso de dias vazios, o delta e a cobertura vêm da vista (testes SQL);
// aqui só se testa o que a PWA mostra e como pagina.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

const plain = x => JSON.parse(JSON.stringify(x));
const c = loadScript('js/nutrition.js');
const DASH = '\u2014', MINUS = '\u2212';

// Linha base: dia com entradas, delta e custo acompanhados, cobertura total.
const row = (o = {}) => ({
  date: '2026-10-02', date_from: '2026-10-02', n_days: 1, is_gap: false, n_entries: 12,
  kcal: 3657.6, protein: 190.4, carbs: 410.5, fat: 120.2, fiber: 33.4,
  delta_kcal: 184.4, delta_tracked: true, cost_eur: 9.67, coverage: 1, counts_in_avg: true,
  cost_tracked: true, is_today: false, ...o,
});

test('dia com entradas: kcal, macros e fibra arredondados', () => {
  const m = c.historyRowModel(row());
  assert.equal(m.kcal, '3658');
  assert.equal(m.macros, 'P 190 \u00B7 C 411 \u00B7 F 120 \u00B7 Fib 33');
  assert.equal(m.title, 'sex 02/10');
  assert.equal(m.empty, false); assert.equal(m.gap, false);
});

test('dia sem entradas: kcal, macros, delta e custo são "—" (nem 0, nem delta negativo)', () => {
  const m = c.historyRowModel(row({ n_entries: 0, kcal: null, protein: null, carbs: null, fat: null, fiber: null,
    delta_kcal: null, cost_eur: null, coverage: null, counts_in_avg: null }));
  assert.equal(m.empty, true);
  for (const k of ['kcal', 'macros', 'delta', 'cost']) assert.equal(m[k], DASH, k);
  assert.equal(m.cov, ''); assert.deepEqual(plain(m.tags), []);
});

test('dia vazio antes do tracking também é "—" em tudo (não célula vazia)', () => {
  const m = c.historyRowModel(row({ n_entries: 0, kcal: null, delta_kcal: null, delta_tracked: false, cost_tracked: false,
    cost_eur: null, coverage: null }));
  assert.equal(m.delta, DASH); assert.equal(m.cost, DASH);
});

test('delta: sinal, sinal de menos tipográfico e arredondamento', () => {
  assert.equal(c.historyRowModel(row({ delta_kcal: 256.6 })).delta, '+257');
  assert.equal(c.historyRowModel(row({ delta_kcal: -1590.6 })).delta, MINUS + '1591');
  assert.equal(c.historyRowModel(row({ delta_kcal: 0.2 })).delta, '0');
  assert.equal(c.historyRowModel(row({ delta_kcal: -0.4 })).delta, '0');
});

test('delta antes de maintenance_baseline_start: célula vazia, não "—"', () => {
  const m = c.historyRowModel(row({ delta_tracked: false, delta_kcal: null }));
  assert.equal(m.delta, '');
});

test('delta com entradas mas sem target: "—"', () => {
  assert.equal(c.historyRowModel(row({ delta_kcal: null })).delta, DASH);
});

test('custo antes de cost_tracking_start: vazio (não 0, não "—"), sem cobertura', () => {
  const m = c.historyRowModel(row({ cost_tracked: false, cost_eur: null, coverage: null, counts_in_avg: null }));
  assert.equal(m.cost, ''); assert.equal(m.cov, ''); assert.deepEqual(plain(m.tags), []);
});

test('custo acompanhado: valor e cobertura; sem custo registado é "—"', () => {
  const ok = c.historyRowModel(row());
  assert.equal(ok.cost, '9,67 \u20AC'); assert.equal(ok.cov, '100%'); assert.equal(ok.costDim, false);
  const none = c.historyRowModel(row({ cost_eur: null, coverage: 0, counts_in_avg: false }));
  assert.equal(none.cost, DASH); assert.equal(none.cov, '0%');
});

test('cobertura baixa: custo esbatido e etiqueta, como nas estatísticas', () => {
  const m = c.historyRowModel(row({ cost_eur: 4, coverage: 0.5, counts_in_avg: false }));
  assert.equal(m.cost, '4,00 \u20AC'); assert.equal(m.cov, '50%');
  assert.equal(m.costDim, true); assert.deepEqual(plain(m.tags), ['cobertura baixa']);
});

test('hoje: etiqueta "em curso" e kcal/delta esbatidos; custo e cobertura normais', () => {
  const m = c.historyRowModel(row({ date: '2026-10-05', is_today: true, delta_kcal: -1591 }));
  assert.equal(m.today, true); assert.equal(m.dimNums, true);
  assert.deepEqual(plain(m.tags), ['em curso']);
  assert.equal(m.delta, MINUS + '1591'); assert.equal(m.kcal, '3658');
  assert.equal(c.historyRowModel(row()).dimNums, false);
});

test('hoje com cobertura baixa: as duas etiquetas', () => {
  const m = c.historyRowModel(row({ is_today: true, counts_in_avg: false, coverage: 0.3 }));
  assert.deepEqual(plain(m.tags), ['em curso', 'cobertura baixa']);
});

test('hoje sem entradas: linha vazia "em curso" (nunca delta negativo)', () => {
  const m = c.historyRowModel(row({ is_today: true, n_entries: 0, kcal: null, delta_kcal: null }));
  assert.equal(m.empty, true); assert.equal(m.delta, DASH); assert.deepEqual(plain(m.tags), ['em curso']);
});

test('intervalo colapsado: "12/07 a 18/07 · sem registo"', () => {
  const m = c.historyRowModel({ date: '2026-07-18', date_from: '2026-07-12', n_days: 7, is_gap: true, n_entries: 0 });
  assert.equal(m.gap, true); assert.equal(m.title, '12/07 a 18/07 \u00B7 sem registo'); assert.equal(m.key, '2026-07-18');
});

test('fibra ou macro null aparece como "—" no meio da linha', () => {
  assert.match(c.historyRowModel(row({ fiber: null })).macros, /Fib \u2014$/);
});

// ── paginação (views/history.js) ────────────────────────────────────────────

function load(pages) {
  const calls = [];
  const els = {};
  const el = id => (els[id] ??= { innerHTML: '' });
  const db = {
    from(table) {
      const q = { table, order: null, limit: null, lt: null };
      calls.push(q);
      const chain = {
        select() { return chain; },
        order(col, o) { q.order = [col, o.ascending]; return chain; },
        limit(n) { q.limit = n; return chain; },
        lt(col, v) { q.lt = [col, v]; return chain; },
        then(ok, ko) { return Promise.resolve(pages.shift() ?? { data: [], error: null }).then(ok, ko); },
      };
      return chain;
    },
  };
  const toasts = [];
  const ctx = loadScript(['js/nutrition.js', 'js/views/history.js'], {
    db, document: { getElementById: el, documentElement: {} }, toast: m => toasts.push(m),
    escHtml: s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    currentDate: '2026-10-05', setDateLabel: () => {}, go: v => { ctx._went = v; },
  });
  return { ctx, calls, els, toasts };
}

const dayRows = (n, startDay = 30) => Array.from({ length: n }, (_, i) => {
  const d = `2026-09-${String(startDay - i).padStart(2, '0')}`;
  return row({ date: d, date_from: d });
});
const ok = data => ({ data, error: null });

test('primeira página: 30 linhas, do mais recente para o mais antigo, com "Carregar mais"', async () => {
  const { ctx, calls, els } = load([ok(dayRows(30))]);
  await ctx.loadHistory();
  assert.equal(calls[0].table, 'v_day_totals');
  assert.deepEqual(plain(calls[0].order), ['date', false]);
  assert.equal(calls[0].limit, 30); assert.equal(calls[0].lt, null);
  assert.match(els['history-foot'].innerHTML, /Carregar mais/);
});

test('"Carregar mais": cursor é a data da última linha; acrescenta ao fim', async () => {
  const { ctx, calls } = load([ok(dayRows(30)), ok(dayRows(30, 31).map((r, i) => ({ ...r, date: `2026-08-${String(31 - i).padStart(2, '0')}`, date_from: `2026-08-${String(31 - i).padStart(2, '0')}` })))]);
  await ctx.loadHistory();
  await ctx.loadMoreHistory();
  assert.deepEqual(plain(calls[1].lt), ['date', '2026-09-01']);
  assert.equal(calls[1].limit, 30);
  assert.equal(require('node:vm').runInContext('histRows.length', ctx), 60);
});

test('última página (< 30 linhas): sem botão, mostra o início do registo', async () => {
  const last = [row({ date: '2026-05-11', date_from: '2026-05-11' }), row({ date: '2026-05-10', date_from: '2026-05-10' })];
  const { ctx, els } = load([ok(dayRows(30)), ok(last)]);
  await ctx.loadHistory();
  await ctx.loadMoreHistory();
  assert.doesNotMatch(els['history-foot'].innerHTML, /Carregar mais/);
  assert.match(els['history-foot'].innerHTML, /In\u00EDcio do registo: 10\/05/);
});

test('refresh recarrega o que já está carregado (60 linhas), não só 30', async () => {
  const { ctx, calls } = load([ok(dayRows(30)), ok(dayRows(30, 31)), ok(dayRows(60))]);
  await ctx.loadHistory();
  await ctx.loadMoreHistory();
  await ctx.loadHistory();
  assert.equal(calls[2].limit, 60);
});

test('render: linha vazia e intervalo colapsado aparecem; só a linha de dia é tocável', async () => {
  const gap = { date: '2026-07-18', date_from: '2026-07-12', n_days: 7, is_gap: true, n_entries: 0 };
  const empty = row({ date: '2026-07-20', date_from: '2026-07-20', n_entries: 0, kcal: null, delta_kcal: null, cost_eur: null, coverage: null });
  const { ctx, els } = load([ok([empty, gap])]);
  await ctx.loadHistory();
  const html = els['history-list'].innerHTML;
  assert.match(html, /12\/07 a 18\/07 \u00B7 sem registo/);
  assert.equal((html.match(/openHistoryDay/g) || []).length, 1);   // o gap não abre o diário
  assert.match(html, /openHistoryDay\('2026-07-20'\)/);
});

test('tocar numa linha abre o diário desse dia', () => {
  const { ctx } = load([]);
  ctx.openHistoryDay('2026-09-12');
  assert.equal(require('node:vm').runInContext('currentDate', ctx), '2026-09-12');
  assert.equal(ctx._went, 'today');
});

test('erro de rede: avisa e não apaga o que estava carregado', async () => {
  const { ctx, toasts } = load([ok(dayRows(30)), { data: null, error: { message: 'x' } }]);
  await ctx.loadHistory();
  await ctx.loadHistory();
  assert.deepEqual(toasts, ['Erro ao carregar hist\u00F3rico']);
  assert.equal(require('node:vm').runInContext('histRows.length', ctx), 30);
});

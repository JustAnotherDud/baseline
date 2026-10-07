// Helpers de custo (€) em js/nutrition.js: formatação, somas e payloads de preço.
// O custo em si é calculado na BD (food_cost_eur + trigger); aqui só se testa o
// que a PWA mostra e envia.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

const c = loadScript('js/nutrition.js');
const plain = x => JSON.parse(JSON.stringify(x));

test('formatEur: vírgula decimal, 2 casas; NULL é "—", nunca 0', () => {
  assert.equal(c.formatEur(0.67), '0,67 €');
  assert.equal(c.formatEur(12.5), '12,50 €');
  assert.equal(c.formatEur('2'), '2,00 €');
  assert.equal(c.formatEur(null), '—');
  assert.equal(c.formatEur(undefined), '—');
  assert.equal(c.formatEur(0), 'grátis');          // 0 = grátis, distinto de NULL
  assert.equal(c.formatEur('0'), 'grátis');
  assert.equal(c.formatEur(0.53, '/100g'), '0,53 €/100g');
  assert.equal(c.formatEur(0, '/100g'), 'grátis');
});

test('eurPer100g: pack 3x125g a 2€ = 0,53 €/100g; sem preço válido é null', () => {
  assert.equal(c.formatEur(c.eurPer100g(2, 375)), '0,53 €');
  assert.equal(c.eurPer100g(null, 375), null);
  assert.equal(c.eurPer100g(2, 0), null);
  assert.equal(c.eurPer100g('', ''), null);
});

test('foodPriceLabel: só com preço', () => {
  assert.equal(c.foodPriceLabel({ price_eur: 2, price_qty_g: 375 }), ' · 0,53 €/100g');
  assert.equal(c.foodPriceLabel({ price_eur: null, price_qty_g: null }), '');
  assert.equal(c.foodPriceLabel({}), '');
});

test('costSummary: total ignora NULL, cobertura é por kcal', () => {
  const s = c.costSummary([
    { calories: 300, cost_eur: 0.67 }, { calories: 100, cost_eur: null }, { calories: 600, cost_eur: '12.5' }]);
  assert.equal(s.total, 13.17);
  assert.equal(s.coverage, 0.9);
});

test('costSummary: nenhuma entrada com custo = total null (não 0); sem kcal = cobertura null', () => {
  assert.deepEqual(plain(c.costSummary([{ calories: 200, cost_eur: null }])), { total: null, coverage: 0 });
  assert.deepEqual(plain(c.costSummary([])), { total: null, coverage: null });
});

test('costAverage: só dias que contam; devolve quantos', () => {
  const r = c.costAverage([
    { cost_eur: 20, counts_in_avg: true }, { cost_eur: 4, counts_in_avg: false }, { cost_eur: 10, counts_in_avg: true }]);
  assert.deepEqual(plain(r), { n: 2, avg: 15 });
  assert.deepEqual(plain(c.costAverage([{ cost_eur: 4, counts_in_avg: false }])), { n: 0, avg: null });
});

test('priceHtml: formata em € dentro de .price', () => {
  assert.equal(c.priceHtml(0.9), '<span class="price">0,90 €</span>');
  assert.equal(c.priceHtml(null), '<span class="price">— €</span>'.replace('— €', '—'));
});

test('entryCostHtml: override = pill ↓; manual = glifo ✎; default sem marca; nada em title', () => {
  assert.equal(c.entryCostHtml({ cost_eur: 0.45, cost_source: 'override' }), '<span class="price-promo">↓ 0,45 €</span>');
  assert.equal(c.entryCostHtml({ cost_eur: 0.45, cost_source: 'manual' }), '<span class="cost-glyph">✎</span>0,45 €');
  assert.equal(c.entryCostHtml({ cost_eur: 0.9, cost_source: 'default' }), '0,90 €');
  assert.equal(c.entryCostHtml({ cost_eur: null, cost_source: null }), '—');
});

test('foodCostMetric: €/100g, kcal/€ e g proteína/€; sem preço = null', () => {
  const f = { price_eur: 2, price_qty_g: 400, calories_per_100g: 250, protein_per_100g: 20 }; // 0,50 €/100g
  assert.equal(c.foodCostMetric(f, 'eur_100g'), 0.5);
  assert.equal(c.foodCostMetric(f, 'kcal_eur'), 500);
  assert.equal(c.foodCostMetric(f, 'prot_eur'), 40);
  assert.equal(c.foodCostMetric({ calories_per_100g: 100 }, 'kcal_eur'), null);
  assert.equal(c.foodCostMetric({ price_eur: 1, price_qty_g: 0 }, 'eur_100g'), null);
});

test('foodMatchesQuery: , = ou, & = e, ! = nega, price = tem preço', () => {
  const A = { name: 'Atum Natural', brand: 'Continente', price_eur: 2, price_qty_g: 100 };
  const B = { name: 'Aveia', brand: 'Continente' };
  const C = { name: 'Arroz', brand: 'Pingo Doce' };
  const m = (f, q) => c.foodMatchesQuery(f, q);
  assert.ok(m(A, '') && m(B, '  ') && m(C, ' , '));
  assert.ok(m(A, 'atum') && !m(B, 'atum') && m(B, 'continente'));
  assert.ok(m(A, 'atum, arroz') && m(C, 'atum, arroz'));
  assert.ok(!m(A, 'continente&!price') && m(B, 'continente&!price') && !m(C, 'continente&!price'));
  assert.ok(m(A, 'continente&price') && !m(B, 'continente&price'));
  assert.ok(m(B, '!price') && m(C, '!preço') && !m(A, '!preco'));
  assert.ok(m(B, 'continente&!atum') && !m(A, 'continente&!atum'));
  assert.ok(m(A, 'continente & !light'));
  assert.ok(m(C, 'continente&!price, arroz'));
});

test('describeFoodQuery: frase legível do filtro', () => {
  assert.equal(c.describeFoodQuery(''), '');
  assert.equal(c.describeFoodQuery('continente&!price'), '“continente” e sem preço');
  assert.equal(c.describeFoodQuery('!preço'), 'sem preço');
  assert.equal(c.describeFoodQuery('price, atum&!light'), 'com preço ou “atum” e sem “light”');
});

test('foodsHelpLines: ordem activa, sem preço no fim nos chips de custo, filtro só se houver', () => {
  const s = loadScript(['js/nutrition.js', 'js/views/foods.js']);
  assert.deepEqual(plain(s.foodsHelpLines('name', 'asc', '')), { sort: 'Ordem: nome A→Z', filter: '' });
  assert.deepEqual(plain(s.foodsHelpLines('eur_100g', 'asc', 'continente&!price')),
    { sort: 'Ordem: mais barato primeiro · sem preço no fim', filter: 'Filtro: “continente” e sem preço' });
  for (const k of ['name', 'calories', 'p_kcal', 'c_kcal', 'f_kcal', 'eur_100g', 'kcal_eur', 'prot_eur']) for (const d of ['asc', 'desc']) assert.ok(s.foodsHelpLines(k, d, '').sort, `${k}/${d}`);
});

test('sortFoodsBy: chips de custo; sem preço sempre no fim', () => {
  const s = loadScript(['js/nutrition.js', 'js/views/foods.js']);
  const mk = (name, price, qty, kcal, prot) => ({ name, price_eur: price, price_qty_g: qty, calories_per_100g: kcal, protein_per_100g: prot });
  const foods = [mk('Sem', null, null, 900, 90), mk('Caro', 4, 100, 100, 10), mk('Barato', 1, 100, 100, 10), mk('Denso', 1, 200, 500, 5)];
  const names = (sort, dir) => plain(s.sortFoodsBy(foods, sort, dir).map(f => f.name));
  assert.deepEqual(names('eur_100g', 'asc'), ['Denso', 'Barato', 'Caro', 'Sem']);
  assert.deepEqual(names('eur_100g', 'desc'), ['Caro', 'Barato', 'Denso', 'Sem']);
  assert.deepEqual(names('kcal_eur', 'desc'), ['Denso', 'Barato', 'Caro', 'Sem']);
  assert.deepEqual(names('prot_eur', 'desc'), ['Barato', 'Denso', 'Caro', 'Sem']);
});

test('dayCostHtml: só o valor acima do limiar; "≥ valor · N%" abaixo', () => {
  assert.equal(c.dayCostHtml({ total: 11.97, coverage: 1 }, 0.9), '11,97 €');
  assert.equal(c.dayCostHtml({ total: 11.97, coverage: 0.9 }, 0.9), '11,97 €'); // no limiar conta como ok
  assert.equal(c.dayCostHtml({ total: 8.4, coverage: 0.72 }, 0.9),
    '<span class="cost-glyph">≥</span>8,40 €<span class="cost-pct"> · 72%</span>');
  assert.equal(c.dayCostHtml({ total: null, coverage: 0 }, 0.9),
    '<span class="cost-glyph">≥</span>—<span class="cost-pct"> · 0%</span>');
  assert.equal(c.dayCostHtml({ total: 5, coverage: null }, 0.9),
    '<span class="cost-glyph">≥</span>5,00 €<span class="cost-pct"> · 0%</span>');
  assert.ok(!/title=/.test(c.dayCostHtml({ total: 8.4, coverage: 0.72 }, 0.9)));
});

test('adherenceDotText: "dd/mm · N%" ou "sem dados"', () => {
  assert.equal(c.adherenceDotText('05/10', 94.4), '05/10 · 94%');
  assert.equal(c.adherenceDotText('05/10', 0), '05/10 · 0%');
  assert.equal(c.adherenceDotText('05/10', null), '05/10 · sem dados');
  assert.equal(c.adherenceDotText('05/10', undefined), '05/10 · sem dados');
});

test('tipLeft: centra no ponto e fica dentro do ecrã com margem', () => {
  assert.equal(c.tipLeft(100, 80, 375, 8), 60);
  assert.equal(c.tipLeft(10, 80, 375, 8), 8);
  assert.equal(c.tipLeft(370, 80, 375, 8), 287);
  assert.equal(c.tipLeft(50, 500, 375, 8), 8); // tooltip maior que o ecrã: nunca negativo
});

test('costEfficiency: só entradas com custo e só dias que contam; kcal/proteína das mesmas entradas', () => {
  const days = new Set(['2026-10-05', '2026-10-06']);
  const E = [
    { date: '2026-10-05', calories: 500, protein: 40, cost_eur: 2 },
    { date: '2026-10-05', calories: '300', protein: '10', cost_eur: '1' },
    { date: '2026-10-05', calories: 900, protein: 50, cost_eur: null },      // sem custo: fora
    { date: '2026-10-06', calories: 200, protein: 50, cost_eur: 1 },
    { date: '2026-10-04', calories: 5000, protein: 500, cost_eur: 99 },      // dia que não conta: fora
  ];
  const r = plain(c.costEfficiency(E, days));
  assert.equal(r.n_days, 2); assert.equal(r.cost, 4); assert.equal(r.kcal, 1000); assert.equal(r.protein, 100);
  assert.equal(r.per1000kcal, 4);        // 4 € / 1000 kcal
  assert.equal(r.per100gProtein, 4);     // 4 € / 100 g
});

test('costEfficiency: sem entradas elegíveis ou sem proteína = null (nunca 0 nem NaN)', () => {
  const none = plain(c.costEfficiency([], new Set(['2026-10-05'])));
  assert.deepEqual([none.n_days, none.per1000kcal, none.per100gProtein], [0, null, null]);
  const noProt = plain(c.costEfficiency([{ date: 'd', calories: 100, protein: 0, cost_eur: 1 }], new Set(['d'])));
  assert.equal(noProt.per1000kcal, 10); assert.equal(noProt.per100gProtein, null);
  const notCounted = plain(c.costEfficiency([{ date: 'x', calories: 100, protein: 5, cost_eur: 1 }], new Set(['d'])));
  assert.equal(notCounted.n_days, 0);
});

test('costSourceTag', () => {
  assert.equal(c.costSourceTag('override'), 'Promo');
  assert.equal(c.costSourceTag('manual'), 'manual');
  assert.equal(c.costSourceTag('default'), '');
  assert.equal(c.costSourceTag(null), '');
});

const FOOD = { price_eur: 2, price_qty_g: 375 };

test('priceOverridePayload: vazio, igual ao default, override, só preço, erro', () => {
  assert.deepEqual(plain(c.priceOverridePayload(FOOD, '', '')), {});
  assert.deepEqual(plain(c.priceOverridePayload(FOOD, '2', '375')), {});
  assert.deepEqual(plain(c.priceOverridePayload(FOOD, '2', '')), {});          // = default, sem gramas
  assert.deepEqual(plain(c.priceOverridePayload(FOOD, '1.5', '375')), { price_eur: 1.5, price_qty_g: 375, cost_source: 'override' });
  assert.deepEqual(plain(c.priceOverridePayload(FOOD, '1.5', '')), { price_eur: 1.5, cost_source: 'override' });
  assert.deepEqual(plain(c.priceOverridePayload({}, '3', '500')), { price_eur: 3, price_qty_g: 500, cost_source: 'override' });
  assert.ok(c.priceOverridePayload({}, '3', '').error);                          // alimento sem preço, sem gramas
  assert.ok(c.priceOverridePayload(FOOD, '', '200').error);                      // gramas sem preço
});

const ENTRY = { price_eur: 2, price_qty_g: 375, cost_source: 'default', cost_eur: 0.67 };

test('editPricePatch: só envia o que mudou face ao snapshot da entrada', () => {
  assert.deepEqual(plain(c.editPricePatch(ENTRY, '2', '375', false)), {});
  assert.deepEqual(plain(c.editPricePatch(ENTRY, '', '', false)), {});
  assert.deepEqual(plain(c.editPricePatch(ENTRY, '1', '375', false)), { price_eur: 1, price_qty_g: 375, cost_source: 'override' });
  assert.deepEqual(plain(c.editPricePatch(ENTRY, '2', '250', false)), { price_eur: 2, price_qty_g: 250, cost_source: 'override' });
  assert.ok(c.editPricePatch(ENTRY, '1', '', false).error);
});

test('editPricePatch: reset volta ao default (limpa o override)', () => {
  assert.deepEqual(plain(c.editPricePatch({ cost_source: 'override', price_eur: 1, price_qty_g: 375 }, '1', '375', true)),
    { cost_source: 'default', price_eur: null, price_qty_g: null });
});

test('manualCostPatch: define, mantém, limpa, rejeita negativo', () => {
  assert.deepEqual(plain(c.manualCostPatch({}, '12.5')), { cost_source: 'manual', cost_eur: 12.5 });
  assert.deepEqual(plain(c.manualCostPatch({ cost_eur: 12.5, cost_source: 'manual' }, '12.5')), {});
  assert.deepEqual(plain(c.manualCostPatch({ cost_eur: 12.5, cost_source: 'manual' }, '9')), { cost_source: 'manual', cost_eur: 9 });
  assert.deepEqual(plain(c.manualCostPatch({ cost_eur: 12.5, cost_source: 'manual' }, '')), { cost_source: null, cost_eur: null });
  assert.deepEqual(plain(c.manualCostPatch({}, '')), {});
  assert.deepEqual(plain(c.manualCostPatch({}, '0')), { cost_source: 'manual', cost_eur: 0 });
  assert.ok(c.manualCostPatch({}, '-1').error);
});

test('grátis: preço 0 é custo conhecido em €/100g, rótulo, soma e média', () => {
  assert.equal(c.eurPer100g(0, 100), 0);
  assert.equal(c.eurPer100g('', 100), null);
  assert.equal(c.foodPriceLabel({ price_eur: 0, price_qty_g: 100 }), ' · grátis');
  const s = c.costSummary([{ calories: 100, cost_eur: 0 }, { calories: 100, cost_eur: null }]);
  assert.equal(s.total, 0);          // não null: há custo conhecido
  assert.equal(s.coverage, 0.5);
  assert.equal(c.costSummary([{ calories: 100, cost_eur: 0 }]).coverage, 1);
  const a = c.costAverage([{ counts_in_avg: true, cost_eur: 0 }, { counts_in_avg: true, cost_eur: 4 }]);
  assert.deepEqual(plain(a), { n: 2, avg: 2 });
});

test('grátis: payloads aceitam preço 0 (override), distinto de campo vazio', () => {
  const food = { price_eur: 2, price_qty_g: 375 };
  assert.deepEqual(plain(c.priceOverridePayload(food, '0', '375')), { price_eur: 0, price_qty_g: 375, cost_source: 'override' });
  assert.deepEqual(plain(c.priceOverridePayload(food, '0', '')), { price_eur: 0, cost_source: 'override' });
  assert.deepEqual(plain(c.priceOverridePayload({}, '', '')), {});
  assert.ok(c.priceOverridePayload({}, '0', '').error);          // food sem gramas de preço
  assert.deepEqual(plain(c.priceOverridePayload({ price_eur: 0, price_qty_g: 100 }, '0', '100')), {});   // igual ao default
  const entry = { price_eur: 2, price_qty_g: 375 };
  assert.deepEqual(plain(c.editPricePatch(entry, '0', '375', false)), { price_eur: 0, price_qty_g: 375, cost_source: 'override' });
  assert.deepEqual(plain(c.editPricePatch({ price_eur: null, price_qty_g: null }, '', '', false)), {});
});

test('grátis: custo manual 0 grava-se; vazio limpa', () => {
  assert.deepEqual(plain(c.manualCostPatch({}, '0')), { cost_source: 'manual', cost_eur: 0 });
  assert.deepEqual(plain(c.manualCostPatch({ cost_eur: 0, cost_source: 'manual' }, '0')), {});
  assert.deepEqual(plain(c.manualCostPatch({ cost_eur: 0, cost_source: 'manual' }, '')), { cost_source: null, cost_eur: null });
  assert.deepEqual(plain(c.manualCostPatch({}, '')), {});
});

test('foodPricePayload: vazio = null, 0 = grátis (100 g por defeito), par obrigatório', () => {
  assert.deepEqual(plain(c.foodPricePayload('', '')), { price_eur: null, price_qty_g: null });
  assert.deepEqual(plain(c.foodPricePayload('0', '')), { price_eur: 0, price_qty_g: 100 });
  assert.deepEqual(plain(c.foodPricePayload('0', '250')), { price_eur: 0, price_qty_g: 250 });
  assert.deepEqual(plain(c.foodPricePayload('2', '375')), { price_eur: 2, price_qty_g: 375 });
  assert.ok(c.foodPricePayload('2', '').error);
  assert.ok(c.foodPricePayload('', '375').error);
});

test('grátis nos chips de custo: €/100g = 0, kcal/€ e P/€ = Infinity, ordenação estável', () => {
  const s = loadScript(['js/nutrition.js', 'js/views/foods.js']);
  const free = (name) => ({ name, price_eur: 0, price_qty_g: 100, calories_per_100g: 40, protein_per_100g: 2 });
  const paid = { name: 'Pago', price_eur: 1, price_qty_g: 100, calories_per_100g: 100, protein_per_100g: 10 };
  assert.equal(s.foodCostMetric(free('x'), 'eur_100g'), 0);
  assert.equal(s.foodCostMetric(free('x'), 'kcal_eur'), Infinity);
  const names = (sort, dir) => plain(s.sortFoodsBy([paid, free('B'), free('A')], sort, dir).map(f => f.name));
  assert.deepEqual(names('eur_100g', 'asc'), ['B', 'A', 'Pago']);
  assert.deepEqual(names('kcal_eur', 'desc'), ['B', 'A', 'Pago']);
  assert.ok(c.foodMatchesQuery(free('x'), 'price'));          // grátis tem preço
});

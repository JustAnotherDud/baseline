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
  assert.equal(c.formatEur(0), '0,00 €');
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

test('entryCostHtml: só override leva pill ↓; manual e default sem marca visível', () => {
  assert.equal(c.entryCostHtml({ cost_eur: 0.45, cost_source: 'override' }), '<span class="price-promo" title="Promo">↓ 0,45 €</span>');
  assert.equal(c.entryCostHtml({ cost_eur: 12.5, cost_source: 'manual' }), '<span title="manual">12,50 €</span>');
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

// Promoções (lotes): formatação e payloads em js/nutrition.js. O consumo dos lotes e o custo
// calculam-se na BD (promo_plan + diary_cost_trigger); aqui só se testa o que a PWA mostra e envia.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./_load.js');

const c = loadScript('js/nutrition.js');
const plain = x => JSON.parse(JSON.stringify(x));

test('entryCostHtml / costSourceTag: promo (lote) marca como override', () => {
  assert.equal(c.entryCostHtml({ cost_eur: 0.71, cost_source: 'promo' }), '<span class="price-promo">↓ 0,71 €</span>');
  assert.equal(c.entryCostHtml({ cost_eur: 0, cost_source: 'promo' }), '<span class="price-promo">↓ grátis</span>');
  assert.equal(c.costSourceTag('promo'), 'Promo');
});

test('fmtG: 1 casa no máximo, vírgula decimal', () => {
  assert.equal(c.fmtG(700), '700');
  assert.equal(c.fmtG(12.5), '12,5');
  assert.equal(c.fmtG('12.04'), '12');
});

test('promoPreviewText: X g do stock promo, Y €', () => {
  assert.equal(c.promoPreviewText({ promo_g: 700, rest_g: 0, total_eur: 0.41 }), '700 g do stock promo, 0,41 €');
  assert.equal(c.promoPreviewText({ promo_g: 500, rest_g: 500, total_eur: 0.8 }),
    '500 g do stock promo, 0,80 € · 500 g ao preço normal');
  assert.equal(c.promoPreviewText({ promo_g: 0, rest_g: 300, total_eur: null }), '');
  assert.equal(c.promoPreviewText(null), '');
});

test('promoSplitText: split de uma entrada a partir das alocações', () => {
  const entry = { grams: 1000, cost_eur: 0.71 };
  assert.equal(c.promoSplitText(entry, [{ grams: 700, cost_eur: 0.41 }]),
    '700 g do stock promo (0,41 €) + 300 g ao preço normal (0,30 €)');
  assert.equal(c.promoSplitText({ grams: 300, cost_eur: 0.18 }, [{ grams: 300, cost_eur: 0.18 }]),
    '300 g do stock promo (0,18 €)');                                   // sem resto: sem "+"
  assert.equal(c.promoSplitText({ grams: 500, cost_eur: 0.3 }, [{ grams: 200, cost_eur: 0.12 }, { grams: 300, cost_eur: 0.18 }]),
    '500 g do stock promo (0,30 €)');                                   // vários lotes somam
  assert.equal(c.promoSplitText(entry, []), '');
});

test('promoLotModel: linhas e avisos (só informação)', () => {
  const lot = {
    food_name: 'Esparguete', brand: 'Lidl', grams_left: 700, grams_bought: 1000, paid_eur: 0.59, ref_eur: 0.99,
    saving_total: 0.4, saving_realised: 0, store: 'Lidl', bought_on: '2026-10-08', best_before: null, note: 'pontos',
    warn_expired: false, warn_old: false, age_days: 0,
  };
  const m = plain(c.promoLotModel(lot));
  assert.equal(m.title, 'Esparguete · Lidl');
  assert.equal(m.left, '700 de 1000 g');
  assert.equal(m.paid, 'pago 0,59 € · normal 0,99 €');
  assert.equal(m.saving, 'poupança 0,40 € · realizada 0,00 €');       // 0 poupado é "0,00 €", não "grátis"
  assert.equal(m.meta, 'Lidl · comprado 08/10 · pontos');
  assert.deepEqual(m.warns, []);
  const w = plain(c.promoLotModel({ ...lot, warn_expired: true, warn_old: true, age_days: 91, best_before: '2026-09-01' }));
  assert.deepEqual(w.warns, ['validade passada', 'aberto há 91 dias']);
  assert.match(w.meta, /validade 01\/09/);
  assert.equal(plain(c.promoLotModel({ ...lot, brand: null, paid_eur: 0 })).paid, 'pago grátis · normal 0,99 €');
});

test('promoStockMap: soma das gramas abertas por alimento', () => {
  const m = c.promoStockMap([{ food_id: 118, grams_left: 700 }, { food_id: 118, grams_left: 300 }, { food_id: 5, grams_left: 40 }]);
  assert.equal(m.get(118), 1000);
  assert.equal(m.get(5), 40);
  assert.equal(c.promoStockMap(null).size, 0);
});

test('promoLotPayload: valida e monta o INSERT; 0 pago é válido', () => {
  const food = { id: 118 };
  const f = { food, grams: '1000', paid: '0.59', ref: '0.99', date: '2026-10-08', store: ' Lidl ', note: '', best_before: '' };
  assert.deepEqual(plain(c.promoLotPayload(f)), {
    food_id: 118, bought_on: '2026-10-08', grams_bought: 1000, paid_eur: 0.59, ref_eur: 0.99,
    store: 'Lidl', note: null, best_before: null });
  assert.equal(c.promoLotPayload({ ...f, paid: '0' }).paid_eur, 0);
  assert.ok(c.promoLotPayload({ ...f, food: null }).error);
  assert.ok(c.promoLotPayload({ ...f, grams: '' }).error);
  assert.ok(c.promoLotPayload({ ...f, grams: '0' }).error);
  assert.ok(c.promoLotPayload({ ...f, paid: '' }).error);
  assert.ok(c.promoLotPayload({ ...f, ref: '' }).error);
  assert.ok(c.promoLotPayload({ ...f, date: '' }).bought_on);          // sem data: hoje (localDate)
});

test('promoRefSuggestion: preço normal das gramas a partir do preço do alimento', () => {
  assert.equal(c.promoRefSuggestion({ price_eur: 0.99, price_qty_g: 1000 }, '1000'), 0.99);
  assert.equal(c.promoRefSuggestion({ price_eur: 2, price_qty_g: 375 }, '125'), 0.67);
  assert.equal(c.promoRefSuggestion({ price_eur: null, price_qty_g: null }, '100'), null);
  assert.equal(c.promoRefSuggestion({ price_eur: 1, price_qty_g: 100 }, ''), null);
  assert.equal(c.promoRefSuggestion(null, '100'), null);
});

test('editPricePatch: entrada promo sem mexer no preço não envia custo (o lote fica ao trigger)', () => {
  const entry = { price_eur: 0.99, price_qty_g: 1000, cost_source: 'promo', cost_eur: 0.71 };
  assert.deepEqual(plain(c.editPricePatch(entry, '0.99', '1000', false)), {});
  assert.deepEqual(plain(c.editPricePatch(entry, '0.99', '1000', true)), { cost_source: 'default', price_eur: null, price_qty_g: null });
});

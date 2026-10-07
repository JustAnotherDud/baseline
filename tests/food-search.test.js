// Gramática da pesquisa de alimentos: casos partilhados com o SQL (sync_hub: food_query_ok / foods_search).
// O JS só filtra (conjunto); a ordem é testada no SQL a partir do mesmo ficheiro.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadScript } = require('./_load.js');

const c = loadScript('js/nutrition.js');
const { foods, cases } = JSON.parse(fs.readFileSync(path.join(__dirname, 'food-search-cases.json'), 'utf8'));

for (const { q, order } of cases) {
  test(`foodMatchesQuery partilhado: "${q}"`, () => {
    const got = foods.filter(f => c.foodMatchesQuery(f, q)).map(f => f.name).sort();
    assert.deepEqual(got, [...order].sort());
  });
}

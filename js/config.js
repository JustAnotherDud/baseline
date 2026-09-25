// Data local YYYY-MM-DD. toISOString() dá a data UTC: às 00:30 em UTC+1 ainda é ontem.
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Os 7 nutrientes de diary e dos templates (em foods: `<nome>_per_100g`).
// Os secundários podem vir a null em linhas antigas.
const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'saturated_fat', 'sugar', 'fiber'];
const SECONDARY_NUTRIENTS = ['saturated_fat', 'sugar', 'fiber'];

// { calories: fn('calories'), ... } pela ordem de NUTRIENTS.
const mapNutrients = fn => Object.fromEntries(NUTRIENTS.map(k => [k, fn(k)]));

const APP_VERSION = '20260925b';

const MEALS = {
  breakfast:   'Pequeno-almoço',
  morning:     'Lanche manhã',
  lunch:       'Almoço',
  afternoon1:  'Lanche tarde 1',
  afternoon2:  'Lanche tarde 2',
  dinner:      'Jantar',
  supper:      'Ceia',
};

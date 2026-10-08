// Data local YYYY-MM-DD. toISOString() dá a data UTC: às 00:30 em UTC+1 ainda é ontem.
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Número em pt-PT: vírgula decimal. d = casas (omitido: as que o número tiver). Sem número: "—".
function numPt(v, d) {
  const n = Number(v);
  if (v == null || v === '' || !isFinite(n)) return '—';
  return (d === undefined ? String(n) : n.toFixed(d)).replace('.', ',');
}

// Dia civil em Europe/Lisbon (YYYY-MM-DD), como a BD conta os dias. Só para detectar a mudança de dia.
function lisbonDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// Os 7 nutrientes de diary e dos templates (em foods: `<nome>_per_100g`).
// Os secundários podem vir a null em linhas antigas.
const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'saturated_fat', 'sugar', 'fiber'];
const SECONDARY_NUTRIENTS = ['saturated_fat', 'sugar', 'fiber'];

// { calories: fn('calories'), ... } pela ordem de NUTRIENTS.
const mapNutrients = fn => Object.fromEntries(NUTRIENTS.map(k => [k, fn(k)]));

const APP_VERSION = '20261008i';


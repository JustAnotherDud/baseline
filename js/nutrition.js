function getNutrientColor(nutrient, pct) {
  switch(nutrient) {
    case 'calories':
      if (pct >= 90 && pct <= 110) return 'var(--accent)';
      if ((pct >= 80 && pct < 90) || (pct > 110 && pct <= 120)) return 'var(--yellow)';
      return 'var(--red)';
    case 'protein':
      if (pct >= 86 && pct <= 130) return 'var(--accent)';
      if ((pct >= 63 && pct < 86) || (pct > 130 && pct <= 150)) return 'var(--yellow)';
      return 'var(--red)';
    case 'fat':
      if (pct >= 85 && pct <= 160) return 'var(--accent)';
      if ((pct >= 54 && pct < 85) || (pct > 160 && pct <= 200)) return 'var(--yellow)';
      return 'var(--red)';
    case 'carbs':
      if (pct >= 85 && pct <= 135) return 'var(--accent)';
      if ((pct >= 70 && pct < 85) || (pct > 135 && pct <= 150)) return 'var(--yellow)';
      return 'var(--red)';
    case 'fiber':
      if (pct >= 90) return 'var(--accent)';
      if (pct >= 70) return 'var(--yellow)';
      return 'var(--red)';
    default:
      return 'var(--accent)';
  }
}

// Estado de um macro mínimo (proteína/gordura) no diário. Sem tecto:
// daily_targets só traz um valor de gordura, não a banda.
// Devolve null sem floor; status 'below' ou 'met'.
function macroFloorState(key, actual, floor) {
  if (!(floor > 0)) return null;
  const val = Math.round(actual);
  const pct = Math.round(actual / floor * 100);
  if (val < floor) return { status: 'below', pct, deficit: Math.round(floor - actual) };
  return { status: 'met', pct };
}

// ── CUSTO (€) ────────────────────────────────────────────────────────────────
// O custo de cada entrada é calculado na BD (food_cost_eur + trigger diary_cost).
// Aqui só se formata, se somam custos já calculados e se montam os payloads de
// preço. A única conta feita aqui é o €/100g, para mostrar; nunca se grava.

function formatEur(n) {
  const v = parseFloat(n);
  return isNaN(v) ? '—' : (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + ' €';
}

// €/100g de um preço de embalagem; null sem preço válido.
function eurPer100g(priceEur, qtyG) {
  const p = parseFloat(priceEur), q = parseFloat(qtyG);
  return p > 0 && q > 0 ? p / q * 100 : null;
}

// " · 0,53 €/100g" para listas de alimentos; '' sem preço.
function foodPriceLabel(food) {
  const v = eurPer100g(food.price_eur, food.price_qty_g);
  return v === null ? '' : ` · ${formatEur(v)}/100g`;
}

// Custo de um conjunto de entradas: total (null se nenhuma tem custo, nunca 0)
// e cobertura = kcal das entradas com custo / kcal totais (null sem kcal).
function costSummary(entries) {
  let kcal = 0, kcalCosted = 0, total = 0, n = 0;
  entries.forEach(e => {
    const k = +(e.calories || 0);
    kcal += k;
    if (e.cost_eur != null) { total += +e.cost_eur; kcalCosted += k; n++; }
  });
  return {
    total: n ? Math.round(total * 100) / 100 : null,
    coverage: kcal > 0 ? kcalCosted / kcal : null,
  };
}

// Média diária só sobre os dias de v_cost_day que contam (cobertura >= limiar).
function costAverage(days) {
  const c = days.filter(d => d.counts_in_avg && d.cost_eur != null);
  return { n: c.length, avg: c.length ? c.reduce((s, d) => s + +d.cost_eur, 0) / c.length : null };
}

// Etiqueta do indicador de fonte do custo na lista do diário.
function costSourceTag(src) {
  return src === 'override' ? 'pontual' : src === 'manual' ? 'manual' : '';
}

const PRICE_PAIR_ERROR = 'Preço pontual: indica o preço e as gramas que cobre';

// Preço pontual no registo (food = alimento escolhido). Igual ao default do
// alimento não se envia: o trigger copia o preço actual do alimento.
// Gramas omitidas com o alimento a ter preço: a BD usa as do alimento.
function priceOverridePayload(food, priceStr, qtyStr) {
  const p = parseFloat(priceStr), q = parseFloat(qtyStr);
  const hasP = p > 0, hasQ = q > 0;
  if (!hasP && !hasQ) return {};
  if (hasP && hasQ && p === +food.price_eur && q === +food.price_qty_g) return {};
  if (hasP && !hasQ && food.price_qty_g > 0) {
    return p === +food.price_eur ? {} : { price_eur: p, cost_source: 'override' };
  }
  if (hasP && hasQ) return { price_eur: p, price_qty_g: q, cost_source: 'override' };
  return { error: PRICE_PAIR_ERROR };
}

// Preço pontual na edição de uma entrada com gramas. Só envia o que mudou face
// ao snapshot da entrada. reset: volta ao default (limpa o override; o trigger
// recopia o preço actual do alimento).
function editPricePatch(entry, priceStr, qtyStr, reset) {
  if (reset) return { cost_source: 'default', price_eur: null, price_qty_g: null };
  const p = parseFloat(priceStr), q = parseFloat(qtyStr);
  const hasP = p > 0, hasQ = q > 0;
  if (!hasP && !hasQ) return {};
  if (hasP && hasQ && p === +entry.price_eur && q === +entry.price_qty_g) return {};
  if (hasP && hasQ) return { price_eur: p, price_qty_g: q, cost_source: 'override' };
  return { error: PRICE_PAIR_ERROR };
}

// Custo manual (entrada rápida). Campo vazio limpa um custo manual existente.
function manualCostPatch(entry, costStr) {
  const raw = String(costStr ?? '').trim();
  const had = entry.cost_eur != null;
  if (raw === '' || isNaN(parseFloat(raw))) return had ? { cost_source: null, cost_eur: null } : {};
  const c = parseFloat(raw);
  if (c < 0) return { error: 'Custo inválido' };
  if (had && entry.cost_source === 'manual' && +entry.cost_eur === c) return {};
  return { cost_source: 'manual', cost_eur: c };
}

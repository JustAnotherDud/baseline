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

// Pesquisa de alimentos. "," separa alternativas (ou); dentro de cada uma, "&" junta
// condições (e) e "!" nega. Texto procura em nome e marca; `price` (ou preco/preço)
// é "tem preço". Ex.: "continente&!price" = Continente sem preço.
const PRICE_KEYS = ['price', 'preco', 'preço'];
function foodMatchesQuery(food, raw) {
  const groups = String(raw || '').split(',')
    .map(g => g.split('&').map(t => t.trim().toLowerCase()).filter(Boolean))
    .filter(g => g.length);
  if (!groups.length) return true;
  const hasPrice = eurPer100g(food.price_eur, food.price_qty_g) !== null;
  const text = `${food.name || ''} ${food.brand || ''}`.toLowerCase();
  const test = t => {
    const neg = t.startsWith('!');
    const k = neg ? t.slice(1).trim() : t;
    if (!k) return true;
    const hit = PRICE_KEYS.includes(k) ? hasPrice
      : (food.name || '').toLowerCase().includes(k) || (food.brand || '').toLowerCase().includes(k);
    return neg ? !hit : hit;
  };
  return groups.some(g => g.every(test));
}

// Métricas de custo de um alimento (ordenar/mostrar na lista); null sem preço.
//   eur_100g: €/100g · kcal_eur: kcal por € · prot_eur: g de proteína por €
function foodCostMetric(food, key) {
  const e = eurPer100g(food.price_eur, food.price_qty_g);
  if (e === null) return null;
  if (key === 'eur_100g') return e;
  if (key === 'kcal_eur') return (+food.calories_per_100g || 0) / e;
  if (key === 'prot_eur') return (+food.protein_per_100g || 0) / e;
  return null;
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

// Etiqueta do preço pontual (cost_source = override). Único sítio a editar.
const PROMO_LABEL = 'Promo';

// Etiqueta do indicador de fonte do custo na lista do diário.
function costSourceTag(src) {
  return src === 'override' ? PROMO_LABEL : src === 'manual' ? 'manual' : '';
}

// Custo de uma entrada no diário. Só o preço Promo (override) leva marca: fundo
// suave + ↓ (não depende só da cor). manual não tem marca; fica no title.
function entryCostHtml(entry) {
  const eur = formatEur(entry.cost_eur);
  if (entry.cost_source === 'override') return `<span class="price-promo" title="${PROMO_LABEL}">↓ ${eur}</span>`;
  const tag = costSourceTag(entry.cost_source);
  return tag ? `<span title="${tag}">${eur}</span>` : eur;
}

// Preço em dourado (--price-gold): entradas, refeição, total do dia, Histórico, Estatísticas.
function priceHtml(n) {
  return `<span class="price">${formatEur(n)}</span>`;
}

const PRICE_PAIR_ERROR = `Preço ${PROMO_LABEL}: indica o preço e as gramas que cobre`;

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

// ── HISTÓRICO ────────────────────────────────────────────────────────────────
// Uma linha de v_day_totals -> texto das células. Só formata: a agregação, o colapso de
// dias vazios, o delta e a cobertura vêm prontos da vista (nada de contas em JS).
//   dia sem entradas        -> kcal, macros, delta e custo "—"
//   delta_tracked = false   -> delta '' (antes da manutenção pura: célula vazia, não "—")
//   cost_tracked = false    -> custo '' (antes do tracking de custo)
//   cobertura baixa e hoje  -> etiquetas; hoje esbate kcal e delta (dia a meio, não é défice)

const HIST_DASH = '\u2014';
const HIST_MINUS = '\u2212';

// Fixo: toLocaleDateString varia com o ICU ('sexta' no Node, 'sex.' no Chrome).
const HIST_WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function histDdMm(iso) {
  const p = iso.split('-');
  return `${p[2]}/${p[1]}`;
}

function historyRowModel(r) {
  if (r.is_gap) {
    return { gap: true, key: r.date, title: `${histDdMm(r.date_from)} a ${histDdMm(r.date)} \u00B7 sem registo` };
  }
  const wd = HIST_WEEKDAYS[new Date(r.date + 'T12:00:00').getDay()];
  const m = {
    gap: false, key: r.date, title: `${wd} ${histDdMm(r.date)}`, today: !!r.is_today,
    empty: r.n_entries === 0, kcal: HIST_DASH, macros: HIST_DASH, delta: HIST_DASH, cost: HIST_DASH,
    cov: '', dimNums: false, costDim: false, tags: [],
  };
  if (m.today) { m.tags.push('em curso'); m.dimNums = true; }
  if (m.empty) return m;

  const n = v => (v == null ? HIST_DASH : String(Math.round(+v)));
  m.kcal = n(r.kcal);
  m.macros = `P ${n(r.protein)} \u00B7 C ${n(r.carbs)} \u00B7 F ${n(r.fat)} \u00B7 Fib ${n(r.fiber)}`;

  if (!r.delta_tracked) m.delta = '';
  else if (r.delta_kcal != null) {
    const d = Math.round(+r.delta_kcal);
    m.delta = (d > 0 ? '+' : d < 0 ? HIST_MINUS : '') + Math.abs(d);
  }

  if (!r.cost_tracked) m.cost = '';
  else {
    if (r.cost_eur != null) m.cost = formatEur(r.cost_eur);
    if (r.coverage != null) m.cov = Math.round(+r.coverage * 100) + '%';
    if (r.counts_in_avg === false) { m.costDim = true; m.tags.push('cobertura baixa'); }
  }
  return m;
}

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

// Aderência calórica (Estatísticas): texto do ponto de um dia ("05/10 · 94%").
function adherenceDotText(label, pct) {
  return pct !== null && pct !== undefined ? `${label} · ${Math.round(pct)}%` : `${label} · sem dados`;
}

// Tooltip centrado em centerX, encostado ao ecrã com margem; devolve o `left` em px.
function tipLeft(centerX, tipWidth, viewportWidth, margin) {
  const max = Math.max(margin, viewportWidth - tipWidth - margin);
  return Math.min(Math.max(centerX - tipWidth / 2, margin), max);
}

// Pesquisa de alimentos. "," separa alternativas (ou); dentro de cada uma, "&" junta
// condições (e) e "!" nega. Texto procura em nome e marca. Ex.: "continente&!light".

// "a&!b, c" -> [[{k:'a',neg:false},{k:'b',neg:true}],[{k:'c',neg:false}]]
function parseFoodQuery(raw) {
  return String(raw || '').split(',')
    .map(g => g.split('&').map(t => t.trim().toLowerCase()).filter(Boolean)
      .map(t => { const neg = t.startsWith('!'); return { k: (neg ? t.slice(1) : t).trim(), neg }; })
      .filter(t => t.k))
    .filter(g => g.length);
}

function foodMatchesQuery(food, raw) {
  const groups = parseFoodQuery(raw);
  if (!groups.length) return true;
  const name = (food.name || '').toLowerCase(), brand = (food.brand || '').toLowerCase();
  const test = ({ k, neg }) => {
    const hit = name.includes(k) || brand.includes(k);
    return neg ? !hit : hit;
  };
  return groups.some(g => g.every(test));
}

// Frase para a linha de ajuda: "continente e sem “light”" / "atum ou arroz". '' sem filtro.
function describeFoodQuery(raw) {
  const term = ({ k, neg }) => neg ? `sem “${k}”` : `“${k}”`;
  return parseFoodQuery(raw).map(g => g.map(term).join(' e ')).join(' ou ');
}

// ── REFEIÇÕES DINÂMICAS ──────────────────────────────────────────────────────
// Uma refeição por linha de v_meal_day: id estável; `no` é só para mostrar (calculado pela hora);
// `name` é opcional. `sort_at` = hora da refeição (started_at, ou a 1.ª entrada, ou a criação).

function mealLabel(m) {
  const n = m && typeof m.name === 'string' ? m.name.trim() : '';
  return n || `Refeição ${m ? m.no : '?'}`;
}

// 'HH:MM' local de um timestamp ISO; '' sem valor.
function fmtHM(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// 'YYYY-MM-DD' + 'HH:MM' (hora local) -> timestamp ISO para meals.started_at; null se inválido.
function hmToTimestamp(dateStr, hm) {
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!t || !d || +t[1] > 23 || +t[2] > 59) return null;
  return new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]).toISOString();
}

// Texto de uma opção de refeição nos selects: "Almoço · 12:40".
function mealOptionText(m) {
  const hm = fmtHM(m.sort_at);
  return mealLabel(m) + (hm ? ' · ' + hm : '');
}

// Refeições a mostrar no diário: as que têm entradas e, vazia, só a mais recente do dia e enquanto
// o dia não acabou (date >= hoje). Entradas de uma refeição que a vista não devolveu ganham uma
// refeição provisória: nunca se escondem entradas.
function diaryMeals(meals, entries, today) {
  const known = new Set(meals.map(m => m.id));
  const extra = [];
  entries.forEach(e => {
    if (known.has(e.meal_id)) return;
    known.add(e.meal_id);
    extra.push({ id: e.meal_id, name: null, no: '?', date: e.date, n_entries: 1, sort_at: e.logged_at, is_latest: false });
  });
  return meals.concat(extra).filter(m => m.n_entries > 0 || (m.is_latest && m.date >= today));
}

// Dia sem refeições a mostrar (hoje ou passado): uma "Refeição 1" vazia, só no cliente (não há linha
// na BD). O "+" regista normalmente e a BD cria a refeição real na 1.ª entrada. Nunca em dias futuros.
function withVirtualMeal(visible, date, today) {
  if (visible.length || date > today) return visible;
  return [{ id: null, virtual: true, name: null, no: 1, date, n_entries: 0, sort_at: null, is_latest: true }];
}

// Aberta por defeito: a mais recente com entradas; as outras abrem encolhidas.
function mealOpenDefault(visible, entries) {
  const withEntries = visible.filter(m => entries.some(e => e.meal_id === m.id));
  return withEntries.length ? withEntries[withEntries.length - 1].id : null;
}

// overrides (Map id -> encolhida) guarda os toques da sessão; nada se persiste.
function isMealCollapsed(id, openId, overrides) {
  return overrides.has(id) ? overrides.get(id) : id !== openId;
}

// ── HISTÓRICO ────────────────────────────────────────────────────────────────
// Uma linha de v_day_totals -> texto das células. Só formata: a agregação, o colapso de
// dias vazios e o delta vêm prontos da vista (nada de contas em JS).
//   dia sem entradas        -> kcal, macros e delta "—"
//   delta_tracked = false   -> delta '' (antes da manutenção pura: célula vazia, não "—")
//   hoje                    -> etiqueta; esbate kcal e delta (dia a meio, não é défice)

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
    empty: r.n_entries === 0, kcal: HIST_DASH, macros: HIST_DASH, delta: HIST_DASH,
    dimNums: false, tags: [],
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
  return m;
}

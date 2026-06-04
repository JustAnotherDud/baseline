// ── Body — composição corporal (Supabase) + forma de treino (Intervals.icu) ──
// View única em scroll que funde body_comp (peso/BF/músculo/água) com as
// métricas de forma do Intervals.icu (CTL/ATL/TSB, HRV, sono, carga semanal).
//
// Secções: 1 Forma actual · 2 Última pesagem · 3 Tendência (chart unificado)
//          4 LBM · 5 HRV · 6 Resumo da semana · 7 Wellness

let loadBodyGen = 0;

// Instâncias de chart (destruídas antes de cada rebuild).
let bodyTrendChart = null;
let bodyLbmChart   = null;
let bodyHrvChart   = null;

// Estado partilhado (período é comum às secções 3 e 4).
let bodyPeriod = 'month';                                      // week|month|3m|6m|1y|all
let bodyTrendActive = { ctl: true, atl: false, weight: true, fat: false };

// Dados.
let bodyAsc       = [];   // body_comp ascendente por data
let bodyWellness  = [];   // wellness ICU ordenado ascendente
let bodyTrendRows = [];   // merge wellness + body_comp por data: {date, ctl, atl, weight, fat}
let bodyLbmRows   = [];   // {date, lbm}

const ICU_BASE = 'https://intervals.icu/api/v1';

// Chart.js não resolve CSS vars dentro do canvas; lemos os tokens uma vez.
const chartTheme = {
  accent:  getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  orange:  getComputedStyle(document.documentElement).getPropertyValue('--orange').trim(),
  blue:    getComputedStyle(document.documentElement).getPropertyValue('--blue').trim(),
  red:     getComputedStyle(document.documentElement).getPropertyValue('--red').trim(),
  grid:    'rgba(255,255,255,0.04)',
  tick:    '#888',
  legend:  '#bbb',
  surface: getComputedStyle(document.documentElement).getPropertyValue('--surface2').trim(),
};

const chartAnim = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 400 };

// ── Helpers ──────────────────────────────────────────────────────────────────

function tNum(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }

function tFmtHM(secs) {
  const s = tNum(secs);
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function tDayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length <= 10 ? dateStr + 'T12:00:00' : dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function tWellnessDate(w) { return w.id || w.date || ''; }

function tWellnessSorted(wellness) {
  return (Array.isArray(wellness) ? wellness.slice() : [])
    .sort((a, b) => tWellnessDate(a).localeCompare(tWellnessDate(b)));
}

function tSecLabel(text) {
  return `<div class="treino-section-label" style="font-size:12px">${text}</div>`;
}

function tEmpty(msg) {
  return `<div style="font-family:var(--mono);font-size:12px;color:var(--text3);padding:4px 0">${msg}</div>`;
}

// Chip estilo .msc: label mono 9px uppercase + valor 16px/600 + linha extra.
function tChip(label, valHtml, extraHtml) {
  return `<div class="msc">
    <span style="font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em">${label}</span>
    <span style="font-size:16px;font-weight:600">${valHtml}</span>
    ${extraHtml || ''}
  </div>`;
}

// ── ICU fetch ─────────────────────────────────────────────────────────────────

function icuHeaders() { return { 'Authorization': 'Basic ' + btoa('API_KEY:' + icuKey) }; }

function icuDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function icuFetch(path) {
  const res = await fetch(ICU_BASE + path, { headers: icuHeaders() });
  if (!res.ok) throw new Error('ICU ' + res.status);
  return res.json();
}

// ── Período (estado partilhado secções 3/4) ───────────────────────────────────

function bodyFilterByPeriod(rows, period) {
  if (period === 'all') return rows;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const cutoff = new Date(today);
  if      (period === 'week')  cutoff.setDate(today.getDate() - 7);
  else if (period === 'month') cutoff.setMonth(today.getMonth() - 1);
  else if (period === '3m')    cutoff.setMonth(today.getMonth() - 3);
  else if (period === '6m')    cutoff.setMonth(today.getMonth() - 6);
  else if (period === '1y')    cutoff.setFullYear(today.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return rows.filter(r => r.date >= cutoffStr);
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadBody() {
  const gen = ++loadBodyGen;
  const c = document.getElementById('body-container');
  if (!c) return;

  [bodyTrendChart, bodyLbmChart, bodyHrvChart].forEach(ch => { if (ch) ch.destroy(); });
  bodyTrendChart = bodyLbmChart = bodyHrvChart = null;

  c.innerHTML = '<div class="loading">A carregar...</div>';

  const hasIcu = !!(icuId && icuKey);
  const today  = new Date().toISOString().split('T')[0];
  const back90 = icuDateOffset(-90);
  const back14 = icuDateOffset(-14);

  // 3 fetches em paralelo. ICU degrada de forma independente (catch → null);
  // sem credenciais ICU, resolvem null sem rede.
  const [bodyRes, wellness, activities] = await Promise.all([
    db.from('body_comp').select('*').order('date', { ascending: true }),
    hasIcu ? icuFetch(`/athlete/${icuId}/wellness?oldest=${back90}&newest=${today}`).catch(() => null)
           : Promise.resolve(null),
    hasIcu ? icuFetch(`/athlete/${icuId}/activities?oldest=${back14}&newest=${today}&fields=name,type,distance,moving_time,icu_training_load,start_date_local`).catch(() => null)
           : Promise.resolve(null),
  ]);
  if (gen !== loadBodyGen) return;

  bodyAsc      = (bodyRes && !bodyRes.error && bodyRes.data) ? bodyRes.data : [];
  bodyWellness = tWellnessSorted(wellness);
  bodyPeriod = 'month';
  bodyTrendActive = { ctl: true, atl: false, weight: true, fat: false };

  bodyTrendRows = buildBodyTrendRows(bodyWellness, bodyAsc);
  bodyLbmRows   = bodyAsc
    .filter(b => tNum(b.muscle_mass_kg) != null)
    .map(b => ({ date: b.date, lbm: tNum(b.muscle_mass_kg) }));

  c.innerHTML =
      bodyFormaHtml(bodyWellness, hasIcu)
    + bodyWeighInHtml(bodyAsc)
    + bodyTrendSectionHtml()
    + bodyLbmSectionHtml()
    + bodyHrvSectionHtml(bodyWellness, hasIcu)
    + bodyWeekSectionHtml(activities, hasIcu)
    + bodyWellnessChipsHtml(bodyWellness, hasIcu);

  // Charts construídos depois do innerHTML (canvas já no DOM).
  buildBodyTrendChart();
  buildBodyLbmChart();
  buildBodyHrvChart();
}

function buildBodyTrendRows(wSorted, asc) {
  const map = new Map();
  wSorted.forEach(w => {
    const d = tWellnessDate(w); if (!d) return;
    const row = map.get(d) || { date: d };
    row.ctl = tNum(w.ctl);
    row.atl = tNum(w.atl);
    map.set(d, row);
  });
  asc.forEach(b => {
    const d = b.date; if (!d) return;
    const row = map.get(d) || { date: d };
    row.weight = tNum(b.weight_kg);
    row.fat    = tNum(b.body_fat_pct);
    map.set(d, row);
  });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ── Secção 1 — Forma actual (CTL / ATL / TSB) ─────────────────────────────────

function bodyFormaHtml(wSorted, hasIcu) {
  const header = tSecLabel('Forma actual');
  const latest = wSorted.length ? wSorted[wSorted.length - 1] : null;

  if (!latest) {
    const msg = hasIcu ? 'Sem dados de forma.' : 'Configura o Intervals.icu nas Settings';
    return `<div style="padding:16px 20px 0">${header}${tEmpty(msg)}</div>`;
  }

  const ctl = tNum(latest.ctl);
  const atl = tNum(latest.atl);
  const tsb = (ctl != null && atl != null) ? ctl - atl : null;
  const ramp = tNum(latest.rampRate);

  const d0 = v => v != null ? Math.round(v) : '—';
  const tsbStr   = tsb != null ? (tsb > 0 ? '+' + Math.round(tsb) : Math.round(tsb)) : '—';
  const tsbColor = tsb != null && tsb < 0 ? 'var(--red)' : 'var(--accent)';

  const cell = (label, val, color) => `
    <div class="macro-cell" style="cursor:default">
      <div class="macro-cell-label">${label}</div>
      <div class="macro-cell-valrow"><span class="macro-cell-val" style="color:${color};font-size:32px">${val}</span></div>
    </div>`;

  const rampStr = ramp != null
    ? `Ramp rate ${ramp > 0 ? '+' : ''}${ramp.toFixed(1)}/sem`
    : '';

  return `<div style="padding:16px 20px 0">
    ${header}
    <div class="macro-grid" style="margin-top:0;border-top:none">
      ${cell('Fitness', d0(ctl), 'var(--accent)')}
      ${cell('Fadiga',  d0(atl), 'var(--orange)')}
      ${cell('Forma',   tsbStr,  tsbColor)}
    </div>
    ${rampStr ? `<div style="font-family:var(--mono);font-size:11px;color:var(--text3);margin-top:10px">${rampStr}</div>` : ''}
  </div>`;
}

// ── Secção 2 — Última pesagem (grid 2x2 .msc) ─────────────────────────────────

function bodyPrevWeighIn(dateStr) {
  const prior = bodyAsc.filter(r => r.date < dateStr && tNum(r.weight_kg) != null);
  return prior.length ? prior[prior.length - 1] : null;
}

function bodyWeighInHtml(asc) {
  const header = tSecLabel('Última pesagem');
  const withWeight = asc.filter(b => tNum(b.weight_kg) != null);
  const latest = withWeight.length ? withWeight[withWeight.length - 1] : null;

  if (!latest) {
    return `<div style="padding:18px 20px 0;margin-top:20px">${header}${tEmpty('Sem dados de composição corporal.')}</div>`;
  }

  const wNow = tNum(latest.weight_kg);
  const prev = bodyPrevWeighIn(latest.date);
  let deltaHtml = '';
  if (wNow != null && prev && tNum(prev.weight_kg) != null) {
    const delta = parseFloat((wNow - tNum(prev.weight_kg)).toFixed(1));
    if (delta > 0)      deltaHtml = `<span style="font-family:var(--mono);font-size:10px;color:var(--red)">↑ ${delta.toFixed(1)} kg</span>`;
    else if (delta < 0) deltaHtml = `<span style="font-family:var(--mono);font-size:10px;color:var(--accent)">↓ ${Math.abs(delta).toFixed(1)} kg</span>`;
    else                deltaHtml = `<span style="font-family:var(--mono);font-size:10px;color:var(--text3)">= 0.0 kg</span>`;
  }

  const val = (v, unit) => {
    const n = tNum(v);
    return n != null ? `${n.toFixed(1)} <span style="font-size:11px;color:var(--text3)">${unit}</span>` : '—';
  };
  const dateStr = latest.date
    ? new Date(latest.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })
    : '';

  return `<div style="padding:18px 20px 0;margin-top:20px">
    ${header}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${tChip('Peso', val(latest.weight_kg, 'kg'), deltaHtml)}
      ${tChip('Body Fat', val(latest.body_fat_pct, '%'))}
      ${tChip('Músculo (LBM)', val(latest.muscle_mass_kg, 'kg'))}
      ${tChip('Água', val(latest.water_pct, '%'))}
    </div>
    ${dateStr ? `<div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:8px">${dateStr}</div>` : ''}
  </div>`;
}

// ── Secção 3 — Tendência (chart unificado CTL/ATL/Peso/BF%) ────────────────────

function bodyPeriodChipsHtml() {
  const P = [['week', 'Semana'], ['month', 'Mês'], ['3m', '3M'], ['6m', '6M'], ['1y', '1A'], ['all', 'Total']];
  return `<div id="body-period-chips" style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch">
    ${P.map(([k, l]) => `<button class="sort-chip${bodyPeriod === k ? ' active' : ''}" data-period="${k}" onclick="setBodyPeriod('${k}')">${l}</button>`).join('')}
  </div>`;
}

function bodyTrendSectionHtml() {
  const header = tSecLabel('Tendência');
  if (!bodyTrendRows.length) {
    return `<div style="padding:18px 20px 0;margin-top:20px">${header}${tEmpty('Sem dados de tendência.')}</div>`;
  }
  const DS = [['ctl', 'CTL'], ['atl', 'ATL'], ['weight', 'Peso'], ['fat', 'BF%']];
  const chips = DS.map(([k, l]) =>
    `<button class="sort-chip${bodyTrendActive[k] ? ' active' : ''}" data-ds="${k}" onclick="toggleTrendDataset('${k}')">${l}</button>`
  ).join('');

  return `<div class="treino-chart-section" style="padding:18px 20px 0;margin-top:20px">
    ${header}
    ${bodyPeriodChipsHtml()}
    <div id="body-trend-chips" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">${chips}</div>
    <div class="treino-chart"><div style="position:relative;height:200px"><canvas id="body-trend-chart"></canvas></div></div>
  </div>`;
}

function setBodyPeriod(p) {
  bodyPeriod = p;
  document.querySelectorAll('#body-period-chips .sort-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.period === p));
  buildBodyTrendChart();
  buildBodyLbmChart();
}

function toggleTrendDataset(key) {
  bodyTrendActive[key] = !bodyTrendActive[key];
  document.querySelectorAll('#body-trend-chips .sort-chip').forEach(c =>
    c.classList.toggle('active', bodyTrendActive[c.dataset.ds]));
  buildBodyTrendChart();
}

function buildBodyTrendChart() {
  const ctx = document.getElementById('body-trend-chart');
  if (!ctx) return;
  if (bodyTrendChart) { bodyTrendChart.destroy(); bodyTrendChart = null; }

  const rows = bodyFilterByPeriod(bodyTrendRows, bodyPeriod);
  const dense = rows.length > 60;
  const ptR = dense ? 0 : 2;
  const labels = rows.map(r => tDayLabel(r.date));

  bodyTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'CTL',  data: rows.map(r => r.ctl ?? null),    borderColor: chartTheme.accent, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0,   tension: 0.3, spanGaps: true, hidden: !bodyTrendActive.ctl,    yAxisID: 'yForm' },
        { label: 'ATL',  data: rows.map(r => r.atl ?? null),    borderColor: chartTheme.orange, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0,   tension: 0.3, spanGaps: true, hidden: !bodyTrendActive.atl,    yAxisID: 'yForm' },
        { label: 'Peso', data: rows.map(r => r.weight ?? null), borderColor: chartTheme.blue,   backgroundColor: 'transparent', borderWidth: 2, pointRadius: ptR, pointBackgroundColor: chartTheme.blue, tension: 0.3, spanGaps: true, hidden: !bodyTrendActive.weight, yAxisID: 'yWeight' },
        { label: 'BF%',  data: rows.map(r => r.fat ?? null),    borderColor: chartTheme.red,    backgroundColor: 'transparent', borderWidth: 2, pointRadius: ptR, pointBackgroundColor: chartTheme.red,  tension: 0.3, spanGaps: true, hidden: !bodyTrendActive.fat,    yAxisID: 'yFat' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: chartAnim(),
      plugins: {
        legend: { display: true, position: 'top', labels: { color: chartTheme.legend, font: { size: 11 }, boxWidth: 12 } },
        tooltip: { backgroundColor: chartTheme.surface, borderColor: '#2e2e2e', borderWidth: 1, titleColor: chartTheme.legend, bodyColor: '#f0f0f0' },
      },
      scales: {
        x: { grid: { color: chartTheme.grid }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, border: { color: '#2e2e2e' } },
        yForm:   { position: 'left',  display: bodyTrendActive.ctl || bodyTrendActive.atl, suggestedMin: 0,  suggestedMax: 100, grid: { color: chartTheme.grid }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 } }, border: { color: '#2e2e2e' } },
        yWeight: { position: 'right', display: bodyTrendActive.weight,                     suggestedMin: 60, suggestedMax: 80,  grid: { drawOnChartArea: false }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 } }, border: { color: '#2e2e2e' } },
        yFat:    { position: 'right', display: bodyTrendActive.fat,                        suggestedMin: 10, suggestedMax: 25,  grid: { drawOnChartArea: false }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 } }, border: { color: '#2e2e2e' } },
      },
    },
  });
}

// ── Secção 4 — LBM (Lean Body Mass) ───────────────────────────────────────────

function bodyLbmSectionHtml() {
  const header = tSecLabel('LBM · Lean Body Mass');
  if (!bodyLbmRows.length) {
    return `<div style="padding:18px 20px 0;margin-top:20px">${header}${tEmpty('Sem dados de massa muscular.')}</div>`;
  }
  return `<div class="treino-chart-section" style="padding:18px 20px 0;margin-top:20px">
    ${header}
    <div class="treino-chart"><div style="position:relative;height:120px"><canvas id="body-lbm-chart"></canvas></div></div>
  </div>`;
}

function buildBodyLbmChart() {
  const ctx = document.getElementById('body-lbm-chart');
  if (!ctx) return;
  if (bodyLbmChart) { bodyLbmChart.destroy(); bodyLbmChart = null; }

  const rows = bodyFilterByPeriod(bodyLbmRows, bodyPeriod);
  const dense = rows.length > 60;

  bodyLbmChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rows.map(r => tDayLabel(r.date)),
      datasets: [{
        label: 'LBM (kg)',
        data: rows.map(r => r.lbm),
        borderColor: chartTheme.blue,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: dense ? 0 : 2,
        pointBackgroundColor: chartTheme.blue,
        tension: 0.3,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: chartAnim(),
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: chartTheme.surface, borderColor: '#2e2e2e', borderWidth: 1, titleColor: chartTheme.legend, bodyColor: '#f0f0f0' },
      },
      scales: {
        x: { grid: { color: chartTheme.grid }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, border: { color: '#2e2e2e' } },
        y: { grid: { color: chartTheme.grid }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 } }, border: { color: '#2e2e2e' } },
      },
    },
  });
}

// ── Secção 5 — HRV (30 dias) ──────────────────────────────────────────────────

function bodyHrvSectionHtml(wSorted, hasIcu) {
  const header = tSecLabel('HRV · 30 dias');
  const last30 = wSorted.slice(-30).filter(w => tNum(w.hrv) != null);
  if (last30.length < 3) {
    const msg = hasIcu ? 'Sem dados HRV suficientes' : 'Configura o Intervals.icu nas Settings';
    return `<div style="padding:18px 20px 0;margin-top:20px">${header}${tEmpty(msg)}</div>`;
  }
  return `<div class="treino-chart-section" style="padding:18px 20px 0;margin-top:20px">
    ${header}
    <div class="treino-chart"><div style="position:relative;height:120px"><canvas id="body-hrv-chart"></canvas></div></div>
  </div>`;
}

function buildBodyHrvChart() {
  const ctx = document.getElementById('body-hrv-chart');
  if (!ctx) return;
  if (bodyHrvChart) { bodyHrvChart.destroy(); bodyHrvChart = null; }

  const last30 = bodyWellness.slice(-30).filter(w => tNum(w.hrv) != null);
  bodyHrvChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last30.map(w => tDayLabel(tWellnessDate(w))),
      datasets: [{
        label: 'HRV',
        data: last30.map(w => tNum(w.hrv)),
        borderColor: chartTheme.blue,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 2,
        pointBackgroundColor: chartTheme.blue,
        tension: 0.3,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: chartAnim(),
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: chartTheme.surface, borderColor: '#2e2e2e', borderWidth: 1, titleColor: chartTheme.legend, bodyColor: '#f0f0f0' },
      },
      scales: {
        x: { grid: { color: chartTheme.grid }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, border: { color: '#2e2e2e' } },
        y: { grid: { color: chartTheme.grid }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 } }, border: { color: '#2e2e2e' } },
      },
    },
  });
}

// ── Secção 6 — Resumo da semana ───────────────────────────────────────────────

function tMondayOf(date) {
  const x = new Date(date);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - day);
  return x;
}

function tWeekTotals(activities, start, end) {
  const tot = { meters: 0, secs: 0, load: 0 };
  activities.forEach(a => {
    const ds = a.start_date_local || a.start_date;
    if (!ds) return;
    const d = new Date(ds);
    if (d >= start && d < end) {
      tot.meters += tNum(a.distance) || 0;
      tot.secs   += tNum(a.moving_time) || 0;
      tot.load   += tNum(a.icu_training_load) || 0;
    }
  });
  return tot;
}

function tDeltaPct(cur, prev) {
  if (prev == null || prev === 0) return null;
  return (cur - prev) / prev * 100;
}

function tDeltaHtml(cur, prev) {
  const pct = tDeltaPct(cur, prev);
  if (pct == null) {
    return `<span style="font-family:var(--mono);font-size:10px;color:var(--text3)">—</span>`;
  }
  const rounded = Math.round(pct);
  if (rounded === 0) {
    return `<span style="font-family:var(--mono);font-size:10px;color:var(--text3)">= 0%</span>`;
  }
  const up = rounded > 0;
  const arrow = up ? '↑' : '↓';
  const col = up ? 'var(--accent)' : 'var(--red)';
  return `<span style="font-family:var(--mono);font-size:10px;color:${col}">${arrow} ${Math.abs(rounded)}%</span>`;
}

function bodyWeekSectionHtml(activities, hasIcu) {
  const header = tSecLabel('Resumo da semana');

  if (!Array.isArray(activities)) {
    const msg = hasIcu ? 'Sem dados de actividades.' : 'Configura o Intervals.icu nas Settings';
    return `<div style="padding:18px 20px 0;margin-top:20px">${header}${tEmpty(msg)}</div>`;
  }

  const now = new Date();
  const thisMon = tMondayOf(now);
  const lastMon = new Date(thisMon); lastMon.setDate(lastMon.getDate() - 7);
  const nextMon = new Date(thisMon); nextMon.setDate(nextMon.getDate() + 7);

  const cur  = tWeekTotals(activities, thisMon, nextMon);
  const prev = tWeekTotals(activities, lastMon, thisMon);

  const km = tChip(
    'Distância',
    `${(cur.meters / 1000).toFixed(1)} <span style="font-size:11px;color:var(--text3)">km</span>`,
    tDeltaHtml(cur.meters, prev.meters),
  );
  const tempo = tChip('Tempo', tFmtHM(cur.secs), tDeltaHtml(cur.secs, prev.secs));
  const carga = tChip('Carga', `${Math.round(cur.load)}`, tDeltaHtml(cur.load, prev.load));

  return `<div style="padding:18px 20px 0;margin-top:20px">
    ${header}
    <div class="macro-secondary">${km}${tempo}${carga}</div>
  </div>`;
}

// ── Secção 7 — Wellness (HRV + Sono) ──────────────────────────────────────────

function bodyWellnessChipsHtml(wSorted, hasIcu) {
  const header = tSecLabel('Wellness · 7 dias');
  const last7 = wSorted.slice(-7);

  if (!last7.length) {
    const msg = hasIcu ? 'Sem dados de wellness.' : 'Configura o Intervals.icu nas Settings';
    return `<div style="padding:18px 20px 24px">${header}${tEmpty(msg)}</div>`;
  }

  // HRV — último valor + seta vs média 7d.
  const hrvVals = last7.map(w => tNum(w.hrv)).filter(v => v != null);
  let hrvChipVal = '—';
  if (hrvVals.length) {
    const last = hrvVals[hrvVals.length - 1];
    const avg = hrvVals.reduce((s, v) => s + v, 0) / hrvVals.length;
    let arrow = '', col = 'var(--text)';
    if (last > avg + 0.5)      { arrow = ' ↑'; col = 'var(--accent)'; }
    else if (last < avg - 0.5) { arrow = ' ↓'; col = 'var(--red)'; }
    hrvChipVal = `<span style="color:${col}">${Math.round(last)}${arrow}</span>`;
  }

  // Sono — média 7d em horas (sleepSecs / 3600).
  const sleepHours = last7.map(w => (w.sleepSecs != null ? tNum(w.sleepSecs) / 3600 : null)).filter(v => v != null);
  const sleepChipVal = sleepHours.length
    ? (sleepHours.reduce((s, v) => s + v, 0) / sleepHours.length).toFixed(1) + 'h'
    : '—';

  return `<div style="padding:18px 20px 24px">
    ${header}
    <div class="macro-secondary">
      ${tChip('HRV', hrvChipVal)}
      ${tChip('Sono', sleepChipVal)}
    </div>
  </div>`;
}

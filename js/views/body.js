// ── Body — composição corporal (Supabase) + forma de treino (Intervals.icu) ──
// View única em scroll que funde body_comp (peso/BF/músculo/água) com as
// métricas de forma do Intervals.icu (CTL/ATL/TSB, HRV, sono, carga semanal).
//
// Secções: 1 Forma actual · 2 Última pesagem · 3 Chart Forma · 4 Chart Composição
//          5 HRV · 30 dias · 6 Últimos 7 dias

let loadBodyGen = 0;

// Instâncias de chart (destruídas antes de cada rebuild).
let bodyFormChart = null;
let bodyCompChart = null;
let bodyHrvChart  = null;

// Estado partilhado (o período é comum aos dois charts de histórico).
let bodyPeriod = 'month';                                      // week|month|3m|6m|1y|all
let bodyFormActive = { ctl: true, atl: true };                // Chart 1 — Forma
let bodyCompActive = { weight: true, fat: true, lbm: true };  // Chart 2 — Composição

// Dados.
let bodyAsc       = [];   // body_comp ascendente por data
let bodyWellness  = [];   // wellness ICU ordenado ascendente
let bodyTrendRows = [];   // merge wellness + body_comp por data: {date, ctl, atl, weight, fat, lbm}

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

  [bodyFormChart, bodyCompChart, bodyHrvChart].forEach(ch => { if (ch) ch.destroy(); });
  bodyFormChart = bodyCompChart = bodyHrvChart = null;

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
  bodyFormActive = { ctl: true, atl: true };
  bodyCompActive = { weight: true, fat: true, lbm: true };

  bodyTrendRows = buildBodyTrendRows(bodyWellness, bodyAsc);

  c.innerHTML =
      bodyFormaHtml(bodyWellness, hasIcu)
    + bodyWeighInHtml(bodyAsc)
    + bodyFormChartSectionHtml(hasIcu)
    + bodyCompChartSectionHtml()
    + bodyHrvSectionHtml(bodyWellness, hasIcu)
    + bodyWeekSectionHtml(activities, hasIcu);

  // Charts construídos depois do innerHTML (canvas já no DOM).
  buildBodyFormChart();
  buildBodyCompChart();
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
    row.lbm    = tNum(b.muscle_mass_kg);
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

// ── Período (chips partilhados pelos dois charts de histórico) ─────────────────

function bodyPeriodChipsHtml() {
  const P = [['week', 'Semana'], ['month', 'Mês'], ['3m', '3M'], ['6m', '6M'], ['1y', '1A'], ['all', 'Total']];
  return `<div id="body-period-chips" style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch">
    ${P.map(([k, l]) => `<button class="sort-chip${bodyPeriod === k ? ' active' : ''}" data-period="${k}" onclick="setBodyPeriod('${k}')">${l}</button>`).join('')}
  </div>`;
}

function setBodyPeriod(p) {
  bodyPeriod = p;
  document.querySelectorAll('#body-period-chips .sort-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.period === p));
  // Destruir e recriar ambos os charts de histórico no novo período.
  buildBodyFormChart();
  buildBodyCompChart();
}

// ── Chart 1 — Forma · 60 dias (CTL / ATL, eixo único) ─────────────────────────

function bodyFormChartSectionHtml(hasIcu) {
  const header = tSecLabel('Forma · 60 dias');
  const hasForm = bodyTrendRows.some(r => r.ctl != null || r.atl != null);

  // Os chips de período vivem aqui mas controlam os dois charts.
  let body;
  if (hasForm) {
    const DS = [['ctl', 'CTL'], ['atl', 'ATL']];
    const chips = DS.map(([k, l]) =>
      `<button class="sort-chip${bodyFormActive[k] ? ' active' : ''}" data-ds="${k}" onclick="toggleFormDataset('${k}')">${l}</button>`
    ).join('');
    body = `<div id="body-form-chips" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">${chips}</div>
      <div class="treino-chart"><div style="position:relative;height:160px"><canvas id="body-form-chart"></canvas></div></div>`;
  } else {
    body = tEmpty(hasIcu ? 'Sem dados de forma.' : 'Configura o Intervals.icu nas Settings');
  }

  return `<div class="treino-chart-section" style="padding:18px 20px 0;margin-top:20px">
    ${header}
    ${bodyPeriodChipsHtml()}
    ${body}
  </div>`;
}

function toggleFormDataset(key) {
  bodyFormActive[key] = !bodyFormActive[key];
  document.querySelectorAll('#body-form-chips .sort-chip').forEach(c =>
    c.classList.toggle('active', bodyFormActive[c.dataset.ds]));
  buildBodyFormChart();
}

function buildBodyFormChart() {
  const ctx = document.getElementById('body-form-chart');
  if (!ctx) return;
  if (bodyFormChart) { bodyFormChart.destroy(); bodyFormChart = null; }

  const rows = bodyFilterByPeriod(bodyTrendRows, bodyPeriod);
  const labels = rows.map(r => tDayLabel(r.date));

  bodyFormChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'CTL', data: rows.map(r => r.ctl ?? null), borderColor: chartTheme.accent, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3, spanGaps: true, hidden: !bodyFormActive.ctl, yAxisID: 'y' },
        { label: 'ATL', data: rows.map(r => r.atl ?? null), borderColor: chartTheme.orange, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3, spanGaps: true, hidden: !bodyFormActive.atl, yAxisID: 'y' },
      ],
    },
    options: {
      devicePixelRatio: window.devicePixelRatio * (window.outerWidth / window.innerWidth || 1.5),
      responsive: true,
      maintainAspectRatio: false,
      animation: chartAnim(),
      plugins: {
        legend: { display: true, position: 'top', labels: { color: chartTheme.legend, font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          backgroundColor: chartTheme.surface, borderColor: '#2e2e2e', borderWidth: 1, titleColor: chartTheme.legend, bodyColor: '#f0f0f0',
          callbacks: {
            label(ctx) {
              const v = ctx.parsed.y;
              if (v == null) return null;
              const labels = { CTL: 'Fitness (CTL)', ATL: 'Fadiga (ATL)' };
              const name = labels[ctx.dataset.label] || ctx.dataset.label;
              return `${name}: ${v.toFixed(1)}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { color: chartTheme.grid }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, border: { color: '#2e2e2e' } },
        y: { position: 'left', suggestedMin: 0, suggestedMax: 60, grid: { color: chartTheme.grid }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 } }, border: { color: '#2e2e2e' } },
      },
    },
  });
}

// ── Chart 2 — Composição · Histórico (Peso / BF% / LBM, dois eixos) ───────────

function bodyCompChartSectionHtml() {
  const header = tSecLabel('Composição · Histórico');
  const hasComp = bodyTrendRows.some(r => r.weight != null || r.fat != null || r.lbm != null);
  if (!hasComp) {
    return `<div style="padding:18px 20px 0;margin-top:20px">${header}${tEmpty('Sem dados de composição.')}</div>`;
  }
  const DS = [['weight', 'Peso'], ['fat', 'BF%'], ['lbm', 'LBM']];
  const chips = DS.map(([k, l]) =>
    `<button class="sort-chip${bodyCompActive[k] ? ' active' : ''}" data-ds="${k}" onclick="toggleCompDataset('${k}')">${l}</button>`
  ).join('');

  return `<div class="treino-chart-section" style="padding:18px 20px 0;margin-top:20px">
    ${header}
    <div id="body-comp-chips" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">${chips}</div>
    <div class="treino-chart"><div style="position:relative;height:200px"><canvas id="body-comp-chart"></canvas></div></div>
  </div>`;
}

function toggleCompDataset(key) {
  bodyCompActive[key] = !bodyCompActive[key];
  document.querySelectorAll('#body-comp-chips .sort-chip').forEach(c =>
    c.classList.toggle('active', bodyCompActive[c.dataset.ds]));
  buildBodyCompChart();
}

function buildBodyCompChart() {
  const ctx = document.getElementById('body-comp-chart');
  if (!ctx) return;
  if (bodyCompChart) { bodyCompChart.destroy(); bodyCompChart = null; }

  const rows = bodyFilterByPeriod(bodyTrendRows, bodyPeriod);
  const dense = rows.length > 60;
  const ptR = dense ? 0 : 2;
  const labels = rows.map(r => tDayLabel(r.date));

  const weightData = rows.map(r => r.weight ?? null);
  const fatData    = rows.map(r => r.fat ?? null);
  const lbmData    = rows.map(r => r.lbm ?? null);

  // Escala dinâmica com padding — cada métrica no seu próprio eixo (Peso/LBM/BF%)
  // para que nenhuma comprima as outras. yWeight/yLBM partilham o lado esquerdo:
  // mostra a escala do que estiver activo (Peso tem prioridade quando ambos).
  const pesoValues = weightData.filter(v => v != null);
  const pMin = Math.min(...pesoValues), pMax = Math.max(...pesoValues);
  const pPad = Math.max((pMax - pMin) * 0.3, 1);

  const lbmValues = lbmData.filter(v => v != null);
  const lMin = Math.min(...lbmValues), lMax = Math.max(...lbmValues);
  const lPad = Math.max((lMax - lMin) * 0.3, 1);

  const fatValues = fatData.filter(v => v != null);
  const fMin = Math.min(...fatValues), fMax = Math.max(...fatValues);
  const fPad = Math.max((fMax - fMin) * 0.3, 0.5);

  bodyCompChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Peso', data: weightData, borderColor: chartTheme.blue,   backgroundColor: 'transparent', borderWidth: 2, pointRadius: ptR, pointBackgroundColor: chartTheme.blue,   tension: 0.3, spanGaps: true, hidden: !bodyCompActive.weight, yAxisID: 'yWeight' },
        { label: 'BF%',  data: fatData,    borderColor: chartTheme.red,    backgroundColor: 'transparent', borderWidth: 2, pointRadius: ptR, pointBackgroundColor: chartTheme.red,    tension: 0.3, spanGaps: true, hidden: !bodyCompActive.fat,    yAxisID: 'yFat' },
        { label: 'LBM', data: lbmData,     borderColor: chartTheme.orange, backgroundColor: 'transparent', borderWidth: 2, pointRadius: ptR, pointBackgroundColor: chartTheme.orange, tension: 0.3, spanGaps: true, hidden: !bodyCompActive.lbm,    yAxisID: 'yLBM' },
      ],
    },
    options: {
      devicePixelRatio: window.devicePixelRatio * (window.outerWidth / window.innerWidth || 1.5),
      responsive: true,
      maintainAspectRatio: false,
      animation: chartAnim(),
      plugins: {
        legend: { display: true, position: 'top', labels: { color: chartTheme.legend, font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          backgroundColor: chartTheme.surface, borderColor: '#2e2e2e', borderWidth: 1, titleColor: chartTheme.legend, bodyColor: '#f0f0f0',
          callbacks: {
            label(ctx) {
              const v = ctx.parsed.y;
              if (v == null) return null;
              const fmt = { 'Peso': `Peso: ${v.toFixed(1)} kg`, 'BF%': `BF%: ${v.toFixed(1)}%`, 'LBM': `LBM: ${v.toFixed(1)} kg` };
              return fmt[ctx.dataset.label] || `${ctx.dataset.label}: ${v.toFixed(1)}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { color: chartTheme.grid }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, border: { color: '#2e2e2e' } },
        yWeight: {
          type: 'linear', position: 'left',
          display: bodyCompActive.weight,
          min: pesoValues.length ? Math.floor(pMin - pPad) : undefined,
          max: pesoValues.length ? Math.ceil(pMax + pPad) : undefined,
          grid: { color: chartTheme.grid }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 } }, border: { color: '#2e2e2e' },
        },
        yLBM: {
          type: 'linear', position: 'left',
          display: bodyCompActive.lbm && !bodyCompActive.weight,
          min: lbmValues.length ? Math.floor(lMin - lPad) : undefined,
          max: lbmValues.length ? Math.ceil(lMax + lPad) : undefined,
          grid: { drawOnChartArea: false }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 } }, border: { color: '#2e2e2e' },
        },
        yFat: {
          type: 'linear', position: 'right',
          display: bodyCompActive.fat,
          min: fatValues.length ? parseFloat((fMin - fPad).toFixed(1)) : undefined,
          max: fatValues.length ? parseFloat((fMax + fPad).toFixed(1)) : undefined,
          grid: { drawOnChartArea: false }, ticks: { color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 } }, border: { color: '#2e2e2e' },
        },
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
  const header = tSecLabel('Últimos 7 dias');

  if (!Array.isArray(activities)) {
    const msg = hasIcu ? 'Sem dados de actividades.' : 'Configura o Intervals.icu nas Settings';
    return `<div style="padding:18px 20px 0;margin-top:20px">${header}${tEmpty(msg)}</div>`;
  }

  // Rolling 7 dias, hoje excluído. Janelas com fim exclusivo (tWeekTotals usa d < end):
  // actual = [hoje-7, hoje) → ontem-6 a ontem · anterior = [hoje-14, hoje-7) → ontem-13 a ontem-7
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const periodStart = new Date(today); periodStart.setDate(today.getDate() - 7);
  const prevStart   = new Date(today); prevStart.setDate(today.getDate() - 14);

  const cur  = tWeekTotals(activities, periodStart, today);
  const prev = tWeekTotals(activities, prevStart, periodStart);

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

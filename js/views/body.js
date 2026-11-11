// View Forma: pesagens e composição corporal (body_comp, Supabase).
// Secções: Última pesagem, Chart Composição.

let loadBodyGen = 0;

// Instância do chart (destruída antes de cada rebuild).
let bodyCompChart = null;

// Estado do chart (período e séries visíveis).
let bodyPeriod = 'month';                                      // week|month|3m|6m|1y|all
let bodyCompActive = { weight: true, fat: true, lbm: true };

// Dados.
let bodyAsc       = [];   // body_comp ascendente por data
let bodyTrendRows = [];   // body_comp por data: {date, weight, fat, lbm}

// Chart.js não resolve CSS vars dentro do canvas; lemos os tokens uma vez.
const chartTheme = {
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

const chartTicks = () => ({ color: chartTheme.tick, font: { family: 'IBM Plex Mono', size: 10 } });

// Opções do chart de linha. label(name, v) formata o tooltip.
function baseChartOptions(label, yScales) {
  return {
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
            return v == null ? null : label(ctx.dataset.label, v);
          },
        },
      },
    },
    scales: {
      x: { grid: { color: chartTheme.grid }, ticks: { ...chartTicks(), maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, border: { color: '#2e2e2e' } },
      ...yScales,
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function tNum(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }

function tDayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length <= 10 ? dateStr + 'T12:00:00' : dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
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

// ── Período ──────────────────────────────────────────────────────────────────

function bodyFilterByPeriod(rows, period, today = new Date()) {
  if (period === 'all') return rows;
  const base = new Date(today); base.setHours(12, 0, 0, 0);
  const cutoff = new Date(base);
  if      (period === 'week')  cutoff.setDate(base.getDate() - 7);
  else if (period === 'month') cutoff.setMonth(base.getMonth() - 1);
  else if (period === '3m')    cutoff.setMonth(base.getMonth() - 3);
  else if (period === '6m')    cutoff.setMonth(base.getMonth() - 6);
  else if (period === '1y')    cutoff.setFullYear(base.getFullYear() - 1);
  const cutoffStr = localDate(cutoff);
  return rows.filter(r => r.date >= cutoffStr);
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadBody() {
  if (!db) return;   // sem sessão (como os outros loaders): nada a carregar
  const gen = ++loadBodyGen;
  const c = document.getElementById('body-container');
  if (!c) return;

  if (bodyCompChart) { bodyCompChart.destroy(); bodyCompChart = null; }

  c.innerHTML = '<div class="loading">A carregar...</div>';

  const bodyRes = await db.from('body_comp').select('*').order('date', { ascending: true });
  if (gen !== loadBodyGen) return;

  bodyAsc = (bodyRes && !bodyRes.error && bodyRes.data) ? bodyRes.data : [];
  // Período e séries não se repõem: o auto-refresh apagava a escolha.

  bodyTrendRows = buildBodyTrendRows(bodyAsc);

  c.innerHTML = bodyWeighInHtml(bodyAsc) + bodyCompChartSectionHtml();

  // Chart construído depois do innerHTML (canvas já no DOM).
  buildBodyCompChart();
}

function buildBodyTrendRows(asc) {
  return asc
    .filter(b => b.date)
    .map(b => ({
      date:   b.date,
      weight: tNum(b.weight_kg),
      fat:    tNum(b.body_fat_pct),
      lbm:    tNum(b.muscle_mass_kg),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Secção 1: Última pesagem (grid .msc) ─────────────────────────────────

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
    // Delta de peso neutro: não há lado bom.
    const deltaColor = 'var(--text3)';
    if (delta > 0)      deltaHtml = `<span style="font-family:var(--mono);font-size:10px;color:${deltaColor}">↑ ${numPt(delta, 1)} kg</span>`;
    else if (delta < 0) deltaHtml = `<span style="font-family:var(--mono);font-size:10px;color:${deltaColor}">↓ ${numPt(Math.abs(delta), 1)} kg</span>`;
    else                deltaHtml = `<span style="font-family:var(--mono);font-size:10px;color:${deltaColor}">= 0.0 kg</span>`;
  }

  const val = (v, unit) => {
    const n = tNum(v);
    return n != null ? `${numPt(n, 1)} <span style="font-size:11px;color:var(--text3)">${unit}</span>` : '\u2014';
  };

  // Massa gorda (kg) = peso × %gordura / 100. Sem delta, só valor.
  const bf = tNum(latest.body_fat_pct);
  const mgVal = (wNow != null && bf != null)
    ? `${numPt(wNow * bf / 100, 1)} <span style="font-size:11px;color:var(--text3)">kg</span>`
    : '\u2014';

  const dateStr = latest.date
    ? new Date(latest.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })
    : '';

  return `<div style="padding:18px 20px 0;margin-top:20px">
    ${header}
    <div class="stat-row-4">
      ${tChip('Peso', val(latest.weight_kg, 'kg'), deltaHtml)}
      ${tChip('Body Fat', val(latest.body_fat_pct, '%'))}
      ${tChip('LBM', val(latest.muscle_mass_kg, 'kg'))}
      ${tChip('Massa Gorda', mgVal)}
    </div>
    ${dateStr ? `<div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:8px">${dateStr}</div>` : ''}
  </div>`;
}

// ── Chips de período ──────────────────────────────────────────────────────────

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
  buildBodyCompChart();
}

// ── Chart Composição, histórico (Peso, BF%, LBM, três eixos) ───────────────

function bodyCompChartSectionHtml() {
  const header = tSecLabel('Composição');
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
    ${bodyPeriodChipsHtml()}
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

  // Escala dinâmica com padding : cada métrica no seu próprio eixo (Peso/LBM/BF%)
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
    options: baseChartOptions(
      (name, v) => ({ 'Peso': `Peso: ${numPt(v, 1)} kg`, 'BF%': `BF%: ${numPt(v, 1)}%`, 'LBM': `LBM: ${numPt(v, 1)} kg` }[name] || `${name}: ${numPt(v, 1)}`),
      {
        yWeight: {
          type: 'linear', position: 'left',
          display: bodyCompActive.weight,
          min: pesoValues.length ? Math.floor(pMin - pPad) : undefined,
          max: pesoValues.length ? Math.ceil(pMax + pPad) : undefined,
          grid: { color: chartTheme.grid }, ticks: chartTicks(), border: { color: '#2e2e2e' },
        },
        yLBM: {
          type: 'linear', position: 'left',
          display: bodyCompActive.lbm && !bodyCompActive.weight,
          min: lbmValues.length ? Math.floor(lMin - lPad) : undefined,
          max: lbmValues.length ? Math.ceil(lMax + lPad) : undefined,
          grid: { drawOnChartArea: false }, ticks: chartTicks(), border: { color: '#2e2e2e' },
        },
        yFat: {
          type: 'linear', position: 'right',
          display: bodyCompActive.fat,
          min: fatValues.length ? parseFloat((fMin - fPad).toFixed(1)) : undefined,
          max: fatValues.length ? parseFloat((fMax + fPad).toFixed(1)) : undefined,
          grid: { drawOnChartArea: false }, ticks: chartTicks(), border: { color: '#2e2e2e' },
        },
      },
    ),
  });
}

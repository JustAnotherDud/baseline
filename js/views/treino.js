// ── Treino — integração Intervals.icu ────────────────────────────────────────
// Auth: HTTP Basic com utilizador "API_KEY" e a key como password (btoa("API_KEY:" + key)).
// Base URL: https://intervals.icu/api/v1
//
// A view mostra métricas e charts (sem lista de actividades individuais):
//   1. Forma actual (CTL / ATL / TSB) — último registo de wellness
//   2. Chart CTL/ATL — 60 dias
//   3. Chart HRV — 30 dias
//   4. Resumo da semana (vs semana anterior) + chips de wellness

let loadTreinoGen = 0;
let treinoCtlChart = null;
let treinoHrvChart = null;

const ICU_BASE = 'https://intervals.icu/api/v1';

// Cores dos charts (Chart.js não resolve CSS vars dentro do canvas).
const TREINO_GRID = 'rgba(255,255,255,0.04)';
const TREINO_TICK = '#666';
const TREINO_LEGEND = '#bbb'; // = var(--text2)

function icuHeaders() {
  return { 'Authorization': 'Basic ' + btoa('API_KEY:' + icuKey) };
}

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function tNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function tFmtHM(secs) {
  const s = tNum(secs);
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

// Etiqueta dd/mm a partir de "YYYY-MM-DD" ou ISO.
function tDayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length <= 10 ? dateStr + 'T12:00:00' : dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Data (chave) de um registo de wellness — o id é "YYYY-MM-DD".
function tWellnessDate(w) {
  return w.id || w.date || '';
}

function tWellnessSorted(wellness) {
  return (Array.isArray(wellness) ? wellness.slice() : [])
    .sort((a, b) => tWellnessDate(a).localeCompare(tWellnessDate(b)));
}

// Label de secção (12px).
function tSecLabel(text) {
  return `<div class="treino-section-label" style="font-size:12px">${text}</div>`;
}

function tEmpty(msg) {
  return `<div style="font-family:var(--mono);font-size:12px;color:var(--text3);padding:4px 0">${msg}</div>`;
}

// ── Load ─────────────────────────────────────────────────────────────────────

async function loadTreino() {
  const gen = ++loadTreinoGen;
  const c = document.getElementById('treino-container');
  if (!c) return;

  // Destruir charts antigos antes de re-render.
  if (treinoCtlChart) { treinoCtlChart.destroy(); treinoCtlChart = null; }
  if (treinoHrvChart) { treinoHrvChart.destroy(); treinoHrvChart = null; }

  if (!icuId || !icuKey) {
    c.innerHTML = `<div class="empty">
      <div class="empty-icon">⚡</div>
      <div class="empty-text">Configura o Intervals.icu nas Settings</div>
    </div>`;
    return;
  }

  c.innerHTML = '<div class="loading">A carregar...</div>';

  const today  = new Date().toISOString().split('T')[0];
  const back60 = icuDateOffset(-60);
  const back14 = icuDateOffset(-14);

  // Fetches em paralelo. Cada um falha de forma independente (catch → null)
  // para que um erro numa secção não afecte as outras.
  const [wellness, activities] = await Promise.all([
    icuFetch(`/athlete/${icuId}/wellness?oldest=${back60}&newest=${today}`).catch(() => null),
    icuFetch(`/athlete/${icuId}/activities?oldest=${back14}&newest=${today}&fields=name,type,distance,moving_time,icu_training_load,start_date_local`).catch(() => null),
  ]);
  if (gen !== loadTreinoGen) return;

  if (wellness === null && activities === null) {
    c.innerHTML = `<div class="empty">
      <div class="empty-icon">⚠️</div>
      <div class="empty-text">Erro a ligar ao Intervals.icu.<br>Verifica o ID e a API key nas Settings.</div>
    </div>`;
    return;
  }

  const wSorted = tWellnessSorted(wellness);

  c.innerHTML =
      treinoFormaHtml(wSorted)
    + treinoCtlSectionHtml(wSorted)
    + treinoHrvSectionHtml(wSorted)
    + treinoWeekSectionHtml(activities)
    + treinoWellnessChipsHtml(wSorted);

  // Charts são construídos depois do innerHTML (canvas já no DOM).
  buildTreinoCtlChart(wSorted);
  buildTreinoHrvChart(wSorted);
}

// ── Secção 1 — Forma actual ──────────────────────────────────────────────────

function treinoFormaHtml(wSorted) {
  const header = tSecLabel('Forma actual');
  const latest = wSorted.length ? wSorted[wSorted.length - 1] : null;

  if (!latest) {
    return `<div style="padding:16px 20px 0">${header}${tEmpty('Sem dados de forma.')}</div>`;
  }

  const ctl = tNum(latest.ctl);
  const atl = tNum(latest.atl);
  let tsb = null;
  if (ctl != null && atl != null) tsb = ctl - atl;
  const ramp = tNum(latest.rampRate);

  const d0 = v => v != null ? Math.round(v) : '—';
  const tsbStr = tsb != null ? (tsb > 0 ? '+' + Math.round(tsb) : Math.round(tsb)) : '—';
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
    ${rampStr ? `<div style="font-family:var(--mono);font-size:13px;color:var(--text3);margin-top:10px">${rampStr}</div>` : ''}
  </div>`;
}

// ── Secção 2 — Chart CTL / ATL · 60 dias ─────────────────────────────────────

function treinoCtlSectionHtml(wSorted) {
  const header = tSecLabel('Fitness · 60 dias');
  const hasData = wSorted.some(w => tNum(w.ctl) != null || tNum(w.atl) != null);
  if (!hasData) {
    return `<div style="padding:18px 20px 0;margin-top:20px">${header}${tEmpty('Sem dados de fitness.')}</div>`;
  }
  return `<div class="treino-chart-section" style="padding:18px 20px 0;margin-top:20px">
    ${header}
    <div class="treino-chart"><div style="position:relative;height:160px"><canvas id="treino-ctl-chart"></canvas></div></div>
  </div>`;
}

function buildTreinoCtlChart(wSorted) {
  const ctx = document.getElementById('treino-ctl-chart');
  if (!ctx) return;

  const labels = wSorted.map(w => tDayLabel(tWellnessDate(w)));
  const ctlData = wSorted.map(w => tNum(w.ctl));
  const atlData = wSorted.map(w => tNum(w.atl));

  treinoCtlChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Fitness (CTL)',
          data: ctlData,
          borderColor: '#4ade80',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: 'Fadiga (ATL)',
          data: atlData,
          borderColor: '#fb923c',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: TREINO_LEGEND, font: { size: 12 }, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#2e2e2e',
          borderWidth: 1,
          titleColor: '#bbb',
          bodyColor: '#f0f0f0',
        },
      },
      scales: {
        x: {
          grid: { color: TREINO_GRID },
          ticks: {
            color: TREINO_TICK,
            font: { family: 'IBM Plex Mono', size: 10 },
            maxRotation: 0,
            autoSkip: false,
            // Mostrar apenas 1 etiqueta em cada 7.
            callback: function (val, index) {
              return index % 7 === 0 ? this.getLabelForValue(val) : '';
            },
          },
          border: { color: '#2e2e2e' },
        },
        y: {
          grid: { color: TREINO_GRID },
          ticks: { color: TREINO_TICK, font: { family: 'IBM Plex Mono', size: 10 } },
          border: { color: '#2e2e2e' },
        },
      },
    },
  });
}

// ── Secção 3 — Chart HRV · 30 dias ───────────────────────────────────────────

function treinoHrvSectionHtml(wSorted) {
  const header = tSecLabel('HRV · 30 dias');
  const last30 = wSorted.slice(-30);
  const withHrv = last30.filter(w => tNum(w.hrv) != null);

  if (withHrv.length < 3) {
    return `<div style="padding:18px 20px 0;margin-top:20px">${header}${tEmpty('Sem dados HRV suficientes')}</div>`;
  }
  return `<div class="treino-chart-section" style="padding:18px 20px 0;margin-top:20px">
    ${header}
    <div class="treino-chart"><div style="position:relative;height:120px"><canvas id="treino-hrv-chart"></canvas></div></div>
  </div>`;
}

function buildTreinoHrvChart(wSorted) {
  const ctx = document.getElementById('treino-hrv-chart');
  if (!ctx) return;

  const last30 = wSorted.slice(-30).filter(w => tNum(w.hrv) != null);
  const labels = last30.map(w => tDayLabel(tWellnessDate(w)));
  const hrvData = last30.map(w => tNum(w.hrv));

  treinoHrvChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'HRV',
        data: hrvData,
        borderColor: '#60a5fa',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 2,
        pointBackgroundColor: '#60a5fa',
        tension: 0.3,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: TREINO_LEGEND, font: { size: 12 }, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#2e2e2e',
          borderWidth: 1,
          titleColor: '#bbb',
          bodyColor: '#f0f0f0',
        },
      },
      scales: {
        x: {
          grid: { color: TREINO_GRID },
          ticks: {
            color: TREINO_TICK,
            font: { family: 'IBM Plex Mono', size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
          },
          border: { color: '#2e2e2e' },
        },
        y: {
          grid: { color: TREINO_GRID },
          ticks: { color: TREINO_TICK, font: { family: 'IBM Plex Mono', size: 10 } },
          border: { color: '#2e2e2e' },
        },
      },
    },
  });
}

// ── Secção 4 — Resumo da semana ──────────────────────────────────────────────

function tMondayOf(date) {
  const x = new Date(date);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - day);
  return x;
}

function tWeekTotals(activities, start, end) {
  // [start, end)
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

// Delta em mono 10px: verde se positivo, vermelho se negativo.
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

// Chip estilo .msc: label mono 9px uppercase + valor 16px/600 + linha extra.
function tChip(label, valHtml, extraHtml) {
  return `<div class="msc">
    <span style="font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em">${label}</span>
    <span style="font-size:16px;font-weight:600">${valHtml}</span>
    ${extraHtml || ''}
  </div>`;
}

function treinoWeekSectionHtml(activities) {
  const header = tSecLabel('Resumo da semana');

  if (!Array.isArray(activities)) {
    return `<div style="padding:18px 20px 0">${header}${tEmpty('Sem dados de actividades.')}</div>`;
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

  return `<div style="padding:18px 20px 0">
    ${header}
    <div class="macro-secondary">${km}${tempo}${carga}</div>
  </div>`;
}

// ── Wellness chips (HRV + Sono) ──────────────────────────────────────────────

function treinoWellnessChipsHtml(wSorted) {
  const header = tSecLabel('Wellness · 7 dias');
  const last7 = wSorted.slice(-7);

  if (!last7.length) {
    return `<div style="padding:18px 20px 24px">${header}${tEmpty('Sem dados de wellness.')}</div>`;
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
  const sleepHours = last7.map(w => {
    if (w.sleepSecs != null) return tNum(w.sleepSecs) / 3600;
    return null;
  }).filter(v => v != null);
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

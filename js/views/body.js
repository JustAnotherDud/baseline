let loadBodyGen = 0;
let bodyChartInstance = null;
let bodyAllData = [];
let bodyPeriod = 'month';
let bodyActiveDatasets = { weight: true, fat: false, lbm: false };
let bodyDate = new Date().toISOString().split('T')[0];
let bodyTab = 'dia';

async function loadBody() {
  const gen = ++loadBodyGen;
  const diaPanel = document.getElementById('body-dia-panel');
  if (diaPanel) diaPanel.innerHTML = '<div class="loading">A carregar...</div>';

  const { data, error } = await db
    .from('body_comp')
    .select('*')
    .order('date', { ascending: true });

  if (gen !== loadBodyGen) return;

  bodyAllData = (!error && data) ? data : [];
  bodyPeriod = 'month';
  bodyActiveDatasets = { weight: true, fat: false, lbm: false };
  if (bodyChartInstance) { bodyChartInstance.destroy(); bodyChartInstance = null; }

  renderBodyHistorico();
  await renderBodyDia();
  if (gen !== loadBodyGen) return;
  applyBodyTab();
}

// ── Tab switching ────────────────────────────────────────────────────────────

function applyBodyTab() {
  const dia  = document.getElementById('body-dia-panel');
  const hist = document.getElementById('body-historico-panel');
  if (dia)  dia.style.display  = bodyTab === 'dia' ? '' : 'none';
  if (hist) hist.style.display = bodyTab === 'historico' ? '' : 'none';
  const dTab = document.getElementById('body-subtab-dia');
  const hTab = document.getElementById('body-subtab-historico');
  if (dTab) dTab.classList.toggle('active', bodyTab === 'dia');
  if (hTab) hTab.classList.toggle('active', bodyTab === 'historico');
  // Chart must be (re)built while its panel is visible, else it sizes to 0px.
  if (bodyTab === 'historico') showBodyHistoricoChart();
}

function switchBodyTab(tab) {
  bodyTab = tab;
  applyBodyTab();
}

// ── Tab: Dia ───────────────────────────────────────────────────────────────

function changeBodyDay(delta) {
  const d = new Date(bodyDate + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  bodyDate = d.toISOString().split('T')[0];
  renderBodyDia();
}

function pickBodyDate() {
  openDatePicker(bodyDate, date => {
    bodyDate = date;
    renderBodyDia();
  });
}

function bodyPrevWeighIn(dateStr) {
  const prior = bodyAllData.filter(r => r.date < dateStr && r.weight_kg != null);
  return prior.length ? prior[prior.length - 1] : null;
}

function bodyDiaHeaderHtml() {
  const d = new Date(bodyDate + 'T12:00:00');
  const label = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  return `<div style="display:flex;align-items:center;gap:6px;padding:16px 20px 4px">
    <button class="btn btn-secondary" style="width:auto;padding:8px 12px;font-size:16px;line-height:1" onclick="changeBodyDay(-1)">←</button>
    <div style="flex:1;text-align:center;font-family:var(--mono);font-size:13px;color:var(--text2);text-transform:capitalize">${label}</div>
    <button class="btn btn-secondary" style="width:auto;padding:8px 12px;font-size:13px" onclick="pickBodyDate()">📅</button>
    <button class="btn btn-secondary" style="width:auto;padding:8px 12px;font-size:16px;line-height:1" onclick="changeBodyDay(1)">→</button>
  </div>`;
}

function bodyDayCardHtml(bc) {
  const wrap = inner => `<div style="padding:16px 20px 0">
    <div style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Pesagem</div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px">${inner}</div>
  </div>`;

  if (!bc || bc.weight_kg == null) {
    return wrap(`<div style="text-align:center;color:var(--text3);font-family:var(--mono);font-size:13px">Sem pesagem registada</div>`);
  }

  const prev = bodyPrevWeighIn(bc.date);
  let deltaHtml = '';
  if (prev?.weight_kg != null) {
    const delta = parseFloat((bc.weight_kg - prev.weight_kg).toFixed(1));
    if (delta > 0) {
      deltaHtml = `<span style="color:var(--red);font-family:var(--mono);font-size:13px">↑ ${delta.toFixed(1)} kg</span>`;
    } else if (delta < 0) {
      deltaHtml = `<span style="color:var(--accent);font-family:var(--mono);font-size:13px">↓ ${Math.abs(delta).toFixed(1)} kg</span>`;
    } else {
      deltaHtml = `<span style="color:var(--text3);font-family:var(--mono);font-size:13px">= 0.0 kg</span>`;
    }
  }

  return wrap(`
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:14px">
      <span style="font-family:var(--mono);font-size:32px;font-weight:600;color:var(--accent);line-height:1">${parseFloat(bc.weight_kg).toFixed(1)}</span>
      <span style="font-family:var(--mono);font-size:13px;color:var(--text3)">kg</span>
      ${deltaHtml}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${bodyMetricCard('Body Fat', bc.body_fat_pct, '%', 'var(--orange)')}
      ${bodyMetricCard('Músculo', bc.muscle_mass_kg, 'kg', 'var(--blue)')}
      ${bodyMetricCard('Osso', bc.bone_mass_kg, 'kg', 'var(--text2)')}
      ${bodyMetricCard('Água', bc.water_pct, '%', 'var(--blue)')}
    </div>
  `);
}

function bodyNutritionCardHtml(entries, t) {
  const wrap = inner => `<div style="padding:16px 20px 24px">
    <div style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Nutrição</div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px">${inner}</div>
  </div>`;

  if (!entries || entries.length === 0) {
    return wrap(`<div style="text-align:center;color:var(--text3);font-family:var(--mono);font-size:13px">Sem registos nutricionais</div>`);
  }

  const tot = { kcal: 0, prot: 0, carb: 0, fat: 0, fiber: 0 };
  entries.forEach(e => {
    tot.kcal  += +e.calories;
    tot.prot  += +e.protein;
    tot.carb  += +e.carbs;
    tot.fat   += +e.fat;
    tot.fiber += +(e.fiber || 0);
  });

  const r = n => Math.round(n);
  const hasTargets = t && t.calories > 0;
  const kcalPct   = hasTargets ? tot.kcal / t.calories * 100 : 0;
  const kcalColor = hasTargets ? getNutrientColor('calories', kcalPct) : 'var(--accent)';
  const kcalTgt   = hasTargets ? `/ ${t.calories} kcal` : 'kcal';

  return wrap(`
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px">
      <span style="font-family:var(--mono);font-size:24px;font-weight:600;color:${kcalColor};line-height:1">${r(tot.kcal)}</span>
      <span style="font-family:var(--mono);font-size:13px;color:var(--text3)">${kcalTgt}</span>
    </div>
    <div style="font-family:var(--mono);font-size:13px;display:flex;flex-wrap:wrap;gap:4px 8px">
      <span style="color:var(--blue)">P ${r(tot.prot)}g</span>
      <span style="color:var(--text3)">·</span>
      <span style="color:var(--yellow)">H ${r(tot.carb)}g</span>
      <span style="color:var(--text3)">·</span>
      <span style="color:var(--orange)">G ${r(tot.fat)}g</span>
      <span style="color:var(--text3)">·</span>
      <span style="color:var(--accent)">Fibra ${r(tot.fiber)}g</span>
    </div>
  `);
}

async function renderBodyDia() {
  const panel = document.getElementById('body-dia-panel');
  if (!panel) return;
  const gen = loadBodyGen;

  const { data: bc }    = await db.from('body_comp').select('*').eq('date', bodyDate).maybeSingle();
  const { data: diary } = await db.from('diary').select('*').eq('date', bodyDate);
  const targets         = await getTargetsForDate(bodyDate);

  if (gen !== loadBodyGen) return;

  panel.innerHTML = bodyDiaHeaderHtml()
    + bodyDayCardHtml(bc)
    + bodyNutritionCardHtml(diary || [], targets);
}

// ── Tab: Histórico ───────────────────────────────────────────────────────────

function renderBodyHistorico() {
  const container = document.getElementById('body-historico-panel');
  if (!container) return;

  if (bodyAllData.length === 0) {
    container.innerHTML = `<div class="empty">
      <div class="empty-icon">⚖️</div>
      <div class="empty-text">Sem dados de composição corporal.<br>Sincroniza primeiro com o Garmin.</div>
    </div>`;
    return;
  }

  const latest = bodyAllData[bodyAllData.length - 1];
  const prev   = bodyAllData.length >= 2 ? bodyAllData[bodyAllData.length - 2] : null;

  let deltaHtml = '';
  if (latest.weight_kg != null && prev?.weight_kg != null) {
    const delta = parseFloat((latest.weight_kg - prev.weight_kg).toFixed(1));
    if (delta > 0) {
      deltaHtml = `<span style="color:var(--red);font-family:var(--mono);font-size:13px">↑ ${delta.toFixed(1)} kg</span>`;
    } else if (delta < 0) {
      deltaHtml = `<span style="color:var(--accent);font-family:var(--mono);font-size:13px">↓ ${Math.abs(delta).toFixed(1)} kg</span>`;
    } else {
      deltaHtml = `<span style="color:var(--text3);font-family:var(--mono);font-size:13px">= 0.0 kg</span>`;
    }
  }

  const dateFormatted = latest.date
    ? new Date(latest.date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  container.innerHTML = `
    <div style="padding:16px 20px 0">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Última pesagem</div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px">
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px">
          <span style="font-family:var(--mono);font-size:42px;font-weight:600;color:var(--accent);line-height:1">${latest.weight_kg != null ? parseFloat(latest.weight_kg).toFixed(1) : '—'}</span>
          <span style="font-family:var(--mono);font-size:13px;color:var(--text3)">kg</span>
          ${deltaHtml}
        </div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--text3);margin-bottom:16px">${dateFormatted}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${bodyMetricCard('Body Fat', latest.body_fat_pct, '%', 'var(--orange)')}
          ${bodyMetricCard('Músculo', latest.muscle_mass_kg, 'kg', 'var(--blue)')}
          ${bodyMetricCard('Osso', latest.bone_mass_kg, 'kg', 'var(--text2)')}
          ${bodyMetricCard('Água', latest.water_pct, '%', 'var(--blue)')}
        </div>
      </div>
    </div>

    <div style="padding:16px 20px 24px">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Tendência</div>
      <div id="body-period-chips" style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch">
        <button class="sort-chip" data-period="week"  onclick="setBodyPeriod('week')">Semana</button>
        <button class="sort-chip active" data-period="month" onclick="setBodyPeriod('month')">Mês</button>
        <button class="sort-chip" data-period="3m"    onclick="setBodyPeriod('3m')">3M</button>
        <button class="sort-chip" data-period="6m"    onclick="setBodyPeriod('6m')">6M</button>
        <button class="sort-chip" data-period="1y"    onclick="setBodyPeriod('1y')">1A</button>
        <button class="sort-chip" data-period="all"   onclick="setBodyPeriod('all')">Total</button>
      </div>
      <div id="body-chart-chips" style="display:flex;gap:6px;margin-bottom:12px">
        <button class="sort-chip active" data-dataset="weight" onclick="toggleBodyDataset('weight')">Peso</button>
        <button class="sort-chip" data-dataset="fat"    onclick="toggleBodyDataset('fat')">Body Fat</button>
        <button class="sort-chip" data-dataset="lbm"    onclick="toggleBodyDataset('lbm')">LBM</button>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px">
        <div style="position:relative;height:180px">
          <canvas id="body-chart"></canvas>
        </div>
      </div>
    </div>
  `;
}

function showBodyHistoricoChart() {
  if (!document.getElementById('body-chart')) return;
  if (bodyChartInstance) { bodyChartInstance.destroy(); bodyChartInstance = null; }
  buildBodyChart(bodyFilterByPeriod(bodyAllData, bodyPeriod));
}

function bodyMetricCard(label, value, unit, color) {
  const display = value != null ? parseFloat(value).toFixed(1) + unit : '—';
  return `<div style="background:var(--surface3);border-radius:8px;padding:10px 12px">
    <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:4px">${label}</div>
    <div style="font-family:var(--mono);font-size:16px;font-weight:600;color:${color}">${display}</div>
  </div>`;
}

function bodyFilterByPeriod(rows, period) {
  if (period === 'all') return rows;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const cutoff = new Date(today);
  if      (period === 'week')  cutoff.setDate(today.getDate() - 7);
  else if (period === 'month') cutoff.setMonth(today.getMonth() - 1);
  else if (period === '3m')    cutoff.setMonth(today.getMonth() - 3);
  else if (period === '6m')    cutoff.setMonth(today.getMonth() - 6);
  else if (period === '1y')    cutoff.setFullYear(today.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return rows.filter(r => r.date >= cutoffStr);
}

function setBodyPeriod(p) {
  bodyPeriod = p;
  document.querySelectorAll('#body-period-chips .sort-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.period === p);
  });
  if (bodyChartInstance) { bodyChartInstance.destroy(); bodyChartInstance = null; }
  buildBodyChart(bodyFilterByPeriod(bodyAllData, p));
}

function buildBodyChart(rows) {
  const ctx = document.getElementById('body-chart');
  if (!ctx) return;

  const dense = rows.length > 60;

  const labels  = rows.map(r => {
    const d = new Date(r.date + 'T12:00:00');
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const weights = rows.map(r => r.weight_kg     != null ? parseFloat(r.weight_kg)     : null);
  const fats    = rows.map(r => r.body_fat_pct   != null ? parseFloat(r.body_fat_pct)  : null);
  const lbms    = rows.map(r => r.muscle_mass_kg != null ? parseFloat(r.muscle_mass_kg): null);

  const ptRadius = dense ? 0 : 3;

  bodyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Peso (kg)',
          data: weights,
          borderColor: '#4ade80',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: ptRadius,
          pointBackgroundColor: '#4ade80',
          tension: 0.3,
          hidden: !bodyActiveDatasets.weight,
          yAxisID: 'y',
          spanGaps: true,
        },
        {
          label: 'Body Fat (%)',
          data: fats,
          borderColor: '#60a5fa',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: ptRadius,
          pointBackgroundColor: '#60a5fa',
          tension: 0.3,
          hidden: !bodyActiveDatasets.fat,
          yAxisID: 'y3',
          spanGaps: true,
        },
        {
          label: 'LBM (kg)',
          data: lbms,
          borderColor: '#fb923c',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: ptRadius,
          pointBackgroundColor: '#fb923c',
          tension: 0.3,
          hidden: !bodyActiveDatasets.lbm,
          yAxisID: 'y2',
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
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
          grid: { display: false },
          ticks: {
            color: '#888',
            font: { family: 'IBM Plex Mono', size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          border: { color: '#2e2e2e' },
        },
        y: {
          position: 'left',
          display: bodyActiveDatasets.weight,
          grid: { color: '#1e1e1e' },
          ticks: { color: '#888', font: { family: 'IBM Plex Mono', size: 10 } },
          border: { color: '#2e2e2e' },
        },
        y2: {
          position: 'right',
          display: bodyActiveDatasets.lbm,
          grid: { drawOnChartArea: false },
          ticks: { color: '#888', font: { family: 'IBM Plex Mono', size: 10 } },
          border: { color: '#2e2e2e' },
        },
        y3: {
          position: 'right',
          display: bodyActiveDatasets.fat,
          grid: { drawOnChartArea: false },
          ticks: { color: '#888', font: { family: 'IBM Plex Mono', size: 10 } },
          border: { color: '#2e2e2e' },
        },
      },
    },
  });
}

function toggleBodyDataset(key) {
  if (!bodyChartInstance) return;
  bodyActiveDatasets[key] = !bodyActiveDatasets[key];

  document.querySelectorAll('#body-chart-chips .sort-chip').forEach(c => {
    c.classList.toggle('active', bodyActiveDatasets[c.dataset.dataset]);
  });

  const [weightDs, fatDs, lbmDs] = bodyChartInstance.data.datasets;
  weightDs.hidden = !bodyActiveDatasets.weight;
  fatDs.hidden    = !bodyActiveDatasets.fat;
  lbmDs.hidden    = !bodyActiveDatasets.lbm;

  bodyChartInstance.options.scales.y.display  = bodyActiveDatasets.weight;
  bodyChartInstance.options.scales.y2.display = bodyActiveDatasets.lbm;
  bodyChartInstance.options.scales.y3.display = bodyActiveDatasets.fat;
  bodyChartInstance.update();
}

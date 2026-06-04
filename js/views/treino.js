// ── Treino — integração Intervals.icu ────────────────────────────────────────
// Auth: HTTP Basic com utilizador "API_KEY" e a key como password (btoa("API_KEY:" + key)).
// Base URL: https://intervals.icu/api/v1

let loadTreinoGen = 0;
let treinoActivities = [];

const ICU_BASE = 'https://intervals.icu/api/v1';

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

// ── Helpers de formatação ──────────────────────────────────────────────────

function tNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function tFmtDur(secs) {
  const s = tNum(secs);
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function tFmtPace(secs, meters) {
  const s = tNum(secs), m = tNum(meters);
  if (s == null || m == null || m <= 0) return null;
  const perKm = s / (m / 1000);          // segundos por km
  const min = Math.floor(perKm / 60);
  const sec = Math.round(perKm % 60);
  return `${min}:${String(sec).padStart(2, '0')} /km`;
}

function tActIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('run'))  return '🏃';
  if (t.includes('ride') || t.includes('cycl') || t.includes('bike')) return '🚴';
  if (t.includes('swim')) return '🏊';
  if (t.includes('walk') || t.includes('hike')) return '🚶';
  return '⚡';
}

function tActField(a, ...keys) {
  for (const k of keys) {
    if (a[k] != null) return a[k];
  }
  return null;
}

// ── Load ────────────────────────────────────────────────────────────────────

async function loadTreino() {
  const gen = ++loadTreinoGen;
  const c = document.getElementById('treino-container');
  if (!c) return;

  if (!icuId || !icuKey) {
    c.innerHTML = `<div class="empty">
      <div class="empty-icon">⚡</div>
      <div class="empty-text">Configura o Intervals.icu nas Settings</div>
    </div>`;
    return;
  }

  c.innerHTML = '<div class="loading">A carregar...</div>';

  const today  = new Date().toISOString().split('T')[0];
  const back14 = icuDateOffset(-14);
  const back7  = icuDateOffset(-7);

  let profile, activities, wellness;
  try {
    [profile, activities, wellness] = await Promise.all([
      icuFetch(`/athlete/${icuId}/profile`),
      icuFetch(`/athlete/${icuId}/activities?oldest=${back14}&newest=${today}`),
      icuFetch(`/athlete/${icuId}/wellness?oldest=${back7}&newest=${today}`),
    ]);
  } catch (e) {
    if (gen !== loadTreinoGen) return;
    c.innerHTML = `<div class="empty">
      <div class="empty-icon">⚠️</div>
      <div class="empty-text">Erro a ligar ao Intervals.icu.<br>Verifica o ID e a API key nas Settings.</div>
    </div>`;
    return;
  }
  if (gen !== loadTreinoGen) return;

  // Próximo treino — secção opcional, não bloqueia o resto se falhar.
  let nextEvent = null;
  try {
    const events = await icuFetch(`/athlete/${icuId}/events?oldest=${today}&category=WORKOUT&limit=1`);
    if (gen !== loadTreinoGen) return;
    if (Array.isArray(events) && events.length) nextEvent = events[0];
  } catch (e) { /* ignora — secção opcional */ }

  treinoActivities = Array.isArray(activities) ? activities.slice() : [];

  c.innerHTML =
      treinoFitnessHtml(profile, wellness)
    + treinoNextHtml(nextEvent)
    + treinoActivitiesHtml(treinoActivities)
    + treinoWellnessHtml(wellness);
}

// ── Secção 1 — Fitness (CTL / ATL / TSB) ─────────────────────────────────────

function treinoLatestWellness(wellness) {
  if (!Array.isArray(wellness) || !wellness.length) return {};
  return wellness.reduce((acc, w) => (!acc.id || (w.id > acc.id) ? w : acc), wellness[0]);
}

function treinoFitnessHtml(profile, wellness) {
  profile = profile || {};
  const w = treinoLatestWellness(wellness);

  const ctl = tNum(profile.ctl  ?? profile.fitness ?? w.ctl);
  const atl = tNum(profile.atl  ?? profile.fatigue ?? w.atl);
  let tsb   = tNum(profile.tsb  ?? profile.form);
  if (tsb == null && ctl != null && atl != null) tsb = ctl - atl;
  const ramp = tNum(profile.rampRate ?? w.rampRate);

  const tsbColor = tsb != null && tsb < 0 ? 'var(--red)' : 'var(--accent)';
  const d0 = v => v != null ? Math.round(v) : '—';
  const tsbStr = tsb != null ? (tsb > 0 ? '+' + Math.round(tsb) : Math.round(tsb)) : '—';

  const cell = (label, val, color) => `
    <div class="macro-cell" style="cursor:default">
      <div class="macro-cell-label">${label}</div>
      <div class="macro-cell-valrow"><span class="macro-cell-val" style="color:${color}">${val}</span></div>
    </div>`;

  const rampStr = ramp != null
    ? `Ramp rate ${ramp > 0 ? '+' : ''}${ramp.toFixed(1)}/sem`
    : '';

  return `<div style="padding:16px 20px 0">
    <div class="treino-section-label">Fitness</div>
    <div class="macro-grid" style="margin-top:0;border-top:none">
      ${cell('Fitness', d0(ctl), 'var(--accent)')}
      ${cell('Fadiga',  d0(atl), 'var(--orange)')}
      ${cell('Forma',   tsbStr,  tsbColor)}
    </div>
    ${rampStr ? `<div style="font-family:var(--mono);font-size:11px;color:var(--text3);margin-top:10px">${rampStr}</div>` : ''}
  </div>`;
}

// ── Secção 2 — Próximo treino ────────────────────────────────────────────────

function treinoNextHtml(ev) {
  if (!ev) return '';

  const name = ev.name || ev.workout_name || 'Treino planeado';
  const dateStr = ev.start_date_local || ev.start_date || ev.date;
  let dateLabel = '';
  if (dateStr) {
    const d = new Date(dateStr.length <= 10 ? dateStr + 'T12:00:00' : dateStr);
    dateLabel = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const durSecs = tNum(ev.moving_time ?? ev.icu_training_load ?? ev.duration);
  const durStr = ev.moving_time != null ? tFmtDur(ev.moving_time)
               : (ev.duration != null ? tFmtDur(ev.duration) : null);

  return `<div style="padding:18px 20px 0">
    <div class="treino-section-label">Próximo treino</div>
    <div class="treino-card">
      <div style="font-family:var(--sans);font-size:15px;font-weight:600;color:var(--text);margin-bottom:4px">${name}</div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--text3);text-transform:capitalize">
        ${dateLabel}${durStr ? ` · ${durStr}` : ''}
      </div>
    </div>
  </div>`;
}

// ── Secção 3 — Actividades recentes (14 dias) ────────────────────────────────

function treinoActivitiesHtml(activities) {
  const header = `<div class="treino-section-label">Actividades · 14 dias</div>`;

  if (!activities.length) {
    return `<div style="padding:18px 20px 0">${header}
      <div class="empty-meals">Sem actividades nos últimos 14 dias.</div>
    </div>`;
  }

  // Mais recentes primeiro.
  const sorted = activities.slice().sort((a, b) => {
    const da = a.start_date_local || a.start_date || '';
    const dbb = b.start_date_local || b.start_date || '';
    return dbb.localeCompare(da);
  });
  treinoActivities = sorted;

  const cards = sorted.map((a, i) => {
    const icon = tActIcon(a.type);
    const name = a.name || a.type || 'Actividade';
    const dist = tNum(tActField(a, 'distance', 'icu_distance'));
    const distStr = dist != null && dist > 0 ? (dist / 1000).toFixed(1) + ' km' : null;
    const durStr = tFmtDur(tActField(a, 'moving_time', 'elapsed_time'));
    const hr = tNum(tActField(a, 'average_heartrate', 'icu_average_hr'));
    const load = tNum(tActField(a, 'icu_training_load', 'training_load'));

    const meta = [];
    if (distStr) meta.push(distStr);
    if (durStr !== '—') meta.push(durStr);
    if (hr != null) meta.push(`${Math.round(hr)} bpm`);
    if (load != null) meta.push(`TL ${Math.round(load)}`);

    return `<div class="treino-act" onclick="openTreinoDetail(${i})">
      <div class="treino-act-icon">${icon}</div>
      <div class="treino-act-body">
        <div class="treino-act-name">${name}</div>
        <div class="treino-act-meta">${meta.join(' · ')}</div>
      </div>
      <div style="color:var(--text3);font-size:18px">›</div>
    </div>`;
  }).join('');

  return `<div style="padding:18px 20px 0">${header}${cards}</div>`;
}

function openTreinoDetail(idx) {
  const a = treinoActivities[idx];
  if (!a) return;

  let overlay = document.getElementById('treino-detail-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'treino-detail-overlay';
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet" style="max-height:80dvh">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div id="treino-detail-title" class="sheet-title"></div>
          <div class="sheet-close" id="treino-detail-close">×</div>
        </div>
        <div id="treino-detail-body"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
    document.getElementById('treino-detail-close').onclick = () => overlay.classList.remove('open');
  }

  document.getElementById('treino-detail-title').textContent =
    `${tActIcon(a.type)} ${a.name || a.type || 'Actividade'}`;

  const dist = tNum(tActField(a, 'distance', 'icu_distance'));
  const pace = tFmtPace(tActField(a, 'moving_time', 'elapsed_time'), dist);
  const elev = tNum(tActField(a, 'total_elevation_gain', 'icu_elevation_gain'));
  const desc = a.description || '';

  const row = (label, val) => val == null || val === ''
    ? ''
    : `<div style="display:flex;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--border)">
         <span style="font-family:var(--mono);font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">${label}</span>
         <span style="font-family:var(--mono);font-size:13px;color:var(--text2)">${val}</span>
       </div>`;

  const body = document.getElementById('treino-detail-body');
  body.innerHTML =
      row('Pace médio', pace)
    + row('Elevação', elev != null ? Math.round(elev) + ' m' : null)
    + (desc
        ? `<div style="padding:14px 20px;font-family:var(--sans);font-size:13px;line-height:1.5;color:var(--text2);white-space:pre-wrap">${desc}</div>`
        : (!pace && elev == null
            ? `<div class="empty-meals">Sem detalhes adicionais.</div>`
            : ''));

  overlay.classList.add('open');
}

// ── Secção 4 — Wellness (7 dias) ─────────────────────────────────────────────

function treinoWellnessHtml(wellness) {
  const rows = (Array.isArray(wellness) ? wellness : [])
    .slice()
    .sort((a, b) => (a.id || '').toString().localeCompare((b.id || '').toString()));

  const header = `<div class="treino-section-label">Wellness · 7 dias</div>`;

  if (!rows.length) {
    return `<div style="padding:18px 20px 24px">${header}
      <div class="empty-meals">Sem dados de wellness.</div>
    </div>`;
  }

  // HRV — último valor + seta vs média 7d.
  const hrvVals = rows.map(r => tNum(r.hrv)).filter(v => v != null);
  let hrvChip = '—';
  if (hrvVals.length) {
    const last = hrvVals[hrvVals.length - 1];
    const avg = hrvVals.reduce((s, v) => s + v, 0) / hrvVals.length;
    let arrow = '', col = 'var(--text2)';
    if (last > avg + 0.5)      { arrow = ' ↑'; col = 'var(--accent)'; }
    else if (last < avg - 0.5) { arrow = ' ↓'; col = 'var(--red)'; }
    hrvChip = `<span style="color:${col}">${Math.round(last)}${arrow}</span>`;
  }

  // Sono — média 7d em horas.
  const sleepHours = rows.map(r => {
    if (r.sleepSecs != null) return tNum(r.sleepSecs) / 3600;
    if (r.sleep != null)     return tNum(r.sleep);          // já em horas
    return null;
  }).filter(v => v != null);
  const sleepChip = sleepHours.length
    ? (sleepHours.reduce((s, v) => s + v, 0) / sleepHours.length).toFixed(1) + 'h'
    : '—';

  // Peso — último valor em kg.
  const weights = rows.map(r => tNum(r.weight)).filter(v => v != null);
  const weightChip = weights.length ? weights[weights.length - 1].toFixed(1) + ' kg' : '—';

  const chip = (name, val) => `<div class="msc">
    <span class="msc-name">${name}</span>
    <span class="msc-val">${val}</span>
  </div>`;

  return `<div style="padding:18px 20px 24px">${header}
    <div class="macro-secondary">
      ${chip('HRV', hrvChip)}
      ${chip('Sono', sleepChip)}
      ${chip('Peso', weightChip)}
    </div>
  </div>`;
}

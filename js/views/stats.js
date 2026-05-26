let loadStatsGen = 0;
let statsPeriod = 7; // 7 | 14 | 30

async function loadStats() {
  const gen = ++loadStatsGen;
  const container = document.getElementById('stats-container');
  const periodEl  = document.getElementById('stats-period');
  if (!container) return;
  container.innerHTML = '<div class="loading">A carregar...</div>';

  // ── Date range: from = today - N days, to = yesterday ──────────────────
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const to = yesterday.toISOString().split('T')[0];

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - statsPeriod);
  const from = fromDate.toISOString().split('T')[0];

  // Streak: always last 60 days regardless of selected period
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const streakFrom = sixtyDaysAgo.toISOString().split('T')[0];

  if (periodEl) {
    const fmt = d => { const p = d.split('-'); return `${p[2]}/${p[1]}`; };
    periodEl.textContent = `${fmt(from)} – ${fmt(to)}`;
  }

  if (!db) { container.innerHTML = '<div class="loading">Sem ligação à base de dados.</div>'; return; }

  // ── 4 parallel queries ─────────────────────────────────────────────────
  const [diaryRes, targetsRes, foodsRes, streakRes] = await Promise.all([
    db.from('diary')
      .select('date,calories,protein,carbs,fat,fiber')
      .gte('date', from).lte('date', to),
    db.from('daily_targets')
      .select('date,calories,protein,carbs,fat')
      .gte('date', from).lte('date', to),
    db.from('diary')
      .select('food_name,calories')
      .gte('date', from).lte('date', to),
    db.from('diary')
      .select('date')
      .gte('date', streakFrom).lte('date', to),
  ]);

  const diaryRows  = diaryRes.data   || [];
  const targetRows = targetsRes.data || [];
  const foodRows   = foodsRes.data   || [];
  const streakRows = streakRes.data  || [];

  if (gen !== loadStatsGen) return;

  // ── Aggregate diary by date ────────────────────────────────────────────
  const diaryMap = new Map();
  diaryRows.forEach(e => {
    const d = diaryMap.get(e.date) || { calories:0, protein:0, carbs:0, fat:0, fiber:0 };
    d.calories += +(e.calories || 0);
    d.protein  += +(e.protein  || 0);
    d.carbs    += +(e.carbs    || 0);
    d.fat      += +(e.fat      || 0);
    d.fiber    += +(e.fiber    || 0);
    diaryMap.set(e.date, d);
  });

  // ── Target map ────────────────────────────────────────────────────────
  const targetsMap = new Map();
  targetRows.forEach(t => targetsMap.set(t.date, t));

  // ── Days with both diary + target ─────────────────────────────────────
  const pairedDates = [...diaryMap.keys()].filter(d => targetsMap.has(d));

  // ── Streak calculation ────────────────────────────────────────────────
  const datesWithEntries = new Set(streakRows.map(r => r.date));
  let streak = 0;
  if (datesWithEntries.has(to)) {
    streak = 1;
    const checkDate = new Date(to + 'T12:00:00');
    checkDate.setDate(checkDate.getDate() - 1);
    while (true) {
      const ds = checkDate.toISOString().split('T')[0];
      if (!datesWithEntries.has(ds)) break;
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  // ── Build sections ─────────────────────────────────────────────────────
  container.innerHTML = '';

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Daily averages
  // ════════════════════════════════════════════════════════════════════════
  const sec1 = document.createElement('div');
  sec1.className = 'stats-section';

  if (pairedDates.length === 0) {
    sec1.innerHTML = `
      <div class="stats-section-title">Médias diárias</div>
      <div class="stats-empty">Sem dados suficientes para calcular médias.</div>`;
  } else {
    const n = pairedDates.length;
    const avg = { calories:0, protein:0, carbs:0, fat:0 };
    const tgt = { calories:0, protein:0, carbs:0, fat:0 };
    pairedDates.forEach(d => {
      const diary  = diaryMap.get(d);
      const target = targetsMap.get(d);
      avg.calories += diary.calories;  tgt.calories += +(target.calories || 0);
      avg.protein  += diary.protein;   tgt.protein  += +(target.protein  || 0);
      avg.carbs    += diary.carbs;     tgt.carbs    += +(target.carbs    || 0);
      avg.fat      += diary.fat;       tgt.fat      += +(target.fat      || 0);
    });
    Object.keys(avg).forEach(k => { avg[k] = Math.round(avg[k] / n); tgt[k] = Math.round(tgt[k] / n); });

    const avgRows = [
      { label: 'Calorias', unit: 'kcal', key: 'calories', nutrient: 'calories' },
      { label: 'Proteína', unit: 'g',    key: 'protein',  nutrient: 'protein'  },
      { label: 'Hidratos', unit: 'g',    key: 'carbs',    nutrient: 'carbs'    },
      { label: 'Gordura',  unit: 'g',    key: 'fat',      nutrient: 'fat'      },
    ].map(({ label, unit, key, nutrient }) => {
      const actual = avg[key];
      const target = tgt[key];
      const pct    = target > 0 ? actual / target * 100 : 0;
      const color  = getNutrientColor(nutrient, pct);
      const pctStr = target > 0 ? Math.round(pct) + '%' : '—';
      return `
        <div class="stats-row">
          <div class="stats-label">${label}</div>
          <div class="stats-values">
            <span style="color:${color};font-weight:600">${actual}</span>
            <span class="stats-of">/${target}${unit}</span>
            <span class="stats-pct" style="color:${color}">${pctStr}</span>
          </div>
          <div class="stats-bar-track">
            <div class="stats-bar-fill" style="width:${Math.min(100,pct)}%;background:${color}"></div>
          </div>
        </div>`;
    }).join('');

    sec1.innerHTML = `
      <div class="stats-section-title">Médias diárias · ${n} dia${n!==1?'s':''}</div>
      ${avgRows}`;
  }
  container.appendChild(sec1);

  // ════════════════════════════════════════════════════════════════════════
  // SECTION STREAK — consecutive days with diary entries
  // ════════════════════════════════════════════════════════════════════════
  const secStreak = document.createElement('div');
  secStreak.className = 'stats-section';
  const streakMsg = streak >= 7 ? 'Mantém o ritmo!' : streak >= 3 ? 'Bom começo!' : streak === 0 ? 'Começa hoje!' : '';
  secStreak.innerHTML = `
    <div class="stats-section-title">Streak de registo</div>
    <div style="display:flex;align-items:baseline;gap:8px">
      <span style="font-family:var(--mono);font-size:36px;font-weight:600;color:var(--accent)">${streak}</span>
      <span style="font-size:14px;color:var(--text2)">dias consecutivos</span>
    </div>
    <div style="font-family:var(--mono);font-size:11px;color:var(--text3);margin-top:4px">${streakMsg}</div>`;
  container.appendChild(secStreak);

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Calorie adherence dots
  // ════════════════════════════════════════════════════════════════════════
  const sec2 = document.createElement('div');
  sec2.className = 'stats-section';

  const dots = [];
  const iterDate = new Date(from + 'T12:00:00');
  const toDateObj = new Date(to + 'T12:00:00');
  while (iterDate <= toDateObj) {
    const dateStr = iterDate.toISOString().split('T')[0];
    const dd = String(iterDate.getDate()).padStart(2, '0');
    const mm = String(iterDate.getMonth() + 1).padStart(2, '0');
    const label = `${dd}/${mm}`;
    const diary  = diaryMap.get(dateStr);
    const target = targetsMap.get(dateStr);
    let color = 'var(--surface3)';
    let pct   = null;
    if (diary && target && target.calories > 0) {
      pct   = diary.calories / target.calories * 100;
      color = getNutrientColor('calories', pct);
    }
    const titleAttr = pct !== null ? `${label} · ${Math.round(pct)}%` : `${label} · sem dados`;

    if (statsPeriod === 7) {
      dots.push(`
        <div class="stats-dot-col">
          <div class="stats-dot" style="background:${color}" title="${titleAttr}"></div>
          <div class="stats-dot-label">${label}</div>
        </div>`);
    } else if (statsPeriod === 14) {
      dots.push(`<div class="stats-dot" style="background:${color};width:calc(100%/7 - 4px);aspect-ratio:1;max-width:32px;flex-shrink:0" title="${titleAttr}"></div>`);
    } else {
      dots.push(`<div class="stats-dot" style="background:${color};aspect-ratio:1" title="${titleAttr}"></div>`);
    }
    iterDate.setDate(iterDate.getDate() + 1);
  }

  let dotsHtml;
  if (statsPeriod === 7) {
    dotsHtml = `<div class="stats-dots">${dots.join('')}</div>`;
  } else if (statsPeriod === 14) {
    dotsHtml = `<div style="display:flex;flex-wrap:wrap;gap:4px">${dots.join('')}</div>`;
  } else {
    dotsHtml = `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px">${dots.join('')}</div>`;
  }

  sec2.innerHTML = `
    <div class="stats-section-title">Aderência calórica · ${statsPeriod} dias</div>
    ${dotsHtml}`;
  container.appendChild(sec2);

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 3 — Top 5 foods
  // ════════════════════════════════════════════════════════════════════════
  const sec3 = document.createElement('div');
  sec3.className = 'stats-section';

  if (foodRows.length === 0) {
    sec3.innerHTML = `
      <div class="stats-section-title">Alimentos mais frequentes</div>
      <div class="stats-empty">Sem registos neste período.</div>`;
  } else {
    const foodMap = new Map();
    foodRows.forEach(({ food_name, calories }) => {
      const f = foodMap.get(food_name) || { count: 0, totalKcal: 0 };
      f.count++;
      f.totalKcal += +(calories || 0);
      foodMap.set(food_name, f);
    });

    const topFoods = [...foodMap.entries()]
      .sort((a, b) => b[1].count - a[1].count || b[1].totalKcal - a[1].totalKcal)
      .slice(0, 5);

    const topRows = topFoods.map(([name, { count, totalKcal }], idx) => `
      <div class="stats-top-item">
        <div class="stats-top-rank">${idx + 1}</div>
        <div class="stats-top-name">${name}</div>
        <div class="stats-top-meta">${count}× · ${Math.round(totalKcal)} kcal</div>
      </div>`).join('');

    sec3.innerHTML = `
      <div class="stats-section-title">Alimentos mais frequentes</div>
      ${topRows}`;
  }
  container.appendChild(sec3);
}

function setStatsPeriod(n) {
  statsPeriod = n;
  document.querySelectorAll('#stats-period-chips .sort-chip')
    .forEach(c => c.classList.toggle('active', +c.dataset.p === n));
  loadStats();
}

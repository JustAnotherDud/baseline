async function loadStats() {
  const container = document.getElementById('stats-container');
  const periodEl  = document.getElementById('stats-period');
  if (!container) return;
  container.innerHTML = '<div class="loading">A carregar...</div>';

  // ── Date range: last 7 days including today ──────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 6);
  const from = fromDate.toISOString().split('T')[0];

  if (periodEl) {
    const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
    periodEl.textContent = `${fmt(from)} – ${fmt(today)}`;
  }

  if (!db) { container.innerHTML = '<div class="loading">Sem ligação à base de dados.</div>'; return; }

  // ── 3 parallel queries ───────────────────────────────────────────────────
  const [diaryRes, targetsRes, foodsRes] = await Promise.all([
    db.from('diary')
      .select('date,calories,protein,carbs,fat,saturated_fat,fiber,sugar')
      .gte('date', from).lte('date', today),
    db.from('daily_targets')
      .select('date,calories,protein,carbs,fat')
      .gte('date', from).lte('date', today),
    db.from('diary')
      .select('food_name,calories')
      .gte('date', from).lte('date', today),
  ]);

  const diaryRows   = diaryRes.data   || [];
  const targetRows  = targetsRes.data || [];
  const foodRows    = foodsRes.data   || [];

  // ── Aggregate diary by date ──────────────────────────────────────────────
  const diaryMap = new Map();
  diaryRows.forEach(e => {
    const d = diaryMap.get(e.date) || { calories:0, protein:0, carbs:0, fat:0, saturated_fat:0, fiber:0, sugar:0 };
    d.calories      += +(e.calories      || 0);
    d.protein       += +(e.protein       || 0);
    d.carbs         += +(e.carbs         || 0);
    d.fat           += +(e.fat           || 0);
    d.saturated_fat += +(e.saturated_fat || 0);
    d.fiber         += +(e.fiber         || 0);
    d.sugar         += +(e.sugar         || 0);
    diaryMap.set(e.date, d);
  });

  // ── Target map by date ───────────────────────────────────────────────────
  const targetsMap = new Map();
  targetRows.forEach(t => targetsMap.set(t.date, t));

  // ── Days with both diary + target data ──────────────────────────────────
  const pairedDates = [...diaryMap.keys()].filter(d => targetsMap.has(d));

  // ── Build sections ───────────────────────────────────────────────────────
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
  // SECTION 2 — 7-day calorie adherence
  // ════════════════════════════════════════════════════════════════════════
  const sec2 = document.createElement('div');
  sec2.className = 'stats-section';

  const dots = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(new Date().toISOString().split('T')[0] + 'T12:00:00');
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label   = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    const diary   = diaryMap.get(dateStr);
    const target  = targetsMap.get(dateStr);
    let color = 'var(--surface3)'; // no data
    let pct   = null;
    if (diary && target && target.calories > 0) {
      pct   = diary.calories / target.calories * 100;
      color = getNutrientColor('calories', pct);
    }
    const title = pct !== null ? `${label} · ${Math.round(pct)}%` : `${label} · sem dados`;
    dots.push(`
      <div class="stats-dot-col">
        <div class="stats-dot" style="background:${color}" title="${title}"></div>
        <div class="stats-dot-label">${label}</div>
      </div>`);
  }

  sec2.innerHTML = `
    <div class="stats-section-title">Aderência calórica · 7 dias</div>
    <div class="stats-dots">${dots.join('')}</div>`;
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

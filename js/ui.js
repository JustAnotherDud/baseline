let toastT;
function toast(msg) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),2400);
}

function overlayClose(e, id) { if(e.target.id===id) document.getElementById(id).classList.remove('open'); }

function openLog(mode) {
  if (!mealManuallySelected) {
    selectedMeal = getMealByHour();
    updateMealSelectorLabel(selectedMeal);
  }
  updateSheetMealTabs();
  document.getElementById('log-sheet-title').textContent = mode==='db' ? 'Pesquisar alimento' : 'Entrada rápida';
  document.getElementById('log-db').style.display    = mode==='db'    ? 'block' : 'none';
  document.getElementById('log-quick').style.display = mode==='quick' ? 'block' : 'none';
  if (mode==='db') {
    document.getElementById('log-stage-search').classList.add('active');
    document.getElementById('log-stage-grams').classList.remove('active');
    document.getElementById('log-q').value='';
    document.getElementById('log-results').innerHTML='<div class="loading">Começa a escrever para pesquisar</div>';
    loadRecentFoods();
    setTimeout(()=>document.getElementById('log-q').focus(),300);
  } else {
    clearQuick();
    setTimeout(()=>document.getElementById('q-name').focus(),300);
  }
  document.getElementById('sheet-log').classList.add('open');
  loadLogTotalsStrip();
}

function closeLog() {
  document.getElementById('sheet-log').classList.remove('open');
  selectedFood=null;
}

function openAddFood() {
  editingFoodId=null;
  document.getElementById('food-sheet-title').textContent='Novo alimento';
  document.getElementById('del-food-btn').style.display='none';
  ['f-name','f-brand','f-serving','f-kcal','f-prot','f-carb','f-fat','f-satfat','f-sugar','f-fiber'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('sheet-food').classList.add('open');
  setTimeout(()=>document.getElementById('f-name').focus(),300);
}

function closeAddFood() {
  document.getElementById('sheet-food').classList.remove('open');
  editingFoodId = null;
  fromLogContext = false;
}

async function openEditEntry(id) {
  if (!db) return;
  const { data, error } = await db.from('diary').select('*').eq('id', id).single();
  if (error || !data) return;
  editingEntry = data;

  document.getElementById('edit-food-card').innerHTML = `
    <div class="food-card-name">${data.food_name}</div>
    <div class="food-card-sub">${data.grams ? 'Peso original: ' + data.grams + 'g' : 'Entrada rápida'}</div>`;

  document.getElementById('edit-grams').value = data.grams || '';
  updateEditPreview();
  document.getElementById('sheet-edit').classList.add('open');
  setTimeout(() => document.getElementById('edit-grams').focus(), 300);
}

function closeEditEntry() {
  document.getElementById('sheet-edit').classList.remove('open');
  editingEntry = null;
}

async function openDatePicker(selectedVal, onSelect) {
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DAYS   = ['S','T','Q','Q','S','S','D'];
  const today  = new Date().toISOString().split('T')[0];

  let overlay = document.getElementById('dp-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dp-overlay';
    overlay.className = 'sheet-overlay';
    overlay.style.zIndex = '300';
    overlay.innerHTML = `
      <div class="sheet" style="max-height:420px">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div style="display:flex;align-items:center;gap:8px">
            <button id="dp-prev" style="background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer;padding:4px 10px;line-height:1">←</button>
            <div id="dp-label" class="sheet-title" style="min-width:150px;text-align:center"></div>
            <button id="dp-next" style="background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer;padding:4px 10px;line-height:1">→</button>
          </div>
          <div class="sheet-close" id="dp-close">×</div>
        </div>
        <div style="padding:10px 14px 20px">
          <div id="dp-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  const parts = selectedVal.split('-');
  let viewYear  = parseInt(parts[0]);
  let viewMonth = parseInt(parts[1]) - 1;
  let dayScores = new Map();

  const SCORE_COLOR = {
    green:   'var(--accent)',
    yellow:  'var(--yellow)',
    red:     'var(--red)',
    neutral: 'var(--text3)',
  };

  async function render() {
    try { dayScores = await getDayScores(viewYear, viewMonth); } catch {}
    document.getElementById('dp-label').textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    const grid = document.getElementById('dp-grid');
    grid.innerHTML = '';

    DAYS.forEach(d => {
      const el = document.createElement('div');
      el.textContent = d;
      el.style.cssText = 'font-family:var(--mono);font-size:10px;color:var(--text3);padding:5px 0;font-weight:500';
      grid.appendChild(el);
    });

    const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
    for (let i = 0; i < firstWeekday; i++) grid.appendChild(document.createElement('div'));

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const btn = document.createElement('button');
      const isSel   = ds === selectedVal;
      const isToday = ds === today;
      const score   = dayScores.get(ds); // 'green'|'yellow'|'red'|'neutral'|undefined
      const numStyle = [
        'width:32px;height:32px;display:flex;align-items:center;justify-content:center',
        'border-radius:50%;font-size:14px;font-family:var(--sans);transition:background .1s',
        isSel   ? 'background:var(--accent);color:#0a0a0a;font-weight:700;border:none'
                : isToday ? 'background:transparent;color:var(--accent);font-weight:600;border:1px solid var(--accent)'
                          : 'background:transparent;color:var(--text);border:none',
      ].join(';');
      const dow = new Date(viewYear, viewMonth, d).getDay(); // 0=Sun,6=Sat
      btn.style.cssText = 'width:100%;display:flex;flex-direction:column;align-items:center;cursor:pointer;background:none;border:none;padding:2px 0;border-radius:6px';
      if (dow === 0 || dow === 6) btn.classList.add('cal-weekend');
      const dotHTML = score !== undefined
        ? `<span class="cal-dot" style="background:${SCORE_COLOR[score]}"></span>`
        : '';
      btn.innerHTML = `<span style="${numStyle}">${d}</span>${dotHTML}`;
      btn.onclick = () => { overlay.classList.remove('open'); onSelect(ds); };
      grid.appendChild(btn);
    }
  }

  document.getElementById('dp-prev').onclick = () => {
    if (--viewMonth < 0) { viewMonth = 11; viewYear--; } render();
  };
  document.getElementById('dp-next').onclick = () => {
    if (++viewMonth > 11) { viewMonth = 0; viewYear++; } render();
  };
  document.getElementById('dp-close').onclick = () => overlay.classList.remove('open');
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };

  render();
  overlay.classList.add('open');
}

function openNutrientSheet(entries) {
  const NUTRIENTS = [
    { key: 'calories',      label: 'Calorias',      unit: 'kcal', color: 'var(--accent)' },
    { key: 'protein',       label: 'Proteína',       unit: 'g',    color: 'var(--blue)'   },
    { key: 'fat',           label: 'Gordura',         unit: 'g',    color: 'var(--orange)' },
    { key: 'carbs',         label: 'Hidratos',        unit: 'g',    color: 'var(--yellow)' },
    { key: 'fiber',         label: 'Fibra',           unit: 'g',    color: 'var(--accent)' },
    { key: 'saturated_fat', label: 'Gord. Saturada',  unit: 'g',    color: '#f97316'       },
    { key: 'sugar',         label: 'Açúcar',          unit: 'g',    color: '#e879f9'       },
  ];

  let overlay = document.getElementById('nutri-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'nutri-overlay';
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet" style="max-height:80dvh">
        <div class="sheet-handle"></div>
        <div id="nutri-stage-pick">
          <div class="sheet-header">
            <div class="sheet-title">Analisar nutriente</div>
            <div class="sheet-close" id="nutri-close">×</div>
          </div>
          <div id="nutri-pick-list"></div>
        </div>
        <div id="nutri-stage-rank" style="display:none">
          <div class="sheet-header">
            <button id="nutri-back" style="background:none;border:none;color:var(--text2);font-size:15px;cursor:pointer;padding:2px 0;font-family:var(--sans)">← Voltar</button>
            <div id="nutri-rank-title" class="sheet-title" style="flex:1;text-align:center;padding:0 8px"></div>
            <div class="sheet-close" id="nutri-close2">×</div>
          </div>
          <div id="nutri-rank-list"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
    document.getElementById('nutri-close').onclick  = () => overlay.classList.remove('open');
    document.getElementById('nutri-close2').onclick = () => overlay.classList.remove('open');
    document.getElementById('nutri-back').onclick   = () => {
      document.getElementById('nutri-stage-pick').style.display = 'block';
      document.getElementById('nutri-stage-rank').style.display = 'none';
    };
  }

  function showRanking(n) {
    const r   = v => Math.round(+(v || 0) * 10) / 10;
    const fmt = v => n.key === 'calories' ? Math.round(v) : r(v);

    // Group by food_name, sum the nutrient
    const groupMap = new Map();
    entries.forEach(e => {
      const name = e.food_name;
      if (!groupMap.has(name)) groupMap.set(name, { entries: [], sum: 0 });
      const g = groupMap.get(name);
      g.entries.push(e);
      g.sum += +(e[n.key] || 0);
    });
    const grouped = [...groupMap.values()].sort((a, b) => b.sum - a.sum);

    const total  = grouped.reduce((s, g) => s + g.sum, 0);
    const maxVal = grouped.length > 0 ? grouped[0].sum : 1;

    document.getElementById('nutri-rank-title').textContent =
      `${n.label} — ${fmt(total)}${n.unit} total`;

    const list = document.getElementById('nutri-rank-list');
    list.innerHTML = '';

    if (entries.length === 0) {
      list.innerHTML = '<div class="loading">Sem entradas hoje</div>';
      document.getElementById('nutri-stage-pick').style.display = 'none';
      document.getElementById('nutri-stage-rank').style.display = 'block';
      return;
    }

    grouped.forEach(group => {
      const name   = group.entries[0].food_name;
      const count  = group.entries.length;
      const val    = group.sum;
      const pct    = total > 0 ? Math.round(val / total * 100) : 0;
      const barPct = maxVal > 0 ? Math.round(val / maxVal * 100) : 0;
      const multi  = count > 1;

      const item = document.createElement('div');
      item.className = 'nutri-rank-item';

      const subsHTML = multi ? group.entries.map(e => {
        const mealLabel = (typeof MEALS !== 'undefined' && MEALS[e.meal]) || e.meal || '—';
        return `<div class="nutri-rank-sub">
          <span class="nutri-rank-sub-meal">${mealLabel}</span>
          <span class="nutri-rank-sub-val">${fmt(+(e[n.key] || 0))}${n.unit}</span>
        </div>`;
      }).join('') : '';

      item.innerHTML = `
        <div class="nutri-rank-top" style="${multi ? 'cursor:pointer' : ''}">
          <div style="display:flex;align-items:center;gap:5px;flex:1;min-width:0">
            <div class="nutri-rank-name">${name}</div>
            ${multi ? `<span style="font-family:var(--mono);font-size:10px;color:var(--text3);background:var(--surface3);padding:1px 5px;border-radius:10px;flex-shrink:0">×${count}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <div class="nutri-rank-val" style="color:${n.color}">${fmt(val)}${n.unit}</div>
            ${multi ? `<span class="nutri-rank-chevron">▸</span>` : ''}
          </div>
        </div>
        <div class="nutri-rank-bar-row">
          <div class="nutri-rank-track">
            <div class="nutri-rank-fill" style="width:${barPct}%;background:${n.color}"></div>
          </div>
          <div class="nutri-rank-pct">${pct}%</div>
        </div>
        ${multi ? `<div class="nutri-rank-subs" style="display:none">${subsHTML}</div>` : ''}`;

      if (multi) {
        const topRow = item.querySelector('.nutri-rank-top');
        const subs   = item.querySelector('.nutri-rank-subs');
        const chev   = item.querySelector('.nutri-rank-chevron');
        topRow.onclick = () => {
          const isOpen = subs.style.display !== 'none';
          subs.style.display = isOpen ? 'none' : 'block';
          chev.textContent   = isOpen ? '▸' : '▾';
        };
      }

      list.appendChild(item);
    });

    document.getElementById('nutri-stage-pick').style.display = 'none';
    document.getElementById('nutri-stage-rank').style.display = 'block';
  }

  const pickList = document.getElementById('nutri-pick-list');
  pickList.innerHTML = '';
  NUTRIENTS.forEach(n => {
    const item = document.createElement('div');
    item.className = 'nutri-pick-item';
    item.innerHTML = `<span style="font-size:15px">${n.label}</span><span style="font-family:var(--mono);font-size:12px;color:var(--text3)">${n.unit}</span>`;
    item.onclick = () => showRanking(n);
    pickList.appendChild(item);
  });

  document.getElementById('nutri-stage-pick').style.display = 'block';
  document.getElementById('nutri-stage-rank').style.display = 'none';
  overlay.classList.add('open');
}

function openMealBreakdown(mealKey, allEntries) {
  const PIE_COLORS = [
    'var(--accent)', 'var(--blue)', 'var(--yellow)', 'var(--orange)',
    '#f97316', '#e879f9', 'var(--red)', '#a78bfa', '#34d399', '#fb7185',
  ];
  const BD_NUTRIENTS = [
    { key: 'calories',      label: 'Kcal', unit: 'kcal', color: 'var(--accent)' },
    { key: 'protein',       label: 'P',    unit: 'g',    color: 'var(--blue)'   },
    { key: 'carbs',         label: 'H',    unit: 'g',    color: 'var(--yellow)' },
    { key: 'fat',           label: 'G',    unit: 'g',    color: 'var(--orange)' },
    { key: 'saturated_fat', label: 'Gs',   unit: 'g',    color: '#f97316'       },
    { key: 'fiber',         label: 'Fb',   unit: 'g',    color: 'var(--accent)' },
    { key: 'sugar',         label: 'A',    unit: 'g',    color: '#e879f9'       },
  ];

  const mealLabel = (typeof MEALS !== 'undefined' && MEALS[mealKey]) || mealKey;
  const mes = allEntries.filter(e => e.meal === mealKey);
  // Stable color per entry (by original position in diary order)
  const entryColors = mes.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]);

  let activeNutrient = BD_NUTRIENTS[0];

  // ── Create overlay once ──────────────────────────────────────────────────
  let overlay = document.getElementById('meal-bd-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'meal-bd-overlay';
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet" style="max-height:80dvh;overflow-y:auto">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div style="flex:1;min-width:0">
            <div id="meal-bd-title" class="sheet-title"></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
            <div id="meal-bd-total" style="font-family:var(--mono);font-size:14px;font-weight:600"></div>
            <div class="sheet-close" id="meal-bd-close">×</div>
          </div>
        </div>
        <div id="meal-bd-chips" class="meal-bd-chips-row"></div>
        <div id="meal-bd-content" class="meal-bd-content"></div>
        <div style="padding:0 14px 8px">
          <button id="meal-bd-save-btn" class="btn btn-secondary" style="font-size:13px;padding:10px">
            Guardar como refeição
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
    document.getElementById('meal-bd-close').onclick = () => overlay.classList.remove('open');
  }

  document.getElementById('meal-bd-title').textContent = mealLabel.toUpperCase();

  // Wire "Guardar como refeição" — rebind every open so mes/mealLabel are fresh
  const saveBtn = document.getElementById('meal-bd-save-btn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      overlay.classList.remove('open');
      const prefillItems = mes.map(e => ({
        food_id:      e.food_id || null,
        food_name:    e.food_name,
        grams:        e.grams || 0,
        calories:     e.calories,
        protein:      e.protein,
        carbs:        e.carbs,
        fat:          e.fat,
        saturated_fat: e.saturated_fat || 0,
        sugar:        e.sugar || 0,
        fiber:        e.fiber || 0,
        _food:        e.food_id ? {
          id: e.food_id,
          calories_per_100g:      e.grams ? e.calories      / e.grams * 100 : 0,
          protein_per_100g:       e.grams ? e.protein       / e.grams * 100 : 0,
          carbs_per_100g:         e.grams ? e.carbs         / e.grams * 100 : 0,
          fat_per_100g:           e.grams ? e.fat           / e.grams * 100 : 0,
          saturated_fat_per_100g: e.grams ? (e.saturated_fat||0)/ e.grams * 100 : 0,
          sugar_per_100g:         e.grams ? (e.sugar||0)    / e.grams * 100 : 0,
          fiber_per_100g:         e.grams ? (e.fiber||0)    / e.grams * 100 : 0,
        } : null,
      }));
      openCreateMeal(mealLabel, prefillItems);
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function fmtVal(v, n) {
    return n.key === 'calories' ? Math.round(+(v || 0)) : (Math.round(+(v || 0) * 10) / 10);
  }

  function buildPieSVG(items, n) {
    const total = items.reduce((s, x) => s + x.value, 0);
    if (total === 0) return `<svg width="160" height="160" viewBox="0 0 160 160"><circle cx="80" cy="80" r="64" fill="var(--surface3)"/></svg>`;
    const cx = 80, cy = 80, r = 64, hole = 38;
    const centerVal = fmtVal(total, n);

    if (items.length === 1) {
      return `<svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="${items[0].color}" opacity="0.85"/>
        <circle cx="${cx}" cy="${cy}" r="${hole}" fill="var(--surface)"/>
        <text x="${cx}" y="${cy - 5}" text-anchor="middle" dominant-baseline="auto"
          font-size="17" font-weight="700" fill="var(--text)">${centerVal}</text>
        <text x="${cx}" y="${cy + 13}" text-anchor="middle" dominant-baseline="auto"
          font-size="10" fill="var(--text3)">${n.unit}</text>
      </svg>`;
    }

    let angle = -Math.PI / 2;
    let paths = '';
    items.forEach(item => {
      const slice = (item.value / total) * 2 * Math.PI;
      if (slice < 0.001) { return; }
      const endAngle = angle + slice;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const large = slice > Math.PI ? 1 : 0;
      paths += `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z"
        fill="${item.color}" opacity="0.85" class="meal-bd-slice"/>`;
      angle = endAngle;
    });

    return `<svg width="160" height="160" viewBox="0 0 160 160">
      ${paths}
      <circle cx="${cx}" cy="${cy}" r="${hole}" fill="var(--surface)"/>
      <text x="${cx}" y="${cy - 5}" text-anchor="middle" dominant-baseline="auto"
        font-size="17" font-weight="700" fill="var(--text)">${centerVal}</text>
      <text x="${cx}" y="${cy + 13}" text-anchor="middle" dominant-baseline="auto"
        font-size="10" fill="var(--text3)">${n.unit}</text>
    </svg>`;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function renderBD() {
    const n = activeNutrient;
    const total = mes.reduce((s, e) => s + +(e[n.key] || 0), 0);

    // Header total
    const totalEl = document.getElementById('meal-bd-total');
    totalEl.textContent = `${fmtVal(total, n)} ${n.unit}`;
    totalEl.style.color = n.color;

    // Chips active state
    document.querySelectorAll('.meal-bd-chip-btn').forEach(btn => {
      const active = btn.dataset.key === n.key;
      btn.classList.toggle('meal-bd-chip-active', active);
      btn.style.borderColor = active ? n.color : 'transparent';
      btn.style.color       = active ? n.color : '';
    });

    // Build sorted list (keep original index for color)
    const indexed = mes.map((e, i) => ({
      entry: e, color: entryColors[i], value: +(e[n.key] || 0),
    })).sort((a, b) => b.value - a.value);

    const maxVal = indexed.length > 0 ? indexed[0].value : 1;

    const listHTML = indexed.map(({ entry, color, value }) => {
      const pct  = total > 0 ? Math.round(value / total * 100) : 0;
      const barW = maxVal > 0 ? Math.round(value / maxVal * 100) : 0;
      return `
        <div class="meal-bd-food-row" data-id="${entry.id}">
          <div class="meal-bd-dot" style="background:${color}"></div>
          <div class="meal-bd-food-name">${entry.food_name}</div>
          <div class="meal-bd-bar-track">
            <div class="meal-bd-bar" style="width:${barW}%;background:${color}"></div>
          </div>
          <div class="meal-bd-food-val">${fmtVal(value, n)}</div>
          <div class="meal-bd-food-pct">${pct}%</div>
        </div>`;
    }).join('');

    const pieItems = indexed.map(({ entry, color, value }) => ({ name: entry.food_name, value, color }));

    const content = document.getElementById('meal-bd-content');
    content.innerHTML = `
      <div class="meal-bd-list">${listHTML}</div>
      <div class="meal-bd-pie">${buildPieSVG(pieItems, n)}</div>`;

    content.querySelectorAll('.meal-bd-food-row').forEach(row => {
      const id = +row.dataset.id;
      row.addEventListener('click', () => { overlay.classList.remove('open'); openEditEntry(id); });
    });
  }

  // ── Build chips (every open, in case overlay was reused) ─────────────────
  const chipsEl = document.getElementById('meal-bd-chips');
  chipsEl.innerHTML = BD_NUTRIENTS.map(n =>
    `<button class="meal-bd-chip-btn" data-key="${n.key}">${n.label}</button>`
  ).join('');
  chipsEl.querySelectorAll('.meal-bd-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeNutrient = BD_NUTRIENTS.find(n => n.key === btn.dataset.key);
      renderBD();
    });
  });

  activeNutrient = BD_NUTRIENTS[0];
  renderBD();
  overlay.classList.add('open');
}

function updateEditPreview() {
  if (!editingEntry) return;
  const g = parseFloat(document.getElementById('edit-grams').value) || 0;
  const orig = editingEntry.grams || 1;
  const factor = g / orig;
  const c = (v) => Math.round((parseFloat(v) || 0) * factor);
  document.getElementById('ep-kcal').textContent   = c(editingEntry.calories);
  document.getElementById('ep-fat').textContent    = c(editingEntry.fat);
  document.getElementById('ep-satfat').textContent = c(editingEntry.saturated_fat);
  document.getElementById('ep-carb').textContent   = c(editingEntry.carbs);
  document.getElementById('ep-sugar').textContent  = c(editingEntry.sugar);
  document.getElementById('ep-fiber').textContent  = c(editingEntry.fiber);
  document.getElementById('ep-prot').textContent   = c(editingEntry.protein);
}

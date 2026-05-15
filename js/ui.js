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

function openNutrientSheet(entries, nutrient) {
  let overlay = document.getElementById('nutri-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'nutri-overlay';
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet" style="max-height:80dvh">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button id="nutri-back" style="background:none;border:none;color:var(--text2);font-size:15px;cursor:pointer;padding:2px 0;font-family:var(--sans)">← Voltar</button>
          <div id="nutri-rank-title" class="sheet-title" style="flex:1;text-align:center;padding:0 8px"></div>
          <div class="sheet-close" id="nutri-close">×</div>
        </div>
        <div id="nutri-rank-list"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
    document.getElementById('nutri-close').onclick = () => overlay.classList.remove('open');
    document.getElementById('nutri-back').onclick  = () => overlay.classList.remove('open');
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
  }

  showRanking(nutrient);
  overlay.classList.add('open');
}

function openMealBreakdown(mealKey, allEntries) {
  const mealLabel = (typeof MEALS !== 'undefined' && MEALS[mealKey]) || mealKey;
  const mes = allEntries.filter(e => e.meal === mealKey);

  // Macro totals
  const totalKcal  = mes.reduce((s, e) => s + +(e.calories || 0), 0);
  const totalProt  = mes.reduce((s, e) => s + +(e.protein  || 0), 0);
  const totalCarbs = mes.reduce((s, e) => s + +(e.carbs    || 0), 0);
  const totalFat   = mes.reduce((s, e) => s + +(e.fat      || 0), 0);

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
          <div id="meal-bd-title" class="sheet-title"></div>
          <div class="sheet-close" id="meal-bd-close">×</div>
        </div>
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

  document.getElementById('meal-bd-title').textContent =
    `${mealLabel.toUpperCase()} · ${Math.round(totalKcal)} KCAL`;

  // Wire "Guardar como refeição" — rebind every open so mes/mealLabel are fresh
  const saveBtn = document.getElementById('meal-bd-save-btn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      overlay.classList.remove('open');
      const validEntries  = mes.filter(e => e.grams && +e.grams > 0);
      const skippedCount  = mes.length - validEntries.length;
      const prefillItems  = validEntries.map(e => ({
        food_id:       e.food_id || null,
        food_name:     e.food_name,
        grams:         e.grams,
        calories:      e.calories,
        protein:       e.protein,
        carbs:         e.carbs,
        fat:           e.fat,
        saturated_fat: e.saturated_fat || 0,
        sugar:         e.sugar || 0,
        fiber:         e.fiber || 0,
        _food:         e.food_id ? {
          id:                     e.food_id,
          calories_per_100g:      e.calories           / e.grams * 100,
          protein_per_100g:       e.protein            / e.grams * 100,
          carbs_per_100g:         e.carbs              / e.grams * 100,
          fat_per_100g:           e.fat                / e.grams * 100,
          saturated_fat_per_100g: (e.saturated_fat||0) / e.grams * 100,
          sugar_per_100g:         (e.sugar||0)         / e.grams * 100,
          fiber_per_100g:         (e.fiber||0)         / e.grams * 100,
          serving_size_g:         e.grams,
        } : null,
      }));
      if (skippedCount > 0) {
        toast(`${skippedCount} entrada${skippedCount > 1 ? 's' : ''} rápida${skippedCount > 1 ? 's' : ''} não incluída${skippedCount > 1 ? 's' : ''}`);
      }
      openCreateMeal(mealLabel, prefillItems);
    };
  }

  // ── Donut SVG (P/H/G in kcal space) ─────────────────────────────────────
  function buildMealDonut(protein, carbs, fat, kcal) {
    const p_kcal = protein * 4;
    const h_kcal = carbs   * 4;
    const g_kcal = fat     * 9;
    const total  = p_kcal + h_kcal + g_kcal || 1;
    const cx = 80, cy = 80, R = 70, r = 42;

    const centerText = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
      font-family="var(--mono)" font-size="16" font-weight="600" fill="var(--text)">${Math.round(kcal)}</text>`;

    const slices = [
      { kcal: p_kcal, color: 'var(--blue)'   },
      { kcal: h_kcal, color: 'var(--yellow)' },
      { kcal: g_kcal, color: 'var(--orange)' },
    ].filter(s => s.kcal > 0);

    if (slices.length === 0) {
      return `<svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="var(--surface3)"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--surface)"/>
        ${centerText}</svg>`;
    }

    if (slices.length === 1) {
      return `<svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="${slices[0].color}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--surface)"/>
        ${centerText}</svg>`;
    }

    let angle = -Math.PI / 2;
    let paths = '';
    slices.forEach(s => {
      const a   = (s.kcal / total) * 2 * Math.PI;
      const end = angle + a;
      const x1  = cx + R * Math.cos(angle),  y1  = cy + R * Math.sin(angle);
      const x2  = cx + R * Math.cos(end),    y2  = cy + R * Math.sin(end);
      const ix1 = cx + r * Math.cos(angle),  iy1 = cy + r * Math.sin(angle);
      const ix2 = cx + r * Math.cos(end),    iy2 = cy + r * Math.sin(end);
      const lg  = a > Math.PI ? 1 : 0;
      paths += `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${lg} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${r} ${r} 0 ${lg} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z" fill="${s.color}"/>`;
      angle = end;
    });

    return `<svg width="160" height="160" viewBox="0 0 160 160">${paths}${centerText}</svg>`;
  }

  // ── Legend ───────────────────────────────────────────────────────────────
  const p_kcal   = totalProt  * 4;
  const h_kcal   = totalCarbs * 4;
  const g_kcal   = totalFat   * 9;
  const macroTot = p_kcal + h_kcal + g_kcal || 1;
  const pct = kcal => Math.round(kcal / macroTot * 100);

  const legendHTML = `<div class="meal-donut-legend">
    <div class="meal-donut-legend-item">
      <span class="meal-donut-dot" style="background:var(--blue)"></span>
      <span>P ${Math.round(totalProt * 10) / 10}g ${pct(p_kcal)}%</span>
    </div>
    <div class="meal-donut-legend-item">
      <span class="meal-donut-dot" style="background:var(--yellow)"></span>
      <span>H ${Math.round(totalCarbs * 10) / 10}g ${pct(h_kcal)}%</span>
    </div>
    <div class="meal-donut-legend-item">
      <span class="meal-donut-dot" style="background:var(--orange)"></span>
      <span>G ${Math.round(totalFat * 10) / 10}g ${pct(g_kcal)}%</span>
    </div>
  </div>`;

  // ── Food list (sorted by calories DESC) ──────────────────────────────────
  const sorted = [...mes].sort((a, b) => +(b.calories || 0) - +(a.calories || 0));
  const foodListHTML = sorted.map(e => {
    const gramsStr = (e.grams != null && +e.grams > 0) ? `${Math.round(+e.grams)}g` : '—';
    return `<div class="meal-bd-food-row" data-id="${e.id}">
      <div class="meal-bd-food-name">${e.food_name}</div>
      <div class="meal-bd-food-meta">${gramsStr} &nbsp; ${Math.round(+(e.calories || 0))} kcal</div>
    </div>`;
  }).join('');

  // ── Render ───────────────────────────────────────────────────────────────
  document.getElementById('meal-bd-content').innerHTML = `
    <div style="display:flex;justify-content:center;padding:16px 0 0">
      ${buildMealDonut(totalProt, totalCarbs, totalFat, totalKcal)}
    </div>
    ${legendHTML}
    <div style="height:1px;background:var(--border);margin:0 0 4px"></div>
    <div>${foodListHTML}</div>`;

  document.querySelectorAll('#meal-bd-overlay .meal-bd-food-row').forEach(row => {
    const id = +row.dataset.id;
    row.addEventListener('click', () => { overlay.classList.remove('open'); openEditEntry(id); });
  });

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

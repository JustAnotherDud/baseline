// Escape de strings (nomes/brands de alimentos) interpoladas raw em innerHTML.
// NOTA: highlightFoodKeywords() já escapa internamente — não duplicar lá.
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastT, toastHideT;
function toast(msg) {
  const el = document.getElementById('toast');
  clearTimeout(toastT);
  clearTimeout(toastHideT);
  el.classList.remove('hiding');
  el.textContent = msg;
  el.classList.add('show');
  toastT = setTimeout(() => {
    el.classList.add('hiding');
    el.classList.remove('show');
    toastHideT = setTimeout(() => el.classList.remove('hiding'), 280);
  }, 2400);
}

// Sheet criado uma vez por id e reutilizado. Fecha no overlay e no ×.
// header: título (markup); body: conteúdo; onCreate corre só na criação.
function ensureSheet(id, { header = '', body = '', sheetStyle = '', zIndex, onCreate } = {}) {
  let overlay = document.getElementById(id);
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'sheet-overlay';
  if (zIndex) overlay.style.zIndex = zIndex;
  overlay.innerHTML = `
    <div class="sheet"${sheetStyle ? ` style="${sheetStyle}"` : ''}>
      <div class="sheet-handle"></div>
      <div class="sheet-header">${header}<div class="sheet-close">×</div></div>
      ${body}
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.classList.remove('open');
  overlay.onclick = e => { if (e.target === overlay) close(); };
  overlay.querySelector('.sheet-close').onclick = close;
  if (onCreate) onCreate(overlay);
  return overlay;
}

function overlayClose(e, id) { if(e.target.id===id) document.getElementById(id).classList.remove('open'); }

// ── MEAL SELECTORS (gerados a partir de currentMeals) ──────────────────────────
// Popula um <select> com as refeições do dia (+ "Nova refeição"; no topo com newFirst).
function populateMealSelect(selectEl, selectedId, newFirst = false) {
  if (!selectEl) return;
  const opts = currentMeals.map(m => `<option value="${m.id}">${escHtml(mealOptionText(m))}</option>`);
  const nw = '<option value="new">+ Nova refeição</option>';
  selectEl.innerHTML = (newFirst ? [nw, ...opts] : [...opts, nw]).join('');
  selectEl.value = String(selectedId);
  if (selectEl.value !== String(selectedId)) selectEl.value = 'new';
}

// ── TARA no sheet de edição ───────────────────────────────────────────────────
function setEditTaraUI(checked) {
  const box = document.getElementById('edit-tara-box');
  const lbl = document.getElementById('edit-tara-label');
  if (box) box.classList.toggle('checked', !!checked);
  if (lbl) lbl.classList.toggle('checked', !!checked);
}
function toggleEditTara() {
  const box = document.getElementById('edit-tara-box');
  setEditTaraUI(!(box && box.classList.contains('checked')));
}

function openLog(mode) {
  pushSheetState();
  resetLogTara();
  if (mealManuallySelected) populateMealSelect(document.getElementById('sheet-meal-select'), selectedMealId);
  else presetMealSelection();
  document.getElementById('log-sheet-title').textContent = mode==='db' ? 'Pesquisar alimento' : 'Entrada rápida';
  document.getElementById('log-db').style.display    = mode==='db'    ? 'block' : 'none';
  document.getElementById('log-quick').style.display = mode==='quick' ? 'block' : 'none';
  if (mode==='db') {
    document.getElementById('log-stage-search').classList.add('active');
    document.getElementById('log-stage-grams').classList.remove('active');
    document.getElementById('log-q').value='';
    document.getElementById('log-results').innerHTML='<div class="loading">Começa a escrever para pesquisar</div>';
    setTimeout(()=>document.getElementById('log-q').focus(),300);
  } else {
    clearQuick();
    setTimeout(()=>document.getElementById('q-name').focus(),300);
  }
  document.getElementById('sheet-log').classList.add('open');
}

function closeLog() {
  document.getElementById('sheet-log').classList.remove('open');
  selectedFood = null;
  mealManuallySelected = false;
  const infoEl = document.getElementById('dose-info');
  if (infoEl) infoEl.textContent = '';
}

// Botão "Grátis": preço 0 (custo conhecido, não "sem preço"). O input dispara os
// handlers de hint; gramas por defeito só se o campo estiver vazio.
function setFree(priceId, qtyId) {
  const p = document.getElementById(priceId);
  p.value = 0;
  if (qtyId) {
    const q = document.getElementById(qtyId);
    if (!(parseFloat(q.value) > 0)) q.value = 100;
  }
  p.dispatchEvent(new Event('input'));
}

function openAddFood() {
  pushSheetState();
  editingFoodId=null;
  document.getElementById('food-sheet-title').textContent='Novo alimento';
  document.getElementById('del-food-btn').style.display='none';
  ['f-name','f-brand','f-serving','f-kcal','f-prot','f-carb','f-fat','f-satfat','f-sugar','f-fiber','f-price-eur','f-price-qty'].forEach(id=>document.getElementById(id).value='');
  updateFoodPriceCalc();
  document.getElementById('sheet-food').classList.add('open');
  setTimeout(()=>document.getElementById('f-name').focus(),300);
}

function closeAddFood() {
  document.getElementById('sheet-food').classList.remove('open');
  editingFoodId = null;
  fromLogContext = false;
}

async function openEditEntry(id) {
  pushSheetState();
  if (!db) return;
  const { data, error } = await db.from('diary').select('*').eq('id', id).single();
  if (error || !data) return;
  editingEntry = data;
  editingEntry._resetPrice = false;

  setEditTaraUI(!!data.has_tara);

  const isQuick = !data.grams && data.grams !== 0;

  const card = document.getElementById('edit-food-card');
  card.innerHTML = '<div class="food-card-name"></div><div class="food-card-sub"></div>';
  card.querySelector('.food-card-name').textContent = data.food_name;
  card.querySelector('.food-card-sub').textContent = isQuick
    ? 'Entrada rápida'
    : 'Peso original: ' + numPt(data.grams) + ' g';
  // Atalho para o alimento (só entradas ligadas a um alimento).
  if (data.food_id && !isQuick) {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'food-card-link';
    link.textContent = 'Ver em Alimentos →';
    link.onclick = openFoodFromEntry;
    card.appendChild(link);
  }

  const gramsLabel = document.getElementById('edit-grams').closest('label');
  const previewEl  = document.getElementById('edit-preview');

  if (isQuick) {
    gramsLabel.style.display = 'none';
    previewEl.style.display  = 'none';
    document.getElementById('edit-price-block').style.display = 'none';

    let qf = document.getElementById('edit-quick-fields');
    if (!qf) {
      qf = document.createElement('div');
      qf.id = 'edit-quick-fields';
      qf.innerHTML = `
        <label><span class="lt">Calorias (kcal)</span><input type="number" id="eq-calories" inputmode="decimal" placeholder="0"></label>
        <label><span class="lt">PROT (g)</span><input type="number" id="eq-protein" inputmode="decimal" placeholder="0"></label>
        <label><span class="lt">CARBS (g)</span><input type="number" id="eq-carbs" inputmode="decimal" placeholder="0"></label>
        <label><span class="lt">FAT (g)</span><input type="number" id="eq-fat" inputmode="decimal" placeholder="0"></label>
        <label><span class="lt">Custo (€, opcional)</span><input type="number" id="eq-cost" inputmode="decimal" step="0.01" placeholder="—"></label>
        <button type="button" class="btn btn-secondary btn-sm" onclick="setFree('eq-cost')">Grátis (0 €)</button>
        <input type="hidden" id="eq-saturated_fat">
        <input type="hidden" id="eq-sugar">
        <input type="hidden" id="eq-fiber">`;
      previewEl.after(qf);
    }
    qf.style.display = 'block';

    document.getElementById('eq-calories').value = data.calories ?? '';
    document.getElementById('eq-protein').value  = data.protein  ?? '';
    document.getElementById('eq-carbs').value    = data.carbs    ?? '';
    document.getElementById('eq-fat').value      = data.fat      ?? '';
    document.getElementById('eq-cost').value     = data.cost_eur ?? '';
    // Preservar satfat/sugar/fibra (sem input visível) — senão saveEditEntry zera-os.
    document.getElementById('eq-saturated_fat').value = data.saturated_fat || 0;
    document.getElementById('eq-sugar').value  = data.sugar         || 0;
    document.getElementById('eq-fiber').value  = data.fiber         || 0;

    document.getElementById('sheet-edit').classList.add('open');
    setTimeout(() => document.getElementById('eq-calories').focus(), 300);
  } else {
    gramsLabel.style.display = '';
    previewEl.style.display  = '';
    const qf = document.getElementById('edit-quick-fields');
    if (qf) qf.style.display = 'none';
    document.getElementById('edit-price-block').style.display = '';
    fillEditPrice(data);

    const portionBtn = document.getElementById('edit-portion-btn');
    portionBtn.style.display = 'none';
    portionBtn.onclick = null;
    document.getElementById('edit-dose-info').textContent = '';

    if (data.food_id) {
      const { data: food } = await db.from('foods').select('serving_size_g,price_eur,price_qty_g').eq('id', data.food_id).single();
      editingEntry._food_price = food ? { price_eur: food.price_eur, price_qty_g: food.price_qty_g } : null;
      if (food && food.serving_size_g) {
        editingEntry._serving_size_g = food.serving_size_g;
        portionBtn.textContent = `+ porção (${numPt(food.serving_size_g)} g)`;
        portionBtn.style.display = '';
        portionBtn.onclick = () => {
          const input = document.getElementById('edit-grams');
          const current = parseFloat(input.value) || 0;
          input.value = current + food.serving_size_g;
          updateEditPreview();
        };
      } else {
        editingEntry._serving_size_g = null;
      }
    } else {
      editingEntry._serving_size_g = null;
    }

    document.getElementById('edit-grams').value = data.grams || '';
    updateEditPreview();
    document.getElementById('sheet-edit').classList.add('open');
    setTimeout(() => {
      const input = document.getElementById('edit-grams');
      if (input) { input.focus(); input.select(); }
    }, 300);
  }
}

// Preço pontual da entrada: pré-preenchido com o snapshot actual.
function fillEditPrice(data) {
  // Entrada com lote: o snapshot do preço do alimento fica na BD, mas o campo é só de preço pontual
  // (vazio por defeito: preenchê-lo cria um override e solta o lote).
  const promo = data.cost_source === 'promo';
  document.getElementById('edit-price-eur').value = promo ? '' : (data.price_eur ?? '');
  document.getElementById('edit-price-qty').value = promo ? '' : (data.price_qty_g ?? '');
  document.getElementById('edit-price-note').style.display = promo ? '' : 'none';
  const src = { default: 'preço do alimento', override: `preço ${PROMO_LABEL}`, manual: 'custo manual', promo: `stock ${PROMO_LABEL.toLowerCase()}` }[data.cost_source] || 'sem custo';
  document.getElementById('edit-price-hint').textContent = `${src} · ${formatEur(data.cost_eur)}`;
  if (data.cost_source === 'promo') loadPromoSplit(data);
}

function onEditPriceInput() {
  if (editingEntry) editingEntry._resetPrice = false;
  updateEditPreview();
}

// Volta ao default: ao guardar, limpa o override e recopia o preço actual do alimento.
function resetEditPrice() {
  const fp = editingEntry && editingEntry._food_price;
  if (!fp || fp.price_eur == null) { toast('O alimento não tem preço'); return; }
  editingEntry._resetPrice = true;
  document.getElementById('edit-price-eur').value = fp.price_eur;
  document.getElementById('edit-price-qty').value = fp.price_qty_g;
  document.getElementById('edit-price-hint').textContent = 'Ao guardar: usa o preço actual do alimento';
}

// Fecha o sheet da entrada e abre o editor do alimento em Comida → Alimentos.
// As alterações por guardar na entrada perdem-se, como em qualquer fecho do sheet.
function openFoodFromEntry() {
  const id = editingEntry && editingEntry.food_id;
  if (!id) return;
  closeEditEntry();
  pendingFoodEdit = id;
  switchFoodsTab('foods');
  go('foods');
}

function closeEditEntry() {
  document.getElementById('sheet-edit').classList.remove('open');
  editingEntry = null;
}

async function openDatePicker(selectedVal, onSelect, opts = {}) {
  pushSheetState();
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DAYS   = ['S','T','Q','Q','S','S','D'];
  const today  = localDate();

  const overlay = ensureSheet('dp-overlay', {
    zIndex: 300,
    sheetStyle: 'max-height:420px',
    header: `
    <div style="display:flex;align-items:center;gap:8px">
      <button id="dp-prev" style="background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer;padding:4px 10px;line-height:1">←</button>
      <div id="dp-label" class="sheet-title" style="min-width:150px;text-align:center"></div>
      <button id="dp-next" style="background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer;padding:4px 10px;line-height:1">→</button>
    </div>`,
    body: `
    <div style="padding:10px 14px 20px">
      <div id="dp-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center"></div>
    </div>`,
  });

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
    if (opts.showScores !== false) {
      try { dayScores = await getDayScores(viewYear, viewMonth); } catch {}
    }
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
      const dotHTML = (opts.showScores !== false) && score !== undefined
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

  render();
  overlay.classList.add('open');
}

function openNutrientSheet(entries, nutrient) {
  pushSheetState();
  const overlay = ensureSheet('nutri-overlay', {
    sheetStyle: 'max-height:80dvh',
    header: `<div id="nutri-rank-title" class="sheet-title"></div>`,
    body: `
    <div id="nutri-rank-list"></div>`,
  });

  function showRanking(n) {
    const r   = v => Math.round(+(v || 0) * 10) / 10;
    const fmt = v => n.key === 'calories' ? Math.round(v) : numPt(r(v));

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
      `${n.label} — ${fmt(total)} ${n.unit} total`;

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
        const meal = currentMeals.find(m => m.id === e.meal_id);
        return `<div class="nutri-rank-sub">
          <span class="nutri-rank-sub-meal">${escHtml(meal ? mealLabel(meal) : '—')}</span>
          <span class="nutri-rank-sub-val">${fmt(+(e[n.key] || 0))} ${n.unit}</span>
        </div>`;
      }).join('') : '';

      item.innerHTML = `
        <div class="nutri-rank-top" style="${multi ? 'cursor:pointer' : ''}">
          <div style="display:flex;align-items:center;gap:5px;flex:1;min-width:0">
            <div class="nutri-rank-name"></div>
            ${multi ? `<span style="font-family:var(--mono);font-size:10px;color:var(--text3);background:var(--surface3);padding:1px 5px;border-radius:10px;flex-shrink:0">×${count}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <div class="nutri-rank-val" style="color:${n.color}">${fmt(val)} ${n.unit}</div>
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
      item.querySelector('.nutri-rank-name').textContent = name;

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

function openMealBreakdown(mealId, allEntries) {
  pushSheetState();
  const meal = currentMeals.find(m => m.id === mealId);
  const mealTitle = meal ? mealLabel(meal) : 'Refeição';
  const mes = allEntries.filter(e => e.meal_id === mealId);
  let selectedMacro = null;

  // Macro totals
  const totalKcal  = mes.reduce((s, e) => s + +(e.calories || 0), 0);
  const totalProt  = mes.reduce((s, e) => s + +(e.protein  || 0), 0);
  const totalCarbs = mes.reduce((s, e) => s + +(e.carbs    || 0), 0);
  const totalFat   = mes.reduce((s, e) => s + +(e.fat      || 0), 0);

  // ── Create overlay once ──────────────────────────────────────────────────
  const overlay = ensureSheet('meal-bd-overlay', {
    sheetStyle: 'max-height:80dvh;overflow-y:auto',
    header: `<div id="meal-bd-title" class="sheet-title"></div>`,
    body: `
    <div id="meal-bd-content" class="meal-bd-content"></div>
    <div style="padding:0 14px 8px">
      <button id="meal-bd-save-btn" class="btn btn-secondary" style="font-size:13px;padding:10px">
        Guardar como modelo
      </button>
    </div>`,
  });

  document.getElementById('meal-bd-title').textContent =
    `${mealTitle.toUpperCase()} · ${Math.round(totalKcal)} KCAL`;

  // Wire "Guardar como modelo" — rebind every open so mes/mealTitle are fresh
  document.getElementById('meal-bd-save-btn').onclick = () => {
    overlay.classList.remove('open');
    const validEntries  = mes.filter(e => e.grams && +e.grams > 0);
    const skippedCount  = mes.length - validEntries.length;
    const prefillItems  = validEntries.map(e => ({
      food_id:       e.food_id || null,
      food_name:     e.food_name,
      grams:         e.grams,
      ...mapNutrients(k => SECONDARY_NUTRIENTS.includes(k) ? e[k] || 0 : e[k]),
      // Alimento reconstruído do snapshot, para mcGramsChange poder reescalar.
      _food:         e.food_id ? {
        id: e.food_id,
        ...Object.fromEntries(NUTRIENTS.map(k => [k + '_per_100g', (e[k] || 0) / e.grams * 100])),
        serving_size_g: e.grams,
      } : null,
    }));
    if (skippedCount > 0) {
      toast(`${skippedCount} entrada${skippedCount > 1 ? 's' : ''} rápida${skippedCount > 1 ? 's' : ''} não incluída${skippedCount > 1 ? 's' : ''}`);
    }
    openCreateMeal(mealTitle, prefillItems);
  };

  // ── Donut SVG (F/C/P in kcal space) ─────────────────────────────────────
  function buildMealDonut(protein, carbs, fat, kcal) {
    const p_kcal = protein * 4;
    const h_kcal = carbs   * 4;
    const g_kcal = fat     * 9;
    const total  = p_kcal + h_kcal + g_kcal || 1;
    const cx = 80, cy = 80, R = 70, r = 42, labelR = 56;

    const centerText = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
      font-family="var(--mono)" font-size="16" font-weight="600" fill="var(--text)">${Math.round(kcal)}</text>`;

    const slices = [
      { kcal: g_kcal, color: 'var(--orange)', macro: 'fat',     label: 'F' },
      { kcal: h_kcal, color: 'var(--yellow)', macro: 'carbs',   label: 'C' },
      { kcal: p_kcal, color: 'var(--blue)',   macro: 'protein', label: 'P' },
    ].filter(s => s.kcal > 0);

    if (slices.length === 0) {
      return `<svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="var(--surface3)"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--surface)"/>
        ${centerText}</svg>`;
    }

    if (slices.length === 1) {
      return `<svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="${slices[0].color}" data-macro="${slices[0].macro}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--surface)"/>
        <text x="${cx}" y="${cy - labelR}" text-anchor="middle" dominant-baseline="central" font-family="var(--mono)" font-size="12" font-weight="600" fill="#0a0a0a">${slices[0].label}</text>
        ${centerText}</svg>`;
    }

    let angle = -Math.PI / 2;
    let paths = '', labels = '';
    slices.forEach(s => {
      const a   = (s.kcal / total) * 2 * Math.PI;
      const end = angle + a;
      const x1  = cx + R * Math.cos(angle),  y1  = cy + R * Math.sin(angle);
      const x2  = cx + R * Math.cos(end),    y2  = cy + R * Math.sin(end);
      const ix1 = cx + r * Math.cos(angle),  iy1 = cy + r * Math.sin(angle);
      const ix2 = cx + r * Math.cos(end),    iy2 = cy + r * Math.sin(end);
      const lg  = a > Math.PI ? 1 : 0;
      paths += `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${lg} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${r} ${r} 0 ${lg} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z" fill="${s.color}" data-macro="${s.macro}"/>`;
      if (s.kcal / total > 0.15) {
        const mid = angle + a / 2;
        const lx  = cx + labelR * Math.cos(mid);
        const ly  = cy + labelR * Math.sin(mid);
        labels += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-family="var(--mono)" font-size="12" font-weight="600" fill="#0a0a0a">${s.label}</text>`;
      }
      angle = end;
    });

    return `<svg width="160" height="160" viewBox="0 0 160 160">${paths}${labels}${centerText}</svg>`;
  }

  // ── Legend ───────────────────────────────────────────────────────────────
  const p_kcal   = totalProt  * 4;
  const h_kcal   = totalCarbs * 4;
  const g_kcal   = totalFat   * 9;
  const macroTot = p_kcal + h_kcal + g_kcal || 1;
  const pct = kcal => Math.round(kcal / macroTot * 100);

  const legendHTML = `<div class="meal-donut-legend">
    <div class="meal-donut-legend-item">
      <span class="meal-donut-dot" style="background:var(--orange)"></span>
      <span>F ${numPt(Math.round(totalFat * 10) / 10)} g ${pct(g_kcal)}%</span>
    </div>
    <div class="meal-donut-legend-item">
      <span class="meal-donut-dot" style="background:var(--yellow)"></span>
      <span>C ${numPt(Math.round(totalCarbs * 10) / 10)} g ${pct(h_kcal)}%</span>
    </div>
    <div class="meal-donut-legend-item">
      <span class="meal-donut-dot" style="background:var(--blue)"></span>
      <span>P ${numPt(Math.round(totalProt * 10) / 10)} g ${pct(p_kcal)}%</span>
    </div>
  </div>`;

  // ── Food list (sorted by calories DESC) ──────────────────────────────────
  function updateDonutSelection() {
    document.querySelectorAll('#meal-bd-content svg [data-macro]').forEach(el => {
      el.style.opacity = selectedMacro === null || el.dataset.macro === selectedMacro ? '1' : '0.3';
    });
  }

  function renderFoodList() {
    const foodListEl = document.getElementById('meal-bd-food-list');
    if (!foodListEl) return;
    const MACRO_COLORS = { protein: 'var(--blue)', carbs: 'var(--yellow)', fat: 'var(--orange)' };
    const sortKey = selectedMacro || 'calories';
    const sorted = [...mes].sort((a, b) => +(b[sortKey] || 0) - +(a[sortKey] || 0));
    foodListEl.innerHTML = '';
    sorted.forEach(e => {
      const row = document.createElement('div');
      row.className = 'meal-bd-food-row';
      row.dataset.id = e.id;
      const nameEl = document.createElement('div');
      nameEl.className = 'meal-bd-food-name';
      nameEl.textContent = e.food_name;
      const metaEl = document.createElement('div');
      metaEl.className = 'meal-bd-food-meta';
      if (selectedMacro) {
        const val = e[selectedMacro];
        const valStr = val != null ? `${numPt(Math.round(+val * 10) / 10, 1)} g` : '—';
        const kcal = Math.round(+(e.calories || 0));
        metaEl.innerHTML = `<span style="color:${MACRO_COLORS[selectedMacro]}">${valStr}</span><span style="color:var(--text3)"> · ${kcal} kcal</span>`;
      } else {
        const gramsStr = (e.grams != null && +e.grams > 0) ? `${Math.round(+e.grams)} g` : '—';
        metaEl.textContent = `${gramsStr}   ${Math.round(+(e.calories || 0))} kcal`;
      }
      row.appendChild(nameEl);
      row.appendChild(metaEl);
      row.addEventListener('click', () => { overlay.classList.remove('open'); openEditEntry(+e.id); });
      foodListEl.appendChild(row);
    });
  }

  const contentEl = document.getElementById('meal-bd-content');
  contentEl.innerHTML = `
    <div style="display:flex;justify-content:center;padding:16px 0 0">
      ${buildMealDonut(totalProt, totalCarbs, totalFat, totalKcal)}
    </div>
    ${legendHTML}
    <div style="height:1px;background:var(--border);margin:0 0 4px"></div>
    <div id="meal-bd-food-list"></div>`;

  contentEl.querySelector('svg').addEventListener('click', ev => {
    const path = ev.target.closest('[data-macro]');
    selectedMacro = path ? (selectedMacro === path.dataset.macro ? null : path.dataset.macro) : null;
    updateDonutSelection();
    renderFoodList();
  });

  renderFoodList();
  overlay.classList.add('open');
}

function updateEditPreview() {
  if (!editingEntry) return;
  const g = parseGramsExpr(document.getElementById('edit-grams').value) || 0;
  const orig = editingEntry.grams || 1;
  const factor = g / orig;
  const c = (v) => Math.round((parseFloat(v) || 0) * factor);
  document.getElementById('ep-kcal').textContent  = c(editingEntry.calories);
  document.getElementById('ep-fat').textContent   = c(editingEntry.fat);
  document.getElementById('ep-carb').textContent  = c(editingEntry.carbs);
  document.getElementById('ep-prot').textContent  = c(editingEntry.protein);
  // Pré-visualização do stock promo; override e custo manual da entrada não consomem lote.
  const ov = editPricePatch(editingEntry, document.getElementById('edit-price-eur').value,
    document.getElementById('edit-price-qty').value, !!editingEntry._resetPrice);
  const fixed = !editingEntry._resetPrice && ['override', 'manual'].includes(editingEntry.cost_source);
  const unchanged = g === +editingEntry.grams;   // sem mudança o split já está na linha do preço: não repetir
  showPromoPreview('edit-promo-preview', editingEntry.food_id, editingEntry.date, g, editingEntry.id,
    unchanged || fixed || ov.cost_source === 'override' || !!ov.error);
  const serving = editingEntry._serving_size_g;
  if (serving) {
    const infoEl = document.getElementById('edit-dose-info');
    if (infoEl) infoEl.textContent = g > 0 ? `${numPt(g / serving, 1)}×` : '';
  }
}

function openMoveMealSheet(entryId, currentMealId) {
  pushSheetState();
  const overlay = ensureSheet('move-meal-overlay', {
    header: `<div class="sheet-title">Mover para refeição</div>`,
    body: `
    <div id="move-meal-list"></div>`,
  });

  const list = document.getElementById('move-meal-list');
  list.innerHTML = '';
  const rows = currentMeals.map(m => ({ id: m.id, text: mealOptionText(m) }))
    .concat([{ id: 'new', text: '+ Nova refeição' }]);
  rows.forEach(({ id, text }) => {
    const isCurrent = id === currentMealId;
    const row = document.createElement('div');
    row.className = 'mais-item';
    row.style.cursor = isCurrent ? 'default' : 'pointer';
    if (isCurrent) row.style.color = 'var(--text3)';
    const labelEl = document.createElement('div');
    labelEl.className = 'mais-item-label';
    labelEl.textContent = text;
    const arrowEl = document.createElement('div');
    arrowEl.className = 'mais-item-arrow';
    arrowEl.textContent = isCurrent ? '✓' : '→';
    row.appendChild(labelEl);
    row.appendChild(arrowEl);
    if (!isCurrent) {
      row.addEventListener('click', async () => {
        overlay.classList.remove('open');
        const target = id === 'new' ? await createMeal(currentDate) : id;
        if (target == null) return;
        const ok = await moveEntryToMeal(entryId, target);
        if (ok) { toast('Movido'); document.getElementById('sheet-edit').classList.remove('open'); loadToday(); }
      });
    }
    list.appendChild(row);
  });

  overlay.classList.add('open');
}

// ── SHEET DA REFEIÇÃO: nome, hora, remover se vazia ──────────────────────────
// mealId null = criar (botão "+ refeição"). A hora ordena as refeições do dia: por defeito é a da
// 1.ª entrada; muda-se aqui (ex.: registar à noite o que se vai beber de manhã).
function openMealSheet(mealId) {
  pushSheetState();
  const overlay = ensureSheet('meal-edit-overlay', {
    zIndex: 230,
    header: `<div id="meal-edit-title" class="sheet-title"></div>`,
    body: `
    <div class="form-body">
      <label><span class="lt">Nome (opcional)</span><input type="text" id="meal-edit-name" maxlength="40" autocomplete="off" placeholder="ex: Pós-treino"></label>
      <label><span class="lt">Hora</span><input type="time" id="meal-edit-time"></label>
      <div id="meal-edit-hint" class="cost-hint"></div>
      <button class="btn btn-primary" id="meal-edit-save">Guardar</button>
      <button class="btn btn-secondary" id="meal-edit-detail" style="display:none">Ver detalhe</button>
      <button class="btn btn-danger" id="meal-edit-del" style="display:none">Eliminar refeição vazia</button>
    </div>`,
  });
  const m = mealId == null ? null : currentMeals.find(x => x.id === mealId);
  if (mealId != null && !m) return;
  const isToday = currentDate === localDate();
  document.getElementById('meal-edit-title').textContent = m ? mealLabel(m).toUpperCase() : 'NOVA REFEIÇÃO';
  document.getElementById('meal-edit-name').value = m && m.name ? m.name : '';
  document.getElementById('meal-edit-time').value = m ? fmtHM(m.sort_at) : (isToday ? fmtHM(new Date().toISOString()) : '');
  document.getElementById('meal-edit-hint').textContent = m
    ? (m.started_at ? 'Hora definida por ti' : 'Hora da 1.ª entrada: muda-a se registaste fora de horas')
    : (isToday ? '' : 'Indica a hora: é ela que ordena as refeições do dia');
  document.getElementById('meal-edit-save').onclick = () => saveMealSheet(mealId);
  const detail = document.getElementById('meal-edit-detail');
  detail.style.display = m && m.n_entries > 0 ? '' : 'none';
  detail.onclick = () => { overlay.classList.remove('open'); openMealBreakdown(mealId, diaryEntries); };
  const del = document.getElementById('meal-edit-del');
  del.style.display = m && m.n_entries === 0 ? '' : 'none';   // só vazia (a BD recusa o resto: ON DELETE RESTRICT)
  del.onclick = () => deleteEmptyMeal(mealId);
  overlay.classList.add('open');
}

let _savingMealSheet = false;
async function saveMealSheet(mealId) {
  if (_savingMealSheet) return;
  _savingMealSheet = true;
  try {
    const name = document.getElementById('meal-edit-name').value.trim() || null;
    const hm = document.getElementById('meal-edit-time').value;
    if (mealId == null) {
      const startedAt = hm ? hmToTimestamp(currentDate, hm) : null;
      if (currentDate !== localDate() && !startedAt) { toast('Indica a hora da refeição'); return; }
      const id = await createMeal(currentDate, name, startedAt);
      if (id == null) return;
      selectedMealId = id;
    } else {
      const m = currentMeals.find(x => x.id === mealId);
      const patch = { name };
      if (m && hm !== fmtHM(m.sort_at)) patch.started_at = hm ? hmToTimestamp(m.date, hm) : null;
      const { error } = await db.from('meals').update(patch).eq('id', mealId);
      if (error) { toast('Erro ao guardar refeição'); return; }
    }
    document.getElementById('meal-edit-overlay').classList.remove('open');
    loadToday();
  } finally {
    _savingMealSheet = false;
  }
}

async function deleteEmptyMeal(mealId) {
  const { error } = await db.from('meals').delete().eq('id', mealId);
  if (error) { toast('Só se elimina uma refeição vazia'); return; }
  document.getElementById('meal-edit-overlay').classList.remove('open');
  toast('Refeição eliminada');
  loadToday();
}

function highlightFoodKeywords(name) {
  const KEYWORDS = [
    { word: 'Light',    color: 'var(--text3)'  },
    { word: 'Integral', color: '#a3845a'        },
    { word: 'Proteico', color: 'var(--blue)'    },
    { word: 'Proteica', color: 'var(--blue)'    },
    { word: 'Zero',     color: 'var(--text3)'   },
  ];
  const escaped = name.replace(/[<>&"]/g, c =>
    ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const pattern = new RegExp(
    `(${KEYWORDS.map(k => k.word).join('|')})`, 'gi');
  return escaped.replace(pattern, match => {
    const kw = KEYWORDS.find(k =>
      k.word.toLowerCase() === match.toLowerCase());
    return kw
      ? `<span style="color:${kw.color};font-weight:600">${match}</span>`
      : match;
  });
}

// ── SHARED: MEAL TEMPLATE LIST ───────────────────────────────────────────────
// opts: { showDelete: bool, onItemClick: fn(t), onDeleteClick?: fn(id) }
function renderMealTemplateList(containerEl, templates, countMap, opts) {
  containerEl.innerHTML = '';
  templates.forEach(t => {
    const n = countMap.get(t.id) || 0;
    const sub = n === 1 ? '1 alimento' : `${n} alimentos`;
    const row = document.createElement('div');
    row.className = 'meal-tpl-row';
    row.innerHTML = `
      <div class="meal-tpl-info">
        <div class="meal-tpl-name"></div>
        <div class="meal-tpl-sub">${sub}</div>
      </div>
      ${opts.showDelete
        ? '<button class="meal-tpl-del">✕</button>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>'}`;
    row.querySelector('.meal-tpl-name').textContent = t.name;
    if (opts.showDelete) {
      row.querySelector('.meal-tpl-info').addEventListener('click', () => opts.onItemClick(t));
      row.querySelector('.meal-tpl-del').addEventListener('click', e => { e.stopPropagation(); opts.onDeleteClick(t.id); });
    } else {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => opts.onItemClick(t));
    }
    containerEl.appendChild(row);
  });
}

function insertOperator(inputId, op) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.value = (el.value || '').toString().trimEnd() + op;
  el.focus();
  el.dispatchEvent(new Event('input'));
}

function evalGramsInput(inputId, previewFn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const result = parseGramsExpr(input.value);
  if (result !== null && result > 0) {
    input.value = result;
    if (previewFn) previewFn();
  }
}

function parseGramsExpr(raw) {
  if (!raw || !raw.toString().trim()) return null;
  const str = raw.toString().trim();
  if (!/^[\d\s\+\*\/\(\)\.\-]+$/.test(str)) {
    return parseFloat(str) || null;
  }
  try {
    const result = Function('"use strict"; return (' + str + ')')();
    if (typeof result !== 'number' || !isFinite(result) || result < 0) {
      return null;
    }
    return Math.round(result * 10) / 10;
  } catch {
    return null;
  }
}

// Promoções: lotes de produtos comprados em promoção (Mais → Promoções), stock promo nos alimentos,
// pré-visualização do custo no registo e detalhe do split numa entrada.
// A BD consome os lotes e calcula o custo (ver sync_hub 20261008_promo_lots.sql); aqui só se mostra e se pede.

let promoStock = new Map();   // food_id -> gramas promo abertas

async function fetchPromoStock() {
  if (!db) return new Map();
  const { data, error } = await db.from('v_promo_lot').select('food_id,grams_left').eq('is_open', true);
  return error ? new Map() : promoStockMap(data);
}

async function refreshPromoStock() {
  promoStock = await fetchPromoStock();
}

// ── Lista ───────────────────────────────────────────────────────────────────

async function loadPromo() {
  if (!db) return;
  const el = document.getElementById('promo-list');
  const { data, error } = await db.from('v_promo_lot').select('*')
    .eq('is_open', true).order('bought_on').order('id');
  if (error) {
    el.innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'empty-state';
    msg.textContent = 'Erro ao carregar promoções.';
    el.appendChild(msg);
    return;
  }
  promoStock = promoStockMap(data);
  const n = data.length;
  document.getElementById('promo-sub').textContent = n ? `${n} lote${n !== 1 ? 's' : ''} aberto${n !== 1 ? 's' : ''}` : '';
  el.innerHTML = '';
  if (!n) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🏷️</div><div class="empty-text">Sem lotes abertos.<br>Clica em + para criar um.</div></div>';
    return;
  }
  const { data: foods } = await db.from('foods').select('id,price_qty_g').in('id', [...new Set(data.map(l => l.food_id))]);
  const pack = new Map((foods || []).map(f => [f.id, +f.price_qty_g]));
  const mixed = new Set(data.map(l => (l.store || '').trim().toLowerCase())).size > 1;
  data.forEach(l => el.appendChild(promoLotEl(l, pack.get(l.food_id), mixed)));
}

function promoLotEl(l, packG, mixed) {
  const m = promoListModel(l, packG, mixed);
  const div = document.createElement('div');
  div.className = 'promo-row';
  div.onclick = () => openPromoDetail(l);
  const span = (cls, text) => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  };
  const top = document.createElement('div');
  top.className = 'promo-row-top';
  const name = span('promo-row-name', m.name);
  if (m.store) name.appendChild(span('promo-row-store', m.store));
  top.appendChild(name);
  top.appendChild(span('promo-row-left', m.left));
  const bottom = document.createElement('div');
  bottom.className = 'promo-row-bottom';
  const bar = document.createElement('div');
  bar.className = 'promo-bar';
  const fill = document.createElement('div');
  fill.style.width = m.pct.toFixed(1) + '%';
  bar.appendChild(fill);
  bottom.appendChild(bar);
  bottom.appendChild(span('promo-row-unit', m.unit));
  div.appendChild(top);
  div.appendChild(bottom);
  return div;
}

// ── Detalhe / fechar / eliminar ─────────────────────────────────────────────

let promoActionLot = null;
let _promoActing = false;

function openPromoDetail(lot) {
  pushSheetState();
  promoActionLot = lot;
  const overlay = ensureSheet('promo-detail-overlay', {
    header: '<div class="sheet-title" id="promo-detail-title"></div>',
    body: `
    <div style="padding:14px 20px 20px;display:flex;flex-direction:column;gap:6px">
      <div class="promo-lot-left price" id="promo-detail-left"></div>
      <div class="promo-lot-line" id="promo-detail-paid"></div>
      <div class="promo-lot-line" id="promo-detail-saving"></div>
      <div class="promo-lot-line" id="promo-detail-meta"></div>
      <div class="promo-lot-warn" id="promo-detail-warn"></div>
      <div class="promo-lot-actions">
        <button class="btn btn-secondary btn-sm" style="flex:1" onclick="submitPromoAction('close')">Fechar lote</button>
        <button class="btn btn-danger btn-sm" style="flex:1" id="promo-detail-delete" onclick="submitPromoAction('delete')">Eliminar</button>
      </div>
    </div>`,
  });
  const m = promoLotModel(lot);
  const set = (id, t) => { document.getElementById(id).textContent = t; };
  set('promo-detail-title', m.title);
  set('promo-detail-left', 'restam ' + m.left);
  set('promo-detail-paid', m.paid);
  set('promo-detail-saving', m.saving);
  set('promo-detail-meta', m.meta);
  set('promo-detail-warn', m.warns.length ? '⚠ ' + m.warns.join(' · ') : '');
  document.getElementById('promo-detail-delete').style.display = m.canDelete ? '' : 'none';
  overlay.classList.add('open');
}

async function submitPromoAction(mode) {
  if (_promoActing || !promoActionLot) return;
  const m = promoLotModel(promoActionLot);
  const ask = mode === 'delete'
    ? `Eliminar o lote ${m.title}? Desaparece por completo.`
    : `Fechar o lote ${m.title}? Abate o que resta (${m.left}); o custo das entradas já registadas fica.`;
  if (!confirm(ask)) return;
  const call = mode === 'delete'
    ? () => db.rpc('promo_delete', { p_lot_id: promoActionLot.id, p_reason: null })
    : () => db.rpc('promo_writeoff', { p_lot_id: promoActionLot.id, p_grams: null, p_reason: null });
  _promoActing = true;
  try {
    const { error } = await call();
    if (error) { toast(error.message); return; }
    document.getElementById('promo-detail-overlay').classList.remove('open');
    toast(mode === 'delete' ? 'Lote eliminado' : 'Lote fechado');
    loadPromo();
  } finally {
    _promoActing = false;
  }
}

// ── Novo lote ───────────────────────────────────────────────────────────────

let promoNewFood = null;
let promoRefTouched = false;
let _promoSearchT = null;
let _promoCreating = false;

function openPromoNew() {
  pushSheetState();
  promoNewFood = null;
  promoRefTouched = false;
  const overlay = ensureSheet('promo-new-overlay', {
    header: '<div class="sheet-title">Novo lote</div>',
    sheetStyle: 'max-height:90dvh;overflow-y:auto',
    body: `
    <div style="padding:0 20px 20px;display:flex;flex-direction:column;gap:14px">
      <label><span class="lt">Alimento</span>
        <input type="text" id="pn-q" placeholder="pesquisar…" autocomplete="off" oninput="promoSearchDebounced()"></label>
      <div id="pn-results"></div>
      <div id="pn-food" class="cost-hint"></div>
      <label><span class="lt">Gramas compradas</span>
        <input type="number" id="pn-grams" inputmode="decimal" placeholder="0" oninput="promoSuggestRef()"></label>
      <div class="r2">
        <label><span class="lt">Pago (€)</span><input type="number" id="pn-paid" inputmode="decimal" step="0.01" placeholder="0,00"></label>
        <label><span class="lt">Preço normal (€)</span><input type="number" id="pn-ref" inputmode="decimal" step="0.01" placeholder="0,00" oninput="promoRefTouched = true"></label>
      </div>
      <div class="cost-hint">Preço normal = o que as mesmas gramas custariam sem promoção. Pontos de cartão contam como dinheiro.</div>
      <label><span class="lt">Data de compra</span><input type="date" id="pn-date"></label>
      <label><span class="lt">Loja</span><input type="text" id="pn-store" autocomplete="off"></label>
      <label><span class="lt">Nota</span><input type="text" id="pn-note" autocomplete="off"></label>
      <label><span class="lt">Validade (opcional)</span><input type="date" id="pn-bb"></label>
      <button class="btn btn-primary" id="pn-save" onclick="savePromoNew()">Criar lote</button>
    </div>`,
  });
  ['pn-q', 'pn-grams', 'pn-paid', 'pn-ref', 'pn-store', 'pn-note', 'pn-bb'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('pn-date').value = localDate();
  document.getElementById('pn-results').innerHTML = '';
  document.getElementById('pn-food').textContent = '';
  overlay.classList.add('open');
}

function promoSearchDebounced() {
  clearTimeout(_promoSearchT);
  _promoSearchT = setTimeout(promoSearch, 300);
}

async function promoSearch() {
  const q = document.getElementById('pn-q').value.trim().toLowerCase();
  const res = document.getElementById('pn-results');
  res.innerHTML = '';
  if (!q) return;
  const { data, error } = await db.rpc('foods_search', { p_query: q, p_limit: 8 });
  if (error) { toast('Erro ao pesquisar'); return; }
  (data || []).forEach(f => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-secondary btn-sm';
    b.style.cssText = 'justify-content:flex-start;text-align:left;margin-bottom:6px';
    b.textContent = f.name + (f.brand ? ' · ' + f.brand : '') + foodPriceLabel(f);
    b.onclick = () => promoPickFood(f);
    res.appendChild(b);
  });
}

function promoPickFood(f) {
  if (f.price_eur == null) { toast('Este alimento não tem preço: define-o primeiro em Comida'); return; }
  promoNewFood = f;
  document.getElementById('pn-results').innerHTML = '';
  document.getElementById('pn-q').value = '';
  document.getElementById('pn-food').textContent = '✓ ' + f.name + (f.brand ? ' · ' + f.brand : '') + foodPriceLabel(f);
  promoSuggestRef();
}

function promoSuggestRef() {
  if (promoRefTouched) return;
  const s = promoRefSuggestion(promoNewFood, document.getElementById('pn-grams').value);
  if (s !== null) document.getElementById('pn-ref').value = s;
}

async function savePromoNew() {
  if (_promoCreating) return;
  const v = id => document.getElementById(id).value;
  const p = promoLotPayload({
    food: promoNewFood, grams: v('pn-grams'), paid: v('pn-paid'), ref: v('pn-ref'),
    date: v('pn-date'), store: v('pn-store'), note: v('pn-note'), best_before: v('pn-bb'),
  });
  if (p.error) { toast(p.error); return; }
  _promoCreating = true;
  try {
    const { error } = await db.from('promo_lots').insert(p);
    if (error) { toast(error.message); return; }
    document.getElementById('promo-new-overlay').classList.remove('open');
    toast('Lote criado ✓');
    loadPromo();
  } finally {
    _promoCreating = false;
  }
}

// ── Registo e edição de entradas ────────────────────────────────────────────

// "X g do stock promo, Y €" por baixo das gramas, antes de gravar. Mesmo plano do trigger (promo_plan).
// skip: preço pontual ou custo manual na entrada (não consome lote). Debounce de 250 ms.
let promoPreviewT = null;
let promoPreviewGen = 0;
function showPromoPreview(elId, foodId, dateStr, grams, excludeId, skip) {
  const el = document.getElementById(elId);
  if (!el) return;
  clearTimeout(promoPreviewT);
  const gen = ++promoPreviewGen;
  if (skip || !db || !foodId || !(grams > 0)) { el.textContent = ''; return; }
  promoPreviewT = setTimeout(async () => {
    const { data, error } = await db.rpc('promo_preview', {
      p_food_id: foodId, p_date: dateStr, p_grams: grams, p_exclude_diary_id: excludeId,
    });
    if (gen !== promoPreviewGen) return;
    el.textContent = error ? '' : promoPreviewText(data);
  }, 250);
}

// Split de uma entrada promo no sheet de edição: "700 g do stock promo (0,41 €) + 300 g ao preço normal (0,30 €)".
async function loadPromoSplit(entry) {
  const { data } = await db.from('v_diary_promo').select('grams,cost_eur').eq('diary_id', entry.id);
  if (!editingEntry || editingEntry.id !== entry.id || editingEntry._resetPrice) return;
  const t = promoSplitText(entry, data);
  if (t) document.getElementById('edit-price-hint').textContent = `${t} = ${formatEur(entry.cost_eur)}`;
}

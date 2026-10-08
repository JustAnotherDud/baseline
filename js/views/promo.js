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
  data.forEach(l => el.appendChild(promoLotEl(l)));
}

function promoLotEl(l) {
  const m = promoLotModel(l);
  const div = document.createElement('div');
  div.className = 'promo-lot';
  const line = (cls, text) => {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    return d;
  };
  const head = document.createElement('div');
  head.className = 'promo-lot-head';
  head.appendChild(line('promo-lot-name', m.title));
  head.appendChild(line('promo-lot-left price', m.left));
  div.appendChild(head);
  div.appendChild(line('promo-lot-line', m.paid));
  div.appendChild(line('promo-lot-line', m.saving));
  if (m.meta) div.appendChild(line('promo-lot-line', m.meta));
  if (m.warns.length) div.appendChild(line('promo-lot-warn', '⚠ ' + m.warns.join(' · ')));
  const actions = document.createElement('div');
  actions.className = 'promo-lot-actions';
  [['Abater', 'writeoff', 'btn btn-secondary btn-sm'], ['Apagar', 'delete', 'btn btn-danger btn-sm']].forEach(([label, mode, cls]) => {
    const b = document.createElement('button');
    b.className = cls;
    b.style.flex = '1';
    b.textContent = label;
    b.onclick = () => openPromoAction(l, mode);
    actions.appendChild(b);
  });
  div.appendChild(actions);
  return div;
}

// ── Abater / apagar ─────────────────────────────────────────────────────────

let promoActionLot = null;
let promoActionMode = 'writeoff';
let _promoActing = false;

function openPromoAction(lot, mode) {
  pushSheetState();
  promoActionLot = lot;
  promoActionMode = mode;
  const overlay = ensureSheet('promo-action-overlay', {
    header: '<div class="sheet-title" id="promo-action-title"></div>',
    body: `
    <div style="padding:0 20px 20px;display:flex;flex-direction:column;gap:14px">
      <div id="promo-action-info" class="cost-hint"></div>
      <label id="promo-action-grams-wrap"><span class="lt">Gramas a abater (vazio = tudo o que resta)</span>
        <input type="number" id="promo-action-grams" inputmode="decimal" placeholder="tudo"></label>
      <label><span class="lt">Motivo (opcional)</span>
        <input type="text" id="promo-action-reason" placeholder="ex.: o meu irmão comeu 2 de 4" autocomplete="off"></label>
      <button class="btn btn-primary" id="promo-action-go" onclick="submitPromoAction()"></button>
    </div>`,
  });
  const m = promoLotModel(lot);
  const del = mode === 'delete';
  document.getElementById('promo-action-title').textContent = (del ? 'Apagar lote · ' : 'Abater do lote · ') + m.title;
  document.getElementById('promo-action-info').textContent = del
    ? `Restam ${m.left}. Sem consumos o lote some; com consumos fecha (o custo das entradas fica).`
    : `Restam ${m.left}. Não conta como poupança nem muda entradas já registadas.`;
  document.getElementById('promo-action-grams-wrap').style.display = del ? 'none' : '';
  document.getElementById('promo-action-grams').value = '';
  document.getElementById('promo-action-reason').value = '';
  const go = document.getElementById('promo-action-go');
  go.textContent = del ? 'Apagar lote' : 'Abater';
  go.className = del ? 'btn btn-danger' : 'btn btn-primary';
  overlay.classList.add('open');
}

async function submitPromoAction() {
  if (_promoActing || !promoActionLot) return;
  const reason = document.getElementById('promo-action-reason').value.trim() || null;
  let call;
  if (promoActionMode === 'delete') {
    call = () => db.rpc('promo_delete', { p_lot_id: promoActionLot.id, p_reason: reason });
  } else {
    const raw = document.getElementById('promo-action-grams').value.trim();
    const g = raw === '' ? null : parseFloat(raw);
    if (g !== null && !(g > 0)) { toast('Gramas inválidas'); return; }
    call = () => db.rpc('promo_writeoff', { p_lot_id: promoActionLot.id, p_grams: g, p_reason: reason });
  }
  _promoActing = true;
  try {
    const { error } = await call();
    if (error) { toast(error.message); return; }
    document.getElementById('promo-action-overlay').classList.remove('open');
    toast(promoActionMode === 'delete' ? 'Lote apagado' : 'Abatido');
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

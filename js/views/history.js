// Histórico: uma linha por dia (v_day_totals), do mais recente para o mais antigo, em blocos de
// HISTORY_PAGE linhas (um intervalo >= 3 dias sem registo já vem colapsado numa só linha, por
// isso um bloco são 30 linhas, não 30 dias). Cursor: `date` da última linha carregada.

const HISTORY_PAGE = 30;
let histRows = [];
let histEnd = false;
let loadHistoryGen = 0;

function fetchHistory(limit, before) {
  let q = db.from('v_day_totals').select('*').order('date', { ascending: false }).limit(limit);
  if (before) q = q.lt('date', before);
  return q;
}

// Recarrega o que já está carregado (no mínimo 30 linhas): o refresh não perde o scroll.
async function loadHistory() {
  if (!db) return;
  const gen = ++loadHistoryGen;
  const limit = Math.max(HISTORY_PAGE, histRows.length);
  const { data, error } = await fetchHistory(limit);
  if (gen !== loadHistoryGen) return;
  if (error) { toast('Erro ao carregar histórico'); return; }
  histRows = data || [];
  histEnd = histRows.length < limit;
  renderHistory();
}

async function loadMoreHistory() {
  if (!db || histEnd || !histRows.length) return;
  const gen = ++loadHistoryGen;
  const { data, error } = await fetchHistory(HISTORY_PAGE, histRows[histRows.length - 1].date);
  if (gen !== loadHistoryGen) return;
  if (error) { toast('Erro ao carregar histórico'); return; }
  histRows = histRows.concat(data || []);
  if ((data || []).length < HISTORY_PAGE) histEnd = true;
  renderHistory();
}

function historyRowHtml(r) {
  const m = historyRowModel(r);
  if (m.gap) return `<div class="hist-row hist-gap">${escHtml(m.title)}</div>`;
  const dim = m.dimNums ? ' hist-dim' : '';
  const cov = m.cov ? ` <span class="hist-cov">${escHtml(m.cov)}</span>` : '';
  const tags = m.tags.map(t => `<span class="hist-tag">${escHtml(t)}</span>`).join('');
  return `<div class="hist-row hist-tap" role="button" tabindex="0" onclick="openHistoryDay('${escHtml(m.key)}')">
    <div class="hist-l1">
      <span class="hist-date">${escHtml(m.title)}</span>
      <span class="hist-num${dim}">${escHtml(m.kcal)}</span>
      <span class="hist-num${dim}">${escHtml(m.delta)}</span>
      <span class="hist-num${m.costDim ? ' hist-dim' : ''}">${escHtml(m.cost)}${cov}</span>
    </div>
    <div class="hist-l2"><span class="hist-macros">${escHtml(m.macros)}</span><span class="hist-tags">${tags}</span></div>
  </div>`;
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const foot = document.getElementById('history-foot');
  if (!list || !foot) return;
  if (!histRows.length) {
    list.innerHTML = '';
    foot.innerHTML = '<div class="stats-empty">Sem registos.</div>';
    return;
  }
  list.innerHTML = histRows.map(historyRowHtml).join('');
  foot.innerHTML = histEnd
    ? `<div class="hist-end">Início do registo: ${escHtml(histDdMm(histRows[histRows.length - 1].date_from))}</div>`
    : '<button class="btn btn-secondary" onclick="loadMoreHistory()">Carregar mais</button>';
}

// Tocar numa linha abre o diário desse dia.
function openHistoryDay(date) {
  currentDate = date;
  setDateLabel();
  go('today');
}

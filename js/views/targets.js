let currentTargetsDate  = localDate();
let refreshTargetsGen   = 0;

const TARGET_FIELD_IDS = ['t-kcal','t-fat','t-carb','t-fiber','t-prot'];

// Data da prova: muda-se à mão. As semanas até lá (T) calculam-se sempre.
const PORTO_MARATHON_DATE = '2026-11-08';

async function loadTargetsForm() {
  currentTargetsDate = localDate();
  updateTargetsDateLabel();
  await refreshTargets();
}

function updateTargetsDateLabel() {
  const el = document.getElementById('targets-date-btn');
  if (!el) return;
  const today = localDate();
  const d     = new Date(currentTargetsDate + 'T12:00:00');
  const label = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  el.textContent = currentTargetsDate === today ? `Hoje — ${label}` : label;
}

function weeksToPorto() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const race  = new Date(PORTO_MARATHON_DATE + 'T00:00:00');
  return Math.round((race - today) / (7 * 86400000));
}

function updateCountdownBadge() {
  const el = document.getElementById('countdown-badge');
  if (!el) return;
  const T = weeksToPorto();
  el.textContent = T >= 0 ? `T-${T}` : `T+${-T}`;
  el.classList.remove('countdown-badge-empty');
}

// Blocos da forma actual de blocks_active (plans/039 fase 3): `core_kcal` e
// `activity_kcal_by_id` (uma entrada por actividade). O resto fica de fora.
function deriveBlocks(blocksActive) {
  const chips = [];
  let sum = 0;

  const core = +blocksActive.core_kcal;
  if (core > 0) {
    sum += core;
    chips.push({ label: 'Núcleo', value: core });
  }

  const byId = blocksActive.activity_kcal_by_id;
  if (byId && typeof byId === 'object') {
    const entries = Object.entries(byId);
    entries.forEach(([activityId, kcal]) => {
      const n = +kcal;
      if (!(n > 0)) return;
      sum += n;
      chips.push({ label: entries.length > 1 ? `Atividade ${activityId}` : 'Atividade', value: n });
    });
  }

  return { chips, sum: Math.round(sum) };
}

// O SE do gasto medido ronda 130 kcal (plans/036): mostrar kcal com mais
// precisão que isso é falsa exactidão. Baseline e gasto a 50, margem a 10.
const roundTo = (n, step) => Math.round(n / step) * step;

// Janela normal de current_trend_weight_adaptive (primeiro valor do default).
// Só serve de recurso para linhas sem `lookback_expanded` no diagnóstico.
const NORMAL_LOOKBACK_DAYS = 56;

// Notas de contexto energético a partir de blocks_active.energy_diag.
function energyNotes(diag) {
  if (!diag || typeof diag !== 'object') return [];
  const notes = [];

  const exp = +diag.expenditure_estimate_kcal;
  if (Number.isFinite(exp)) {
    const se = +diag.expenditure_se_kcal;
    const margin = Number.isFinite(se) && se > 0 ? ` ±${roundTo(se, 10)}` : '';
    const days = diag.lookback_days_used;
    const logged = diag.days_logged_in_window;
    const win = days ? ` · janela ${days}d (${logged ?? '—'}d logados)` : '';
    notes.push(`Gasto medido ${roundTo(exp, 50)}${margin} kcal/dia${win}`);
  } else if (diag.energy_source === 'modeled_fallback') {
    notes.push('Energia por fallback modelado — sem dias suficientes de diário para medir o gasto.');
  }

  // Ingestão registada dos 7 dias anteriores (sem hoje) contra o gasto medido.
  const d7 = diag.intake_7d_delta_kcal;
  if (d7 != null && Number.isFinite(+d7)) {
    const n = roundTo(+d7, 10);
    notes.push(`Ingestão 7d ${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} kcal face ao gasto`);
  }

  // unallocated > 0 é bug do backend: mostrar.
  const unalloc = +diag.unallocated_kcal;
  if (Number.isFinite(unalloc) && unalloc > 0) {
    notes.push(`⚠ ${unalloc} kcal descartadas na composição de macros — não devia acontecer.`);
  }
  if (diag.floors_conflict === true || diag.floors_conflict === 'true') {
    notes.push('⚠ Piso de hidratos e piso de gordura em conflito — gordura ficou no mínimo.');
  }
  return notes;
}

async function refreshTargets() {
  const gen = ++refreshTargetsGen;
  document.getElementById('targets-loading').style.display = 'block';
  document.getElementById('targets-display').style.opacity = '0.4';

  updateCountdownBadge();

  const targetsResult = db
    ? await db.from('daily_targets').select('*').eq('date', currentTargetsDate).maybeSingle()
    : { data: null };

  if (gen !== refreshTargetsGen) return;

  const row = (targetsResult && targetsResult.data) || null;

  document.getElementById('targets-loading').style.display = 'none';
  document.getElementById('targets-display').style.opacity = '1';

  const hint       = document.getElementById('targets-hint');
  const blocksEl   = document.getElementById('targets-blocks');
  const chipsEl    = document.getElementById('targets-blocks-chips');
  const warningEl  = document.getElementById('targets-blocks-warning');
  const noteEl     = document.getElementById('targets-energy-note');
  const pushTime   = document.getElementById('targets-push-time');
  const coverageEl = document.getElementById('targets-coverage-badge');

  // Tudo o que é opcional começa escondido; cada parte mostra-se se tiver dados.
  const show = (el, display = 'block') => { el.style.display = display; };
  [hint, blocksEl, warningEl, noteEl, pushTime, coverageEl].forEach(el => show(el, 'none'));

  if (!row) {
    TARGET_FIELD_IDS.forEach(id => { document.getElementById(id).textContent = '—'; });
    hint.textContent = 'Sem alvo para esta data.';
    show(hint);
    return;
  }

  // Só a forma actual (energy_diag com energy_delta_kcal) mostra blocos e notas;
  // datas antigas mostram o total e as macros.
  const blocks = row.blocks_active;
  const diag = blocks?.energy_diag ?? null;
  const currentShape = !!diag && Object.hasOwn(diag, 'energy_delta_kcal');
  const lookbackDays = diag?.lookback_days_used;
  const loggedDays   = diag?.days_logged_in_window;

  // Badge só quando a janela foi alargada para além da normal (56d é o normal).
  const expanded = diag?.lookback_expanded ?? (Number.isFinite(lookbackDays) ? lookbackDays > NORMAL_LOOKBACK_DAYS : false);
  if (currentShape && expanded === true && Number.isFinite(lookbackDays)) {
    coverageEl.textContent = `Estimativa alargada a ${lookbackDays}d (${loggedDays ?? '—'}d logados)`;
    show(coverageEl, 'inline-block');
  }

  document.getElementById('t-kcal').textContent  = Number.isFinite(+row.calories) && row.calories != null ? roundTo(+row.calories, 50) : '—';
  document.getElementById('t-fat').textContent   = row.fat      ?? '—';
  document.getElementById('t-carb').textContent  = row.carbs    ?? '—';
  document.getElementById('t-fiber').textContent = row.fiber    ?? '—';
  document.getElementById('t-prot').textContent  = row.protein  ?? '—';

  const { chips, sum } = currentShape ? deriveBlocks(blocks) : { chips: [] };
  if (chips.length) {
    chipsEl.innerHTML = '';
    chips.forEach(({ label, value }) => {
      const chip = document.createElement('span');
      chip.className = 'block-chip';
      chip.textContent = `${label} ${Math.round(value)}kcal`;
      chipsEl.appendChild(chip);
    });
    show(blocksEl);

    // A soma dos blocos fecha com o total. Soma != total indica dupla contagem;
    // 15kcal de folga para o arredondamento dos macros.
    const calories = +row.calories;
    const diff = Number.isFinite(calories) ? sum - calories : 0;
    if (Math.abs(diff) > 15) {
      warningEl.textContent =
        `⚠ Blocos somam ${sum}kcal contra uma baseline de ${calories}kcal ` +
        `(${diff > 0 ? '+' : ''}${diff}kcal). Os dois deviam fechar — ` +
        `possível dupla contagem ou bloco em falta.`;
      show(warningEl);
    }

    const notes = energyNotes(diag);
    if (notes.length) {
      noteEl.innerHTML = '';
      notes.forEach((text) => {
        const line = document.createElement('div');
        line.textContent = text;
        noteEl.appendChild(line);
      });
      show(noteEl);
    }
  }

  // Push de outro dia mostra também a data.
  if (row.updated_at) {
    const pushDate = new Date(row.updated_at);
    const hhmm     = pushDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const isToday  = pushDate.toLocaleDateString('pt-PT') === new Date().toLocaleDateString('pt-PT');
    const ddmm     = pushDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
    pushTime.textContent = isToday ? `Push às ${hhmm}` : `Push a ${ddmm} às ${hhmm}`;
    show(pushTime);
  }
}

async function onTargetsDateChange(dateStr) {
  currentTargetsDate = dateStr;
  updateTargetsDateLabel();
  await refreshTargets();
}

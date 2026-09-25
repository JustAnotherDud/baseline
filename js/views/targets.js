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

// Bloco de kcal = chave de topo terminada em `_kcal`, mais `activity_kcal_by_id`
// (uma entrada por actividade). O resto de blocks_active fica de fora.
const BLOCK_LABELS = {
  baseline_kcal: 'Baseline',
  work_kcal: 'Trabalho',
  gym_kcal: 'Ginásio',
};
// Ordem de apresentação; chaves desconhecidas vão para o fim.
const BLOCK_ORDER = ['baseline_kcal', 'work_kcal', 'gym_kcal', 'activity_kcal_by_id'];

function blockLabel(key) {
  if (BLOCK_LABELS[key]) return BLOCK_LABELS[key];
  const bare = key.replace(/_kcal$/, '').replace(/_/g, ' ');
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

function deriveBlocks(blocksActive) {
  const chips = [];
  let sum = 0;

  const keys = Object.keys(blocksActive).sort((a, b) => {
    const ia = BLOCK_ORDER.indexOf(a), ib = BLOCK_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  for (const key of keys) {
    const value = blocksActive[key];

    if (key === 'activity_kcal_by_id' && value && typeof value === 'object') {
      const activityEntries = Object.entries(value);
      activityEntries.forEach(([activityId, kcal]) => {
        const n = +kcal;
        if (!(n > 0)) return;
        sum += n;
        const label = activityEntries.length > 1
          ? `Actividade ${activityId}`
          : 'Actividade';
        chips.push({ label, value: n });
      });
      continue;
    }

    if (!key.endsWith('_kcal')) continue;
    const n = +value;
    if (!(n > 0)) continue;
    sum += n;
    chips.push({ label: blockLabel(key), value: n });
  }

  return { chips, sum: Math.round(sum) };
}

// Notas de contexto energético a partir de blocks_active.energy_diag.
function energyNotes(diag) {
  if (!diag || typeof diag !== 'object') return [];
  const notes = [];

  const exp = +diag.expenditure_estimate_kcal;
  if (Number.isFinite(exp)) {
    const se = +diag.expenditure_se_kcal;
    const margin = Number.isFinite(se) && se > 0 ? ` ±${Math.round(se)}` : '';
    const days = diag.lookback_days_used;
    const logged = diag.days_logged_in_window;
    const win = days ? ` · janela ${days}d (${logged ?? '—'}d logados)` : '';
    notes.push(`Gasto medido ${Math.round(exp)}${margin} kcal/dia${win}`);
  } else if (diag.energy_source === 'modeled_fallback') {
    notes.push('Energia por fallback modelado — sem dias suficientes de diário para medir o gasto.');
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
    hint.textContent = 'Sem target para esta data. Pede ao DCB para fazer push dos blocos de hoje.';
    show(hint);
    return;
  }

  // Linhas antigas têm o diagnóstico no topo de blocks_active.
  const blocks = row.blocks_active;
  const diag = blocks?.energy_diag ?? null;
  const lookbackDays = diag?.lookback_days_used ?? blocks?.energy_lookback_days_used;
  const loggedDays   = diag?.days_logged_in_window ?? blocks?.energy_days_logged_in_window;

  // Badge só quando a janela passou dos 28d normais.
  if (Number.isFinite(lookbackDays) && lookbackDays > 28) {
    coverageEl.textContent = `Estimativa alargada a ${lookbackDays}d (${loggedDays ?? '—'}d logados)`;
    show(coverageEl, 'inline-block');
  }

  document.getElementById('t-kcal').textContent  = row.calories ?? '—';
  document.getElementById('t-fat').textContent   = row.fat      ?? '—';
  document.getElementById('t-carb').textContent  = row.carbs    ?? '—';
  document.getElementById('t-fiber').textContent = row.fiber    ?? '—';
  document.getElementById('t-prot').textContent  = row.protein  ?? '—';

  const { chips, sum } = blocks && typeof blocks === 'object' ? deriveBlocks(blocks) : { chips: [] };
  if (chips.length) {
    chipsEl.innerHTML = '';
    chips.forEach(({ label, value }) => {
      const chip = document.createElement('span');
      chip.className = 'block-chip';
      chip.textContent = `${label} ${Math.round(value)}kcal`;
      chipsEl.appendChild(chip);
    });
    show(blocksEl);

    // Só linhas com baseline_kcal fecham a soma com o total. Soma != total
    // indica dupla contagem; 15kcal de folga para o arredondamento dos macros.
    const calories = +row.calories;
    const diff = Object.hasOwn(blocks, 'baseline_kcal') && Number.isFinite(calories) ? sum - calories : 0;
    if (Math.abs(diff) > 15) {
      warningEl.textContent =
        `⚠ Blocos somam ${sum}kcal contra um target de ${calories}kcal ` +
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

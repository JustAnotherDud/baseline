let currentTargetsDate  = new Date().toISOString().split('T')[0];
let currentPhase        = null;

const TARGET_FIELD_IDS = ['t-kcal','t-fat','t-satfat','t-carb','t-sugar','t-fiber','t-prot'];

async function loadTargetsForm() {
  currentTargetsDate = new Date().toISOString().split('T')[0];
  updateTargetsDateLabel();
  // Enforce read-only on all numeric fields
  TARGET_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.readOnly = true;
  });
  await refreshPhaseAndTargets();
}

function updateTargetsDateLabel() {
  const el = document.getElementById('targets-date-btn');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const d     = new Date(currentTargetsDate + 'T12:00:00');
  const label = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  el.textContent = currentTargetsDate === today ? `Hoje — ${label}` : label;
}

async function refreshPhaseAndTargets() {
  document.getElementById('targets-loading').style.display = 'block';
  document.getElementById('targets-display').style.opacity = '0.4';

  // 1. Badge de fase (mantém — informativo)
  currentPhase = await getActivePhase(currentTargetsDate);
  updatePhaseBadge();

  // 2. Lê daily_targets para a data seleccionada
  let row = null;
  if (db) {
    const { data } = await db
      .from('daily_targets')
      .select('*')
      .eq('date', currentTargetsDate)
      .maybeSingle();
    row = data || null;
  }

  document.getElementById('targets-loading').style.display = 'none';
  document.getElementById('targets-display').style.opacity = '1';

  const hint       = document.getElementById('targets-hint');
  const blocksEl   = document.getElementById('targets-blocks');
  const blocksDetail = document.getElementById('targets-blocks-detail');
  const pushTime   = document.getElementById('targets-push-time');

  if (row) {
    // ── Com target ──────────────────────────────────────────────
    document.getElementById('t-kcal').value   = row.calories      ?? 0;
    document.getElementById('t-fat').value    = row.fat           ?? 0;
    document.getElementById('t-satfat').value = row.saturated_fat ?? 0;
    document.getElementById('t-carb').value   = row.carbs         ?? 0;
    document.getElementById('t-sugar').value  = row.sugar         ?? 0;
    document.getElementById('t-fiber').value  = row.fiber         ?? 0;
    document.getElementById('t-prot').value   = row.protein       ?? 0;

    // Blocos activos
    if (row.blocks_active && typeof row.blocks_active === 'object') {
      const BLOCK_LABELS = {
        base:      'base',
        trabalho:  'trabalho',
        ginasio:   'ginásio',
        surplus:   'surplus',
        deficit:   'défice',
      };
      const parts = Object.entries(row.blocks_active)
        .filter(([, v]) => +v > 0)
        .map(([k, v]) => `${BLOCK_LABELS[k] || k} ${Math.round(+v)}kcal`);
      if (parts.length) {
        blocksDetail.textContent = parts.join(' · ');
        blocksEl.style.display = 'block';
      } else {
        blocksEl.style.display = 'none';
      }
    } else {
      blocksEl.style.display = 'none';
    }

    // Push time
    if (row.updated_at) {
      const d = new Date(row.updated_at);
      const hhmm = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      pushTime.textContent = `Push às ${hhmm}`;
      pushTime.style.display = 'block';
    } else {
      pushTime.style.display = 'none';
    }

    if (hint) hint.style.display = 'none';

  } else {
    // ── Sem target ───────────────────────────────────────────────
    TARGET_FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = 0;
    });
    blocksEl.style.display   = 'none';
    pushTime.style.display   = 'none';
    if (hint) {
      hint.textContent = 'Sem target para esta data. Pede ao DCB para fazer push dos blocos de hoje.';
      hint.style.display = 'block';
    }
  }
}

function updatePhaseBadge() {
  const el = document.getElementById('phase-badge');
  if (!el) return;
  if (currentPhase) {
    el.textContent = `${currentPhase.label.toUpperCase()}${currentPhase.objetivo ? ' · ' + currentPhase.objetivo : ''}`;
    el.classList.remove('phase-badge-empty');
  } else {
    el.textContent = 'Sem fase configurada';
    el.classList.add('phase-badge-empty');
  }
}

async function onTargetsDateChange(dateStr) {
  currentTargetsDate = dateStr;
  updateTargetsDateLabel();
  await refreshPhaseAndTargets();
}

let currentTargetsDate  = new Date().toISOString().split('T')[0];
let currentPhase        = null;
let refreshPhaseGen     = 0;

const TARGET_FIELD_IDS = ['t-kcal','t-fat','t-carb','t-fiber','t-prot'];

async function loadTargetsForm() {
  currentTargetsDate = new Date().toISOString().split('T')[0];
  updateTargetsDateLabel();
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
  const gen = ++refreshPhaseGen;
  document.getElementById('targets-loading').style.display = 'block';
  document.getElementById('targets-display').style.opacity = '0.4';

  // Fase + daily_targets em paralelo
  const [phase, targetsResult] = await Promise.all([
    getActivePhase(currentTargetsDate),
    db
      ? db.from('daily_targets').select('*').eq('date', currentTargetsDate).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (gen !== refreshPhaseGen) return;

  currentPhase = phase;
  updatePhaseBadge();
  const row = (targetsResult && targetsResult.data) || null;

  document.getElementById('targets-loading').style.display = 'none';
  document.getElementById('targets-display').style.opacity = '1';

  const hint     = document.getElementById('targets-hint');
  const blocksEl = document.getElementById('targets-blocks');
  const pushTime = document.getElementById('targets-push-time');

  if (row) {
    // ── Com target ──────────────────────────────────────────────
    document.getElementById('t-kcal').textContent  = row.calories ?? '—';
    document.getElementById('t-fat').textContent   = row.fat      ?? '—';
    document.getElementById('t-carb').textContent  = row.carbs    ?? '—';
    document.getElementById('t-fiber').textContent = row.fiber    ?? '—';
    document.getElementById('t-prot').textContent  = row.protein  ?? '—';

    // Blocos activos — chips
    const chipsEl = document.getElementById('targets-blocks-chips');
    if (row.blocks_active && typeof row.blocks_active === 'object' && chipsEl) {
      const BLOCK_LABELS = {
        base:    'Base',
        work:    'Trabalho',
        gym:     'Ginásio',
        run:     'Corrida',
        surplus: 'Surplus',
      };
      const entries = Object.entries(row.blocks_active).filter(([, v]) => +v > 0);
      if (entries.length) {
        chipsEl.innerHTML = '';
        entries.forEach(([k, v]) => {
          const chip = document.createElement('span');
          chip.className = 'block-chip';
          chip.textContent = `${BLOCK_LABELS[k] || k} ${Math.round(+v)}kcal`;
          chipsEl.appendChild(chip);
        });
        blocksEl.style.display = 'block';
      } else {
        blocksEl.style.display = 'none';
      }
    } else {
      blocksEl.style.display = 'none';
    }

    // Push time — mostra data quando o push não é de hoje
    if (row.updated_at) {
      const pushDate = new Date(row.updated_at);
      const hhmm     = pushDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      const isToday  = pushDate.toLocaleDateString('pt-PT') === new Date().toLocaleDateString('pt-PT');
      if (isToday) {
        pushTime.textContent = `Push às ${hhmm}`;
      } else {
        const ddmm = pushDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
        pushTime.textContent = `Push a ${ddmm} às ${hhmm}`;
      }
      pushTime.style.display = 'block';
    } else {
      pushTime.style.display = 'none';
    }

    if (hint) hint.style.display = 'none';

  } else {
    // ── Sem target ───────────────────────────────────────────────
    TARGET_FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
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

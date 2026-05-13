let currentTargetsDate  = new Date().toISOString().split('T')[0];
let currentPhase        = null;
let currentPhaseTargets = null;

const TARGET_FIELD_IDS = ['t-kcal','t-fat','t-satfat','t-carb','t-sugar','t-fiber','t-prot'];

async function loadTargetsForm() {
  currentTargetsDate = new Date().toISOString().split('T')[0];
  updateTargetsDateLabel();

  // Enforce read-only on all target inputs
  TARGET_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.readOnly = true;
    el.style.cursor = 'default';
  });

  const dayType = localStorage.getItem('nt_day_type') || 'training_plus_work';
  document.getElementById('day-type-select').value = dayType;

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

  currentPhase = await getActivePhase(currentTargetsDate);
  updatePhaseBadge();

  const dayType       = document.getElementById('day-type-select').value;
  currentPhaseTargets = currentPhase ? await getPhaseTargets(currentPhase.id, dayType) : null;

  document.getElementById('targets-loading').style.display = 'none';
  document.getElementById('targets-display').style.opacity = '1';

  fillTargetFields(currentPhaseTargets);
  updateConfirmButton();
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

function fillTargetFields(t) {
  document.getElementById('t-kcal').value   = t ? t.calories      : 0;
  document.getElementById('t-fat').value    = t ? t.fat           : 0;
  document.getElementById('t-satfat').value = t ? t.saturated_fat : 0;
  document.getElementById('t-carb').value   = t ? t.carbs         : 0;
  document.getElementById('t-sugar').value  = t ? t.sugar         : 0;
  document.getElementById('t-fiber').value  = t ? t.fiber         : 0;
  document.getElementById('t-prot').value   = t ? t.protein       : 0;

  const hint = document.getElementById('targets-hint');
  if (!hint) return;
  if (!currentPhase) {
    hint.textContent = 'Sem fase configurada para esta data.';
    hint.style.display = 'block';
  } else if (!t) {
    hint.textContent = `Sem targets configurados para este tipo de dia na ${currentPhase.label}.`;
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

function updateConfirmButton() {
  const btn = document.getElementById('save-targets-btn');
  if (!btn) return;
  const hasTargets   = !!(currentPhase && currentPhaseTargets);
  btn.style.display  = currentPhase ? 'block' : 'none';
  btn.disabled       = !hasTargets;
  btn.style.opacity  = hasTargets ? '1' : '0.4';
  btn.textContent    = currentPhase ? `Confirmar dia · ${currentPhase.label}` : '';
}

async function onDayTypeChange() {
  const dayType = document.getElementById('day-type-select').value;
  localStorage.setItem('nt_day_type', dayType);
  await refreshPhaseAndTargets();
}

async function onTargetsDateChange(dateStr) {
  currentTargetsDate = dateStr;
  updateTargetsDateLabel();
  await refreshPhaseAndTargets();
}

async function confirmDayTargets() {
  if (!currentPhase || !currentPhaseTargets) return;
  const dayType = document.getElementById('day-type-select').value;
  const t       = currentPhaseTargets;
  const { error } = await db.from('daily_targets').upsert({
    date:          currentTargetsDate,
    day_type:      dayType,
    phase_id:      currentPhase.id,
    calories:      t.calories,
    fat:           t.fat,
    saturated_fat: t.saturated_fat,
    carbs:         t.carbs,
    sugar:         t.sugar,
    fiber:         t.fiber,
    protein:       t.protein,
  }, { onConflict: 'date' });
  if (error) { toast('Erro ao confirmar'); return; }
  toast(`Dia confirmado · ${currentPhase.label}`);
  // Sync cachedTargets so diary bars update immediately for today
  const today = new Date().toISOString().split('T')[0];
  if (currentTargetsDate === today) {
    cachedTargets = {
      calories:      t.calories,
      fat:           t.fat,
      saturated_fat: t.saturated_fat,
      carbs:         t.carbs,
      sugar:         t.sugar,
      fiber:         t.fiber,
      protein:       t.protein,
    };
    localStorage.setItem('nt_targets', JSON.stringify(cachedTargets));
    localStorage.setItem('nt_day_type', dayType);
    loadToday();
  }
}

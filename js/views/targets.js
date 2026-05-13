let currentTargetsDate  = new Date().toISOString().split('T')[0];
let currentPhase        = null;
let currentPhaseTargets = null;

const TARGET_FIELD_IDS = ['t-kcal','t-fat','t-satfat','t-carb','t-sugar','t-fiber','t-prot'];

async function loadTargetsForm() {
  currentTargetsDate = new Date().toISOString().split('T')[0];
  updateTargetsDateLabel();
  // Enforce read-only — visual handled by CSS input[readonly]
  TARGET_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.readOnly = true;
  });
  // refreshPhaseAndTargets checks daily_targets to determine day_type
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
  // Called on date change or initial load.
  // Queries daily_targets to set the selector — does NOT use localStorage day_type.
  document.getElementById('targets-loading').style.display = 'block';
  document.getElementById('targets-display').style.opacity = '0.4';

  currentPhase = await getActivePhase(currentTargetsDate);
  updatePhaseBadge();

  // Check if this date already has a confirmed snapshot
  let snapshotDayType = null;
  if (db) {
    const { data } = await db
      .from('daily_targets')
      .select('day_type')
      .eq('date', currentTargetsDate)
      .maybeSingle();
    if (data) snapshotDayType = data.day_type;
  }

  // Set selector: confirmed day_type from snapshot, or '' (placeholder) if none
  const select = document.getElementById('day-type-select');
  select.value = snapshotDayType || '';

  const dayType = select.value;
  currentPhaseTargets = (currentPhase && dayType)
    ? await getPhaseTargets(currentPhase.id, dayType)
    : null;

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

  const hint    = document.getElementById('targets-hint');
  if (!hint) return;
  const dayType = document.getElementById('day-type-select').value;

  if (!dayType) {
    hint.textContent = 'Nenhum tipo de dia confirmado para esta data. Selecciona um tipo e confirma.';
    hint.style.display = 'block';
  } else if (!currentPhase) {
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
  const dayType    = document.getElementById('day-type-select').value;
  const hasTargets = !!(currentPhase && currentPhaseTargets && dayType);
  btn.style.display = currentPhase ? 'block' : 'none';
  btn.disabled      = !hasTargets;
  btn.style.opacity = hasTargets ? '1' : '0.4';
  btn.textContent   = 'Guardar tipo de dia';
}

async function onDayTypeChange() {
  // User manually changed the selector — reload phase_targets, keep current phase.
  const dayType = document.getElementById('day-type-select').value;
  if (dayType) localStorage.setItem('nt_day_type', dayType);
  document.getElementById('targets-loading').style.display = 'block';
  document.getElementById('targets-display').style.opacity = '0.4';
  currentPhaseTargets = (currentPhase && dayType)
    ? await getPhaseTargets(currentPhase.id, dayType)
    : null;
  document.getElementById('targets-loading').style.display = 'none';
  document.getElementById('targets-display').style.opacity = '1';
  fillTargetFields(currentPhaseTargets);
  updateConfirmButton();
}

async function onTargetsDateChange(dateStr) {
  currentTargetsDate = dateStr;
  updateTargetsDateLabel();
  await refreshPhaseAndTargets();
}

async function confirmDayTargets() {
  if (!currentPhase || !currentPhaseTargets) return;
  const dayType = document.getElementById('day-type-select').value;
  if (!dayType) return;
  const t = currentPhaseTargets;
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
  toast(`Dia guardado · ${currentPhase.label}`);
}

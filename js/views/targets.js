let currentTargetsDate = new Date().toISOString().split('T')[0];
let currentPhase = null;

async function loadTargetsForm() {
  currentTargetsDate = new Date().toISOString().split('T')[0];
  updateTargetsDateLabel();

  const dayType = localStorage.getItem('nt_day_type') || 'training_plus_work';
  document.getElementById('day-type-select').value = dayType;

  await refreshPhaseAndTargets();
}

function updateTargetsDateLabel() {
  const el = document.getElementById('targets-date-btn');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const d = new Date(currentTargetsDate + 'T12:00:00');
  const label = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  el.textContent = currentTargetsDate === today ? `Hoje — ${label}` : label;
}

async function refreshPhaseAndTargets() {
  document.getElementById('targets-loading').style.display = 'block';
  document.getElementById('targets-display').style.opacity = '0.4';

  currentPhase = await getActivePhase(currentTargetsDate);
  updatePhaseBadge();

  const dayType = document.getElementById('day-type-select').value;
  const t = currentPhase ? await getPhaseTargets(currentPhase.id, dayType) : null;

  document.getElementById('targets-loading').style.display = 'none';
  document.getElementById('targets-display').style.opacity = '1';

  fillTargetFields(t);
  updateSaveButton();
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
  document.getElementById('t-kcal').value   = t ? t.calories      : '';
  document.getElementById('t-fat').value    = t ? t.fat           : '';
  document.getElementById('t-satfat').value = t ? t.saturated_fat : '';
  document.getElementById('t-carb').value   = t ? t.carbs         : '';
  document.getElementById('t-sugar').value  = t ? t.sugar         : '';
  document.getElementById('t-fiber').value  = t ? t.fiber         : '';
  document.getElementById('t-prot').value   = t ? t.protein       : '';

  const hint = document.getElementById('targets-hint');
  if (hint) hint.style.display = !currentPhase ? 'block' : 'none';
}

function updateSaveButton() {
  const btn = document.getElementById('save-targets-btn');
  if (!btn) return;
  if (currentPhase) {
    btn.textContent = `Guardar targets · ${currentPhase.label}`;
    btn.style.display = 'block';
  } else {
    btn.style.display = 'none';
  }
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

async function savePhaseTargetsForm() {
  if (!currentPhase) { toast('Sem fase activa para esta data'); return; }
  const dayType = document.getElementById('day-type-select').value;
  const values = {
    calories:      parseFloat(document.getElementById('t-kcal').value)   || 0,
    fat:           parseFloat(document.getElementById('t-fat').value)    || 0,
    saturated_fat: parseFloat(document.getElementById('t-satfat').value) || 0,
    carbs:         parseFloat(document.getElementById('t-carb').value)   || 0,
    sugar:         parseFloat(document.getElementById('t-sugar').value)  || 0,
    fiber:         parseFloat(document.getElementById('t-fiber').value)  || 0,
    protein:       parseFloat(document.getElementById('t-prot').value)   || 0,
  };
  const { error } = await savePhaseTargets(currentPhase.id, dayType, values);
  if (error) { toast('Erro ao guardar'); return; }
  toast(`Targets da ${currentPhase.label} actualizados`);
  // Sync cachedTargets so today's diary bars reflect the change immediately
  const today = new Date().toISOString().split('T')[0];
  if (currentTargetsDate === today) {
    cachedTargets = values;
    localStorage.setItem('nt_targets', JSON.stringify(values));
    loadToday();
  }
}

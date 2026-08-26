let currentTargetsDate  = new Date().toISOString().split('T')[0];
let refreshTargetsGen   = 0;

const TARGET_FIELD_IDS = ['t-kcal','t-fat','t-carb','t-fiber','t-prot'];

// Porto Marathon — única data de prova fixa da app. NÃO é o mesmo tipo de
// dado que causou o bug desta página (surplus/fase): uma data de prova não
// muda sozinha semana a semana como um bloco de nutrição — só muda se a
// prova em si mudar, e nesse caso este valor tem de ser actualizado à mão de
// propósito. O que NUNCA se hardcoda é o número de semanas (T) — esse é
// sempre calculado a partir de hoje, nunca escrito como texto fixo (mesma
// regra de cd_protocol.md/dcb_prompt.md do lado do coaching).
const PORTO_MARATHON_DATE = '2026-11-08';

async function loadTargetsForm() {
  currentTargetsDate = new Date().toISOString().split('T')[0];
  updateTargetsDateLabel();
  await refreshTargets();
}

function updateTargetsDateLabel() {
  const el = document.getElementById('targets-date-btn');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const d     = new Date(currentTargetsDate + 'T12:00:00');
  const label = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  el.textContent = currentTargetsDate === today ? `Hoje — ${label}` : label;
}

/** T = semanas até à prova, sempre calculado a partir de hoje — nunca um
 * número fixo escrito em prosa (mesma regra do lado do coaching, ver
 * shared/lib/race_countdown.py::weeks_until no repo sync_hub). */
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

/** Deriva os blocos activos e a lista de chips a partir de blocks_active
 * INTEIRO — nunca de uma lista fixa de chaves conhecidas. Uma chave nova
 * (ex.: um bloco de ginásio via Hevy, plano D3) passa a aparecer sozinha em
 * vez de ser ignorada em silêncio, que foi como a chave activity_kcal_by_id
 * do plans/020 desapareceu desta página sem nenhum erro visível.
 *
 * Distingue por TIPO, não por nome: um valor numérico >0 é um bloco de kcal;
 * `activity_kcal_by_id` é o único campo-objecto conhecido e expande-se numa
 * entrada por actividade (nunca agregado — dias com 2-3 actividades vão ser
 * comuns); qualquer outra coisa (strings como run_type_context, zeros,
 * nulls) fica de fora sem precisar de saber o nome do campo à partida. */
function deriveBlocks(blocksActive) {
  const BLOCK_LABELS = {
    base: 'Base', work: 'Trabalho', gym: 'Ginásio', run: 'Corrida', surplus: 'Surplus',
  };
  const chips = [];
  let sum = 0;

  for (const [key, value] of Object.entries(blocksActive)) {
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
    const n = +value;
    if (!(n > 0)) continue; // exclui strings (run_type_context), 0, null, undefined
    sum += n;
    chips.push({ label: BLOCK_LABELS[key] || key, value: n });
  }

  return { chips, sum: Math.round(sum) };
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
  const pushTime   = document.getElementById('targets-push-time');

  if (row) {
    // ── Com target ──────────────────────────────────────────────
    document.getElementById('t-kcal').textContent  = row.calories ?? '—';
    document.getElementById('t-fat').textContent   = row.fat      ?? '—';
    document.getElementById('t-carb').textContent  = row.carbs    ?? '—';
    document.getElementById('t-fiber').textContent = row.fiber    ?? '—';
    document.getElementById('t-prot').textContent  = row.protein  ?? '—';

    // Blocos activos — chips derivados de blocks_active inteiro
    if (row.blocks_active && typeof row.blocks_active === 'object' && chipsEl) {
      const { chips, sum } = deriveBlocks(row.blocks_active);
      if (chips.length) {
        chipsEl.innerHTML = '';
        chips.forEach(({ label, value }) => {
          const chip = document.createElement('span');
          chip.className = 'block-chip';
          chip.textContent = `${label} ${Math.round(value)}kcal`;
          chipsEl.appendChild(chip);
        });
        blocksEl.style.display = 'block';

        // Verificação visível: soma dos blocos vs calories. Foi por acaso
        // que se reparou que faltava activity_kcal_by_id na soma — sem isto
        // visível, a próxima chave nova a desaparecer passa despercebida.
        const calories = +row.calories;
        const diff = Number.isFinite(calories) ? calories - sum : null;
        if (warningEl) {
          if (diff !== null && Math.abs(diff) > 1) {
            warningEl.textContent =
              `⚠ Blocos somam ${sum}kcal, mas o target é ${calories}kcal ` +
              `(diferença de ${diff > 0 ? '+' : ''}${diff}kcal não explicada por nenhum bloco listado acima).`;
            warningEl.style.display = 'block';
          } else {
            warningEl.style.display = 'none';
          }
        }
      } else {
        blocksEl.style.display = 'none';
        if (warningEl) warningEl.style.display = 'none';
      }
    } else {
      blocksEl.style.display = 'none';
      if (warningEl) warningEl.style.display = 'none';
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
    if (warningEl) warningEl.style.display = 'none';
    pushTime.style.display   = 'none';
    if (hint) {
      hint.textContent = 'Sem target para esta data. Pede ao DCB para fazer push dos blocos de hoje.';
      hint.style.display = 'block';
    }
  }
}

async function onTargetsDateChange(dateStr) {
  currentTargetsDate = dateStr;
  updateTargetsDateLabel();
  await refreshTargets();
}

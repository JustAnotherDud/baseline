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
// plans/035: um bloco de kcal é, por CONVENÇÃO DE NOME, uma chave de topo
// terminada em `_kcal` (mais o caso especial `activity_kcal_by_id`). Tudo o
// resto -- proveniência (run_type_source, gym_planned, gym_source), contexto
// e diagnóstico (agora aninhado em `energy_diag`) -- fica de fora por
// construção, sem precisar de ser enumerado.
//
// Isto substitui a lista NON_BLOCK_KEYS que existia aqui desde plans/032.
// Uma blacklist tem de ser actualizada a cada campo novo do backend e falha
// EM SILÊNCIO quando alguém se esquece. Falhou duas vezes em duas rondas:
// `gym_planned` (booleano, +true === 1) desenhou "gym_planned 1kcal", e
// `work_hours_today` (horas) desenhou "work_hours_today 6kcal" -- errado na
// unidade, não só no rótulo. Um sufixo não tem esse modo de falha: um campo
// novo só vira chip se for mesmo kcal, e um campo de kcal novo aparece
// sozinho (que era o objectivo original do derive genérico).
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

/** Linha de contexto energético a partir de blocks_active.energy_diag
 * (plans/035). Antes, expenditure/SE/unallocated/rolling_7d eram calculados
 * pela RPC e deitados fora -- nunca chegavam à linha nem a esta página, o que
 * tornava possível o sistema descartar 11% da energia sem aparecer em lado
 * nenhum. Devolve [] quando não há nada a dizer. */
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

  // unallocated é estruturalmente 0 desde plans/035 (sem tectos). Se voltar a
  // aparecer, é bug -- por isso é que continua a ser mostrado.
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

  if (row) {
    // plans/035: o diagnóstico mudou-se para blocks_active.energy_diag. Linhas
    // antigas (pré-035) têm os mesmos campos no topo -- ler os dois, para o
    // histórico não ficar sem badge ao navegar para trás.
    const diag = row.blocks_active?.energy_diag ?? null;
    const lookbackDays = diag?.lookback_days_used ?? row.blocks_active?.energy_lookback_days_used;
    const loggedDays   = diag?.days_logged_in_window ?? row.blocks_active?.energy_days_logged_in_window;

    // Badge de cobertura: só aparece quando a janela teve de alargar além da
    // normal (28d desde plans/035, era 21d) por falta de dias logados.
    if (coverageEl) {
      if (Number.isFinite(lookbackDays) && lookbackDays > 28) {
        coverageEl.textContent = `Estimativa alargada a ${lookbackDays}d (${loggedDays ?? '—'}d logados)`;
        coverageEl.style.display = 'inline-block';
      } else {
        coverageEl.style.display = 'none';
      }
    }
    // ── Com target ──────────────────────────────────────────────
    document.getElementById('t-kcal').textContent  = row.calories ?? '—';
    document.getElementById('t-fat').textContent   = row.fat      ?? '—';
    document.getElementById('t-carb').textContent  = row.carbs    ?? '—';
    document.getElementById('t-fiber').textContent = row.fiber    ?? '—';
    document.getElementById('t-prot').textContent  = row.protein  ?? '—';

    // Blocos activos — chips derivados de blocks_active inteiro
    if (row.blocks_active && typeof row.blocks_active === 'object' && chipsEl) {
      const { chips, sum } = deriveBlocks(row.blocks_active);
      const calories = +row.calories;
      // plans/035: `baseline_kcal` passou a ser um bloco escrito pelo backend.
      // A sua presença é o que distingue uma linha nova de uma pré-035 -- e
      // é só nas novas que a soma dos blocos PODE fechar com o total, logo
      // só nessas é que uma divergência significa alguma coisa.
      const hasBaseline = Object.hasOwn(row.blocks_active, 'baseline_kcal');

      if (chips.length) {
        chipsEl.innerHTML = '';
        chips.forEach(({ label, value }) => {
          const chip = document.createElement('span');
          chip.className = 'block-chip';
          chip.textContent = `${label} ${Math.round(value)}kcal`;
          chipsEl.appendChild(chip);
        });
        blocksEl.style.display = 'block';

        // Até plans/034 este aviso era um falso-positivo permanente: desde
        // plans/031 as calorias deixaram de ser soma-de-blocos, mas a baseline
        // não tinha chave própria, por isso a soma NUNCA fechava. Agora fecha
        // por construção (baseline + trabalho + ginásio + actividade == energia
        // base), e o aviso volta a significar o que sempre quis dizer: dupla
        // contagem. Tolerância de 15kcal para o arredondamento à grama dos
        // macros (P×4+C×4+F×9 não bate ao kcal exacto).
        if (warningEl) {
          const diff = hasBaseline && Number.isFinite(calories) ? sum - calories : 0;
          if (Math.abs(diff) > 15) {
            warningEl.textContent =
              `⚠ Blocos somam ${sum}kcal contra um target de ${calories}kcal ` +
              `(${diff > 0 ? '+' : ''}${diff}kcal). Os dois deviam fechar — ` +
              `possível dupla contagem ou bloco em falta.`;
            warningEl.style.display = 'block';
          } else {
            warningEl.style.display = 'none';
          }
        }

        if (noteEl) {
          const notes = energyNotes(diag);
          if (notes.length) {
            noteEl.innerHTML = '';
            notes.forEach((text) => {
              const line = document.createElement('div');
              line.textContent = text;
              noteEl.appendChild(line);
            });
            noteEl.style.display = 'block';
          } else {
            noteEl.style.display = 'none';
          }
        }
      } else {
        blocksEl.style.display = 'none';
        if (warningEl) warningEl.style.display = 'none';
        if (noteEl) noteEl.style.display = 'none';
      }
    } else {
      blocksEl.style.display = 'none';
      if (warningEl) warningEl.style.display = 'none';
      if (noteEl) noteEl.style.display = 'none';
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
    if (noteEl) noteEl.style.display = 'none';
    pushTime.style.display   = 'none';
    if (coverageEl) coverageEl.style.display = 'none';
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

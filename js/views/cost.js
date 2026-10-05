// Estatísticas de custo (€): secção do ecrã Estatísticas.
// Dados das vistas SQL v_cost_day/week/month (só dias >= cost_tracking_start),
// v_food_cost_efficiency e cost_top_foods. Cobertura = kcal com custo / kcal.

let costEffRows = [];
let costEffSort = 'eur_per_1000kcal';
const COST_EFF_SORTS = {
  eur_per_1000kcal:     '€/1000 kcal',
  eur_per_100g_protein: '€/100g prot.',
};

const covPct = c => c == null ? '—' : Math.round(c * 100) + '%';
const ddmm = iso => { const p = iso.split('-'); return `${p[2]}/${p[1]}`; };

// stack: rótulo por cima e meta por baixo (linhas de semana/mês, com meta longa).
function costRowHtml(label, meta, dim, stack) {
  return `<div class="stats-top-item${dim ? ' cost-dim' : ''}"${stack ? ' style="flex-direction:column;align-items:flex-start;gap:2px"' : ''}>
    <div class="stats-top-name">${label}</div>
    <div class="stats-top-meta"${stack ? ' style="white-space:normal"' : ''}>${meta}</div>
  </div>`;
}

async function renderCostStats(container, from, to, gen) {
  const wrap = document.createElement('div');
  wrap.innerHTML = '<div class="stats-section"><div class="stats-section-title">Custo</div><div class="loading">A carregar...</div></div>';
  container.appendChild(wrap);

  await loadCostConfig();
  const [days, weeks, months, eff, top] = await Promise.all([
    db.from('v_cost_day').select('date,cost_eur,coverage,counts_in_avg').gte('date', from).lte('date', to).order('date'),
    db.from('v_cost_week').select('*').order('period_start', { ascending: false }).limit(4),
    db.from('v_cost_month').select('*').order('period_start', { ascending: false }).limit(3),
    db.from('v_food_cost_efficiency').select('*'),
    db.rpc('cost_top_foods', { p_from: from, p_to: to, p_limit: 5 }),
  ]);
  if (gen !== loadStatsGen) return;

  if (days.error || weeks.error) {
    wrap.innerHTML = '<div class="stats-section"><div class="stats-section-title">Custo</div><div class="stats-empty">Erro ao carregar custos.</div></div>';
    return;
  }

  // ── Diário ────────────────────────────────────────────────────────────
  const dayRows = days.data || [];
  const { n, avg } = costAverage(dayRows);
  const dailyHtml = dayRows.length === 0
    ? `<div class="stats-empty">Sem custos neste período${costConfig ? ` (registo desde ${ddmm(costConfig.start)})` : ''}.</div>`
    : `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">
         <span style="font-family:var(--mono);font-size:28px;font-weight:600;color:var(--accent)">${formatEur(avg)}</span>
         <span style="font-size:13px;color:var(--text2)">por dia · média sobre ${n} dia${n !== 1 ? 's' : ''}</span>
       </div>`
      + [...dayRows].reverse().map(d => costRowHtml(
          ddmm(d.date) + (d.counts_in_avg ? '' : ' · cobertura baixa'),
          `${formatEur(d.cost_eur)} · ${covPct(d.coverage)}`, !d.counts_in_avg)).join('');

  // ── Semana / mês ──────────────────────────────────────────────────────
  const periodRow = (label, p) => costRowHtml(label,
    `${p.avg_daily_cost == null ? '—' : formatEur(p.avg_daily_cost) + '/dia'} · média sobre ${p.n_days_counted}/${p.n_days} dia${p.n_days !== 1 ? 's' : ''} · total ${formatEur(p.total_cost)} · ${covPct(p.coverage)}`, false, true);
  const weekHtml = (weeks.data || []).map(p => periodRow('Sem. ' + ddmm(p.period_start), p)).join('')
    || '<div class="stats-empty">Sem dados.</div>';
  const monthHtml = (months.data || []).map(p => {
    const d = new Date(p.period_start + 'T12:00:00');
    return periodRow(d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }), p);
  }).join('') || '<div class="stats-empty">Sem dados.</div>';

  // ── Top por gasto ─────────────────────────────────────────────────────
  const topRows = (top.data || []).map((t, i) => `
    <div class="stats-top-item">
      <div class="stats-top-rank">${i + 1}</div>
      <div class="stats-top-name">${escHtml(t.food_name)}</div>
      <div class="stats-top-meta">${t.n}× · ${formatEur(t.cost_eur)}</div>
    </div>`).join('');

  costEffRows = eff.data || [];
  wrap.innerHTML = `
    <div class="stats-section"><div class="stats-section-title">Custo diário · ${statsPeriod} dias</div>${dailyHtml}</div>
    <div class="stats-section"><div class="stats-section-title">Custo por semana</div>${weekHtml}</div>
    <div class="stats-section"><div class="stats-section-title">Custo por mês</div>${monthHtml}</div>
    <div class="stats-section"><div class="stats-section-title">Maior gasto · ${statsPeriod} dias</div>${topRows || '<div class="stats-empty">Sem dados.</div>'}</div>
    <div class="stats-section">
      <div class="stats-section-title">Alimentos por custo</div>
      <div id="cost-eff-chips" style="display:flex;gap:8px;margin-bottom:8px"></div>
      <div id="cost-eff-list"></div>
    </div>`;
  renderCostEff();
}

function setCostEffSort(k) {
  costEffSort = k;
  renderCostEff();
}

// Só alimentos com preço (a vista já filtra); mais barato primeiro.
function renderCostEff() {
  const chips = document.getElementById('cost-eff-chips');
  const list  = document.getElementById('cost-eff-list');
  if (!chips || !list) return;
  chips.innerHTML = Object.entries(COST_EFF_SORTS).map(([k, label]) =>
    `<button class="sort-chip${k === costEffSort ? ' active' : ''}" onclick="setCostEffSort('${k}')">${label}</button>`).join('');
  const rows = costEffRows.filter(f => f[costEffSort] != null)
    .sort((a, b) => a[costEffSort] - b[costEffSort]);
  list.innerHTML = rows.length
    ? rows.map(f => costRowHtml(escHtml(f.name) + (f.brand ? ` · ${escHtml(f.brand)}` : ''),
        `${formatEur(f[costEffSort])} · ${formatEur(f.eur_per_100g)}/100g`)).join('')
    : '<div class="stats-empty">Nenhum alimento com preço.</div>';
}

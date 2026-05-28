let loadBodyGen = 0;
let bodyChartInstance = null;
let bodyChartData = null;
let bodyActiveDatasets = { weight: true, fat: false };

async function loadBody() {
  const gen = ++loadBodyGen;
  const container = document.getElementById('body-container');
  container.innerHTML = '<div class="loading">A carregar...</div>';

  const { data, error } = await db
    .from('body_comp')
    .select('*')
    .order('date', { ascending: false })
    .limit(30);

  if (gen !== loadBodyGen) return;

  if (error || !data || data.length === 0) {
    container.innerHTML = `<div class="empty">
      <div class="empty-icon">⚖️</div>
      <div class="empty-text">Sem dados de composição corporal.<br>Sincroniza primeiro com o Garmin.</div>
    </div>`;
    return;
  }

  const latest = data[0];
  const prev   = data[1] || null;
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  // Weight delta vs previous entry
  let deltaHtml = '';
  if (latest.weight_kg != null && prev?.weight_kg != null) {
    const delta = parseFloat((latest.weight_kg - prev.weight_kg).toFixed(1));
    if (delta > 0) {
      deltaHtml = `<span style="color:var(--red);font-family:var(--mono);font-size:13px">↑ ${delta.toFixed(1)} kg</span>`;
    } else if (delta < 0) {
      deltaHtml = `<span style="color:var(--accent);font-family:var(--mono);font-size:13px">↓ ${Math.abs(delta).toFixed(1)} kg</span>`;
    } else {
      deltaHtml = `<span style="color:var(--text3);font-family:var(--mono);font-size:13px">= 0.0 kg</span>`;
    }
  }

  const dateFormatted = latest.date
    ? new Date(latest.date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  // Reset chart state on each load
  bodyActiveDatasets = { weight: true, fat: false };
  if (bodyChartInstance) { bodyChartInstance.destroy(); bodyChartInstance = null; }

  container.innerHTML = `
    <div style="padding:16px 20px 0">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Última pesagem</div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px">
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px">
          <span style="font-family:var(--mono);font-size:42px;font-weight:600;color:var(--accent);line-height:1">${latest.weight_kg != null ? parseFloat(latest.weight_kg).toFixed(1) : '—'}</span>
          <span style="font-family:var(--mono);font-size:13px;color:var(--text3)">kg</span>
          ${deltaHtml}
        </div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--text3);margin-bottom:16px">${dateFormatted}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${bodyMetricCard('Body Fat', latest.body_fat_pct, '%', 'var(--orange)')}
          ${bodyMetricCard('Músculo', latest.muscle_mass_kg, 'kg', 'var(--blue)')}
          ${bodyMetricCard('Osso', latest.bone_mass_kg, 'kg', 'var(--text2)')}
          ${bodyMetricCard('Água', latest.water_pct, '%', 'var(--blue)')}
        </div>
      </div>
    </div>

    <div style="padding:16px 20px 0">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Tendência 30 dias</div>
      <div style="display:flex;gap:6px;margin-bottom:12px" id="body-chart-chips">
        <button class="sort-chip active" data-dataset="weight" onclick="toggleBodyDataset('weight')">Peso</button>
        <button class="sort-chip" data-dataset="fat" onclick="toggleBodyDataset('fat')">Body Fat</button>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px">
        <div style="position:relative;height:180px">
          <canvas id="body-chart"></canvas>
        </div>
      </div>
    </div>

    <div style="padding:16px 20px 24px">
      <div style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Insights</div>
      <button class="btn btn-primary" onclick="analyseBodyComp()" id="body-analyse-btn">✦ Analisar</button>
      <div id="body-insight-card" style="display:none;margin-top:12px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;font-size:14px;line-height:1.6;color:var(--text)"></div>
    </div>
  `;

  buildBodyChart(sorted);
}

function bodyMetricCard(label, value, unit, color) {
  const display = value != null ? parseFloat(value).toFixed(1) + unit : '—';
  return `<div style="background:var(--surface3);border-radius:8px;padding:10px 12px">
    <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:4px">${label}</div>
    <div style="font-family:var(--mono);font-size:16px;font-weight:600;color:${color}">${display}</div>
  </div>`;
}

function buildBodyChart(rows) {
  const ctx = document.getElementById('body-chart');
  if (!ctx) return;

  const accentColor = '#4ade80';
  const blueColor   = '#60a5fa';

  const labels  = rows.map(r => {
    const d = new Date(r.date + 'T12:00:00');
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const weights = rows.map(r => r.weight_kg != null ? parseFloat(r.weight_kg) : null);
  const fats    = rows.map(r => r.body_fat_pct != null ? parseFloat(r.body_fat_pct) : null);

  bodyChartData = { labels, weights, fats };

  bodyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Peso (kg)',
          data: weights,
          borderColor: accentColor,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: accentColor,
          tension: 0.3,
          hidden: false,
          yAxisID: 'y',
          spanGaps: true,
        },
        {
          label: 'Body Fat (%)',
          data: fats,
          borderColor: blueColor,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: blueColor,
          tension: 0.3,
          hidden: true,
          yAxisID: 'y2',
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#2e2e2e',
          borderWidth: 1,
          titleColor: '#bbb',
          bodyColor: '#f0f0f0',
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#888',
            font: { family: 'IBM Plex Mono', size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          border: { color: '#2e2e2e' },
        },
        y: {
          position: 'left',
          grid: { color: '#1e1e1e' },
          ticks: { color: '#888', font: { family: 'IBM Plex Mono', size: 10 } },
          border: { color: '#2e2e2e' },
        },
        y2: {
          position: 'right',
          display: false,
          grid: { drawOnChartArea: false },
          ticks: { color: '#888', font: { family: 'IBM Plex Mono', size: 10 } },
          border: { color: '#2e2e2e' },
        },
      },
    },
  });
}

function toggleBodyDataset(key) {
  if (!bodyChartInstance) return;
  bodyActiveDatasets[key] = !bodyActiveDatasets[key];

  document.querySelectorAll('#body-chart-chips .sort-chip').forEach(c => {
    c.classList.toggle('active', bodyActiveDatasets[c.dataset.dataset]);
  });

  bodyChartInstance.data.datasets[0].hidden = !bodyActiveDatasets.weight;
  bodyChartInstance.data.datasets[1].hidden = !bodyActiveDatasets.fat;
  bodyChartInstance.options.scales.y.display  = bodyActiveDatasets.weight;
  bodyChartInstance.options.scales.y2.display = bodyActiveDatasets.fat;
  bodyChartInstance.update();
}

async function analyseBodyComp() {
  const btn  = document.getElementById('body-analyse-btn');
  const card = document.getElementById('body-insight-card');
  if (!btn || !card) return;

  let apiKey = localStorage.getItem('anthropic_key');
  if (!apiKey) {
    apiKey = prompt('Anthropic API key (guardada localmente):');
    if (!apiKey) return;
    apiKey = apiKey.trim();
    localStorage.setItem('anthropic_key', apiKey);
  }

  btn.disabled = true;
  btn.textContent = 'A analisar...';
  card.style.display   = 'block';
  card.style.color     = 'var(--text3)';
  card.style.fontFamily = 'var(--mono)';
  card.style.fontSize  = '12px';
  card.textContent     = 'A analisar...';

  let dataSummary = '(sem dados)';
  if (bodyChartData) {
    dataSummary = bodyChartData.labels
      .map((l, i) => `${l}: ${bodyChartData.weights[i] ?? '?'} kg, ${bodyChartData.fats[i] ?? '?'} %`)
      .join('\n');
  }

  const userPrompt = `Dados de composição corporal dos últimos 30 dias (data: peso, body fat%):\n${dataSummary}\n\nContexto do atleta:\n- Fase 3.5, surplus +150kcal, P 175g F 65g C residual\n- Objetivo: maratona Porto 8 Nov 2026, hipertrofia upper body\n- Atleta: 26 anos, 184cm, corredor de endurance\n\nAnalisa a evolução da composição corporal das últimas 4 semanas. Identifica tendências de peso, gordura e massa muscular. Avalia se o progresso é consistente com os objectivos (recomp em surplus ligeiro + preparação maratona). Aponta flags se os houver. Responde em português, de forma directa, máximo 200 palavras.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const json = await res.json();
    const text = json.content?.[0]?.text || '(sem resposta)';
    card.style.color      = 'var(--text)';
    card.style.fontFamily = 'var(--sans)';
    card.style.fontSize   = '14px';
    card.textContent      = text;
  } catch (e) {
    card.style.color = 'var(--red)';
    card.textContent = `Erro: ${e.message}`;
  } finally {
    btn.disabled    = false;
    btn.textContent = '✦ Analisar';
  }
}

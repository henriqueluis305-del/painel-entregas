const SLA_DS_PATH = `${OPS_DIR}/shopee/sla-ds-history.json`;

async function loadBasesForOp(op, selectFn = 'selectBase') {
  const items = await Storage.listDir(`${OPS_DIR}/${op}`);
  const bases = items.filter(i => i.type === 'dir').map(i => i.name);
  const container = document.getElementById('base-list');
  if (!container) return;
  if (!bases.length) {
    container.innerHTML = `<div class="empty">Nenhuma base encontrada em /${op}/.<br>Crie a pasta no GitHub para começar.</div>`;
    return;
  }
  container.innerHTML = bases.map(b =>
    `<button class="base-btn" onclick="${selectFn}('${op}','${b}',this)">${b.toUpperCase()}</button>`
  ).join('') + `<button class="base-btn base-btn-add" onclick="promptNewBase('${op}')">+ Nova base</button>`;
}


async function selectBase(op, base, el) {
  currentBase = base;
  document.querySelectorAll('.base-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  await loadLogs(op, base);
  const panel = document.getElementById('base-panel');
  if (!panel) return;
  panel.innerHTML = basePanelHTML(op, base);
  updateAll();
}

async function promptNewBase(op) {
  const name = prompt('Nome da nova base (ex: XPT-ADR-02):');
  if (!name) return;
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const label = Storage.isLocal() ? 'local' : 'GitHub';
  setSaving(`Criando base (${label})...`);
  const ok = await Storage.put(`${OPS_DIR}/${op}/${slug}/.gitkeep`, '', `criar base ${op}/${slug}`);
  setSaving('');
  if (ok) {
    if (Storage.isLocal()) {
      const manifest = JSON.parse(localStorage.getItem('__manifest__') || 'null') ||
        await fetch('data/manifest.json').then(r => r.json()).catch(() => ({}));
      const mkey = `${OPS_DIR}/${op}`;
      if (!manifest[mkey]) manifest[mkey] = [];
      if (!manifest[mkey].includes(slug)) manifest[mkey].push(slug);
      localStorage.setItem('__manifest__', JSON.stringify(manifest));
    }
    showSnack(`Base ${name} criada!`);
    await loadBasesForOp(op);
  } else {
    showSnack('Erro ao criar base.', true);
  }
}

async function loadLogsForCurrentUser() {
  if (!userOp || !userBase) { logsData = []; return; }
  await loadLogs(userOp, userBase);
}

async function createUser() {
  const email   = document.getElementById('new-email').value.trim();
  const pass    = document.getElementById('new-pass').value;
  const empresa = document.getElementById('new-empresa').value.trim();
  const role    = document.getElementById('new-role').value;
  const op      = document.getElementById('new-op').value;
  const base    = document.getElementById('new-base').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
  const msg     = document.getElementById('create-msg');
  const btn     = document.getElementById('btn-create-user');
  if (!email || !pass || !empresa) { msg.textContent = 'Preencha todos os campos.'; msg.className = 'create-msg err'; return; }
  if (pass.length < 6)             { msg.textContent = 'Senha mínima: 6 caracteres.'; msg.className = 'create-msg err'; return; }
  btn.disabled = true; msg.textContent = 'Criando...'; msg.className = 'create-msg';
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass, email_confirm: true, user_metadata: { empresa } }),
  });
  const data = await r.json();
  if (data.id) {
    await supaReq('/rest/v1/profiles', {
      method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify({ id: data.id, email, empresa, role, operacao: op, base }),
    });
    if (base) {
      await Storage.put(`${OPS_DIR}/${op}/${base}/.gitkeep`, '', `criar base ${op}/${base} para ${email}`);
    }
    msg.textContent = `✓ Acesso criado — ${ROLE_LABELS[role]} / ${OP_LABELS[op]} / ${base || 'sem base'}`; msg.className = 'create-msg ok';
    document.getElementById('new-email').value   = '';
    document.getElementById('new-pass').value    = '';
    document.getElementById('new-empresa').value = '';
    document.getElementById('new-base').value    = '';
    loadAdminClients();
  } else {
    msg.textContent = data.msg || data.message || 'Erro ao criar usuário.'; msg.className = 'create-msg err';
  }
  btn.disabled = false;
}

async function loadAdminClients() {
  const tbody = document.getElementById('admin-clients-tbody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Carregando...</td></tr>';
  const pr = await supaReq('/rest/v1/profiles?select=*&order=empresa.asc');
  if (!pr.ok) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Erro ao carregar.</td></tr>'; return; }
  const profiles = await pr.json();
  if (!profiles.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhum usuário cadastrado.</td></tr>'; return; }
  tbody.innerHTML = profiles.map(p => `
    <tr>
      <td style="font-weight:500">${p.empresa || '—'}</td>
      <td style="color:var(--text2)">${p.email}</td>
      <td><span class="badge bb">${ROLE_LABELS[p.role] || p.role || '—'}</span></td>
      <td><span class="badge bb">${OP_LABELS[p.operacao] || p.operacao || '—'}</span></td>
      <td style="color:var(--text3)">${p.base || '—'}</td>
    </tr>`).join('');
}

// ── SLA/DS histórico manual ──────────────────────────────────────────────────

function _parsePtDate(str) {
  const m = String(str || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T12:00:00`);
  return new Date(str);
}

function _isoWeek(date) {
  const d   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - jan1) / 86400000 + 1) / 7);
}

function _mon(date) {
  return date.toLocaleDateString('pt-BR', { month: 'short' }).replace(/\./g, '');
}

function _aggKey(dateObj, period) {
  switch (period) {
    case 'semanal':    return `W${_isoWeek(dateObj)}`;
    case 'quinzenal':  return `${dateObj.getDate() <= 15 ? 1 : 2}Q${_mon(dateObj)}`;
    case 'mensal':     return _mon(dateObj);
    case 'trimestral': return `T${Math.ceil((dateObj.getMonth() + 1) / 3)} ${dateObj.getFullYear()}`;
    default:           return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
}

function _slotDetailKey(dateObj, period) {
  switch (period) {
    case 'semanal':
    case 'quinzenal':  return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    case 'mensal':     return `S${Math.min(Math.ceil(dateObj.getDate() / 7), 4)}`;
    case 'trimestral': return _mon(dateObj);
    default:           return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
}

function getAvailableSlots(records, period) {
  if (!period) return [];
  const seen = new Map();
  records.forEach(r => {
    const d   = r.ts ? new Date(r.ts) : _parsePtDate(r.data);
    const key = _aggKey(d, period);
    const ts  = d.getTime();
    if (!seen.has(key) || ts < seen.get(key)) seen.set(key, ts);
  });
  return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([key]) => key);
}

function filterBySlot(records, period, slot) {
  if (!slot || !period) return records;
  return records.filter(r => {
    const d = r.ts ? new Date(r.ts) : _parsePtDate(r.data);
    return _aggKey(d, period) === slot;
  });
}

const _BASE_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7','#06b6d4','#f97316','#84cc16'];

function aggregateForChart(records, period, slot) {
  const keyFn    = d => (slot && period) ? _slotDetailKey(d, period) : _aggKey(d, period);
  const allBases = [...new Set(records.map(r => r.base))].sort();
  const byBase   = {};

  records.forEach(r => {
    const d   = r.ts ? new Date(r.ts) : _parsePtDate(r.data);
    const key = keyFn(d);
    const ts  = d.getTime();
    if (!byBase[r.base])      byBase[r.base] = {};
    if (!byBase[r.base][key]) byBase[r.base][key] = { ts, sla: [], ds: [] };
    if (ts < byBase[r.base][key].ts) byBase[r.base][key].ts = ts;
    byBase[r.base][key].sla.push(r.sla_pct);
    byBase[r.base][key].ds.push(r.ds_pct);
  });

  const labelTs = {};
  Object.values(byBase).forEach(bd =>
    Object.entries(bd).forEach(([l, v]) => { if (!labelTs[l] || v.ts < labelTs[l]) labelTs[l] = v.ts; })
  );
  const labels = Object.entries(labelTs).sort((a, b) => a[1] - b[1]).map(([l]) => l);
  const avg    = arr => { const v = arr.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

  const series = allBases.map((base, idx) => ({
    base,
    color:   _BASE_COLORS[idx % _BASE_COLORS.length],
    slaData: labels.map(l => byBase[base]?.[l] ? avg(byBase[base][l].sla) : null),
    dsData:  labels.map(l => byBase[base]?.[l] ? avg(byBase[base][l].ds)  : null),
  }));

  return { labels, series };
}

function fmtPct(v) { return parseFloat(v.toFixed(2)) + '%'; }

function _renderSlotSelect(selectId, records, period, activeSlot) {
  const sel = document.getElementById(selectId); if (!sel) return;
  if (!period) { sel.style.display = 'none'; sel.innerHTML = '<option value="">—</option>'; return; }
  const slots = getAvailableSlots(records, period);
  if (!slots.length) { sel.style.display = 'none'; return; }
  sel.style.display = '';
  sel.innerHTML = '<option value="">— todos —</option>' +
    slots.map(s => `<option value="${s}"${s === activeSlot ? ' selected' : ''}>${s}</option>`).join('');
}

function _heatColor(pct) {
  if (pct >= 98) return { bg: 'rgba(34,197,94,0.20)',  fg: '#22c55e' };
  if (pct <  95) return { bg: 'rgba(239,68,68,0.20)',  fg: '#ef4444' };
  return               { bg: 'rgba(234,179,8,0.20)',   fg: '#eab308' };
}

function drawHeatmapTable(containerId, chartData, metric) {
  const el = document.getElementById(containerId); if (!el) return;
  const { labels, series } = chartData;
  if (!labels.length || !series.length) { el.innerHTML = ''; return; }
  const headers = series.map(s =>
    `<th style="padding:4px 10px;font-size:11px;font-weight:600;color:var(--text3);text-align:center;white-space:nowrap">${s.base.toUpperCase()}</th>`
  ).join('');
  const rows = labels.map((label, li) => {
    const cells = series.map(s => {
      const val = metric === 'sla' ? s.slaData[li] : s.dsData[li];
      if (val == null) return `<td style="padding:4px 10px;text-align:center;font-size:11px;color:var(--text3)">—</td>`;
      const { bg, fg } = _heatColor(val);
      return `<td style="padding:4px 10px;text-align:center;font-size:11px;font-weight:600;background:${bg};color:${fg};border-radius:4px">${fmtPct(val)}</td>`;
    }).join('');
    return `<tr><td style="padding:4px 10px;font-size:11px;color:var(--text3);font-family:'DM Mono',monospace;white-space:nowrap">${label}</td>${cells}</tr>`;
  }).join('');
  el.innerHTML = `
    <div class="tbl-box" style="margin-top:8px">
      <div class="tbl-head"><div class="tbl-head-title">${metric.toUpperCase()} — Mapa de Calor</div></div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:separate;border-spacing:2px">
          <thead><tr>
            <th style="padding:4px 10px;font-size:11px;font-weight:600;color:var(--text3);text-align:left">Período</th>
            ${headers}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function drawChart(canvasId, chartData, metric) {
  const c = document.getElementById(canvasId); if (!c) return;
  const ex = Chart.getChart(c); if (ex) ex.destroy();
  const { labels, series } = chartData;
  const ptLabelsPlugin = series.length === 1 ? [{
    id: '_ptLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        meta.data.forEach((pt, i) => {
          const val = ds.data[i];
          if (val == null) return;
          ctx.save();
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = ds.borderColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(fmtPct(val), pt.x, pt.y - 5);
          ctx.restore();
        });
      });
    },
  }] : [];
  new Chart(c, {
    type: 'line',
    plugins: ptLabelsPlugin,
    data: {
      labels,
      datasets: series.map(s => ({
        label:           s.base.toUpperCase(),
        data:            metric === 'sla' ? s.slaData : s.dsData,
        borderColor:     s.color,
        backgroundColor: s.color + '18',
        tension:         .3,
        fill:            false,
        spanGaps:        true,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: series.length > 1, labels: { color: '#8a9ab5', font: { size: 10 }, boxWidth: 12 } } },
      scales: {
        x: { grid: { color: '#2a3550' }, ticks: { color: '#8a9ab5', font: { size: 10 }, maxTicksLimit: 12 } },
        y: { grid: { color: '#2a3550' }, ticks: { color: '#8a9ab5', font: { size: 10 }, callback: v => fmtPct(v) } },
      },
      elements: { point: { radius: 3, hoverRadius: 5 } },
    },
  });
}

function drawTable(tbodyId, records) {
  const tbody = document.getElementById(tbodyId); if (!tbody) return;
  const sorted = [...records].sort((a, b) => {
    const da = a.ts ? new Date(a.ts) : _parsePtDate(a.data);
    const db = b.ts ? new Date(b.ts) : _parsePtDate(b.data);
    return db - da;
  });
  tbody.innerHTML = sorted.map(r => `
    <tr>
      <td style="color:var(--text3);font-family:'DM Mono',monospace;font-size:12px">${r.data}</td>
      <td style="font-weight:500">${r.base.toUpperCase()}</td>
      <td>${pctBadge(r.sla_pct)}</td>
      <td>${pctBadge(r.ds_pct)}</td>
    </tr>`).join('');
}

let _slaDsPeriodL = null;
let _slaDsPeriodR = null;
let _slaDsSlot    = null;
let _slaDsSlotL   = null;
let _slaDsSlotR   = null;

async function loadSlaDsPage() {
  const items = await Storage.listDir(`${OPS_DIR}/shopee`);
  slaDsBases       = items.filter(i => i.type === 'dir').map(i => i.name);
  slaDsHistory     = await Storage.getJSON(SLA_DS_PATH) || [];
  slaDsActiveBases = [];
  slaDsPeriod      = null;
  slaDsCompare     = false;
  _slaDsPeriodL    = null;
  _slaDsPeriodR    = null;
  _slaDsSlot       = null;
  _slaDsSlotL      = null;
  _slaDsSlotR      = null;

  const filterEl = document.getElementById('sla-ds-filters');
  if (filterEl) {
    filterEl.innerHTML =
      `<button class="base-btn active" id="sla-ds-btn-all" onclick="toggleSlaDsFilter(null)">Todos</button>` +
      slaDsBases.map(b =>
        `<button class="base-btn" id="sla-ds-btn-${b}" onclick="toggleSlaDsFilter('${b}')">${b.toUpperCase()}</button>`
      ).join('');
  }

  renderSlaDsContent();
}

function setPeriod(period) {
  slaDsPeriod = period;
  _slaDsSlot  = null;
  ['semanal', 'quinzenal', 'mensal', 'trimestral', null].forEach(p => {
    document.getElementById(p ? `per-${p}` : 'per-all')?.classList.toggle('active', p === period);
  });
  renderSlaDsContent();
}

function setPanelPeriod(side, period) {
  if (side === 'l') { _slaDsPeriodL = period; _slaDsSlotL = null; }
  else              { _slaDsPeriodR = period; _slaDsSlotR = null; }
  ['semanal', 'quinzenal', 'mensal', 'trimestral', null].forEach(p => {
    document.getElementById(`sla-per-${side}-${p || 'all'}`)?.classList.toggle('active', p === period);
  });
  renderComparePanel(side);
}

function toggleSlaDsCompare() {
  slaDsCompare = !slaDsCompare;
  const periodBar = document.getElementById('sla-period-bar');
  const normal    = document.getElementById('sla-view-normal');
  const compare   = document.getElementById('sla-view-compare');
  const btn       = document.getElementById('sla-compare-btn');
  if (slaDsCompare) {
    if (periodBar) periodBar.style.display = 'none';
    if (normal)    normal.style.display    = 'none';
    if (compare)   compare.style.display   = 'flex';
    if (btn)       btn.textContent         = '✕ Normal';
    _slaDsPeriodL = null; _slaDsPeriodR = null;
    _slaDsSlotL   = null; _slaDsSlotR   = null;
    buildComparePanels();
  } else {
    if (periodBar) periodBar.style.display = '';
    if (normal)    normal.style.display    = '';
    if (compare)   compare.style.display   = 'none';
    if (btn)       btn.textContent         = '⊞ Comparar';
    slaDsActiveBases = [];
    _slaDsSlot = null;
    renderSlaDsContent();
  }
}

function buildComparePanels() {
  slaDsActiveBases = [];
  const filterEl = document.getElementById('sla-ds-filters-cmp');
  if (filterEl) {
    filterEl.innerHTML =
      `<button class="base-btn active" id="sla-cmp-btn-all" onclick="toggleSlaDsFilterCmp(null)">Todos</button>` +
      slaDsBases.map(b =>
        `<button class="base-btn" id="sla-cmp-btn-${b}" onclick="toggleSlaDsFilterCmp('${b}')">${b.toUpperCase()}</button>`
      ).join('');
  }
  renderComparePanel('l');
  renderComparePanel('r');
}

function toggleSlaDsFilter(base) {
  if (base === null) {
    slaDsActiveBases = [];
  } else {
    slaDsActiveBases = slaDsActiveBases[0] === base ? [] : [base];
  }
  document.querySelectorAll('#sla-ds-filters .base-btn').forEach(b => b.classList.remove('active'));
  if (!slaDsActiveBases.length) {
    document.getElementById('sla-ds-btn-all')?.classList.add('active');
  } else {
    document.getElementById(`sla-ds-btn-${slaDsActiveBases[0]}`)?.classList.add('active');
  }
  renderSlaDsContent();
}

function toggleSlaDsFilterCmp(base) {
  if (base === null) {
    slaDsActiveBases = [];
  } else {
    slaDsActiveBases = slaDsActiveBases[0] === base ? [] : [base];
  }
  document.querySelectorAll('#sla-ds-filters-cmp .base-btn').forEach(b => b.classList.remove('active'));
  if (!slaDsActiveBases.length) {
    document.getElementById('sla-cmp-btn-all')?.classList.add('active');
  } else {
    document.getElementById(`sla-cmp-btn-${slaDsActiveBases[0]}`)?.classList.add('active');
  }
  renderComparePanel('l');
  renderComparePanel('r');
}

function renderSlaDsContent() {
  let records = slaDsHistory;
  if (slaDsActiveBases.length) records = records.filter(r => slaDsActiveBases.includes(r.base));

  _renderSlotSelect('sla-slot-select', records, slaDsPeriod, _slaDsSlot);

  const filtered    = filterBySlot(records, slaDsPeriod, _slaDsSlot);
  const emptyEl     = document.getElementById('sla-ds-empty');
  const chartBoxSla = document.getElementById('sla-chart-box-sla');
  const chartBoxDs  = document.getElementById('sla-chart-box-ds');
  const hmSla       = document.getElementById('sla-heatmap-sla');
  const hmDs        = document.getElementById('sla-heatmap-ds');

  if (!filtered.length) {
    if (emptyEl) {
      emptyEl.style.display = '';
      emptyEl.textContent   = slaDsHistory.length
        ? 'Nenhum dado para os filtros selecionados.'
        : 'Nenhum dado registrado ainda. Use "Importar" para começar.';
    }
    if (chartBoxSla) chartBoxSla.style.display = 'none';
    if (chartBoxDs)  chartBoxDs.style.display  = 'none';
    if (hmSla)       hmSla.innerHTML           = '';
    if (hmDs)        hmDs.innerHTML            = '';
    return;
  }

  if (emptyEl)     emptyEl.style.display     = 'none';
  if (chartBoxSla) chartBoxSla.style.display = '';
  if (chartBoxDs)  chartBoxDs.style.display  = '';

  const cd = aggregateForChart(filtered, slaDsPeriod, _slaDsSlot);
  drawChart('chartSla', cd, 'sla');
  drawChart('chartDs',  cd, 'ds');
  drawHeatmapTable('sla-heatmap-sla', cd, 'sla');
  drawHeatmapTable('sla-heatmap-ds',  cd, 'ds');
}

function renderComparePanel(side) {
  const period   = side === 'l' ? _slaDsPeriodL : _slaDsPeriodR;
  const slot     = side === 'l' ? _slaDsSlotL   : _slaDsSlotR;
  const sfx      = side === 'l' ? 'L' : 'R';

  let records = slaDsHistory;
  if (slaDsActiveBases.length) records = records.filter(r => slaDsActiveBases.includes(r.base));

  _renderSlotSelect(`sla-slot-select-${side}`, records, period, slot);

  const filtered    = filterBySlot(records, period, slot);
  const emptyEl     = document.getElementById(`sla-empty-${side}`);
  const chartBoxSla = document.getElementById(`sla-chart-box-sla-${side}`);
  const chartBoxDs  = document.getElementById(`sla-chart-box-ds-${side}`);
  const hmSla       = document.getElementById(`sla-heatmap-sla-${side}`);
  const hmDs        = document.getElementById(`sla-heatmap-ds-${side}`);

  if (!filtered.length) {
    if (emptyEl)     { emptyEl.style.display = ''; emptyEl.textContent = 'Nenhum dado para os filtros.'; }
    if (chartBoxSla) chartBoxSla.style.display = 'none';
    if (chartBoxDs)  chartBoxDs.style.display  = 'none';
    if (hmSla)       hmSla.innerHTML           = '';
    if (hmDs)        hmDs.innerHTML            = '';
    return;
  }

  if (emptyEl)     emptyEl.style.display     = 'none';
  if (chartBoxSla) chartBoxSla.style.display = '';
  if (chartBoxDs)  chartBoxDs.style.display  = '';

  const cd = aggregateForChart(filtered, period, slot);
  drawChart(`chartSla${sfx}`, cd, 'sla');
  drawChart(`chartDs${sfx}`,  cd, 'ds');
  drawHeatmapTable(`sla-heatmap-sla-${side}`, cd, 'sla');
  drawHeatmapTable(`sla-heatmap-ds-${side}`,  cd, 'ds');
}

function selectSlot(val) {
  _slaDsSlot = val || null;
  renderSlaDsContent();
}

function selectPanelSlot(side, val) {
  if (side === 'l') _slaDsSlotL = val || null;
  else              _slaDsSlotR = val || null;
  renderComparePanel(side);
}

let _slaDsXlsxParsed = [];

function switchSlaTab(tab) {
  document.getElementById('sla-panel-text').style.display  = tab === 'text' ? '' : 'none';
  document.getElementById('sla-panel-xlsx').style.display  = tab === 'xlsx' ? '' : 'none';
  const on  = 'background:var(--bg2);color:var(--text);font-weight:500';
  const off = 'background:transparent;color:var(--text2)';
  document.getElementById('sla-tab-text').style.cssText = (tab === 'text' ? on : off) + ';flex:1;padding:7px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit';
  document.getElementById('sla-tab-xlsx').style.cssText = (tab === 'xlsx' ? on : off) + ';flex:1;padding:7px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit';
  const saveBtn = document.getElementById('sla-save-btn');
  if (saveBtn) saveBtn.textContent = tab === 'xlsx' ? 'Importar tudo' : 'Salvar';
}

function openSlasDsModal(mode = 'text') {
  const modal = document.getElementById('sla-ds-modal'); if (!modal) return;
  const dateInput = document.getElementById('sla-ds-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  const slaTextArea = document.getElementById('sla-text');
  if (slaTextArea) slaTextArea.value = '';
  const dsTextArea = document.getElementById('ds-text');
  if (dsTextArea) dsTextArea.value = '';
  _slaDsXlsxParsed = [];
  const xlsxPreview = document.getElementById('sla-xlsx-preview');
  if (xlsxPreview) xlsxPreview.style.display = 'none';
  const xlsxName   = document.getElementById('sla-xlsx-name');
  if (xlsxName)   xlsxName.textContent   = 'Selecionar arquivo';
  const xlsxStatus = document.getElementById('sla-xlsx-status');
  if (xlsxStatus) { xlsxStatus.textContent = 'Aguardando'; xlsxStatus.className = 'import-wait'; }
  const preview = document.getElementById('sla-text-preview');
  if (preview) preview.textContent = '';
  const msgEl = document.getElementById('sla-ds-modal-msg');
  if (msgEl) msgEl.textContent = '';
  switchSlaTab(mode);
  modal.style.display = 'flex';
}

function closeSlasDsModal() {
  const modal = document.getElementById('sla-ds-modal');
  if (modal) modal.style.display = 'none';
}

function previewSlaText() {
  [['sla-text', parseSlaLine, 'sla-preview-sla'], ['ds-text', parseDsLine, 'sla-preview-ds']].forEach(([textId, parseFn, previewId]) => {
    const text  = document.getElementById(textId)?.value || '';
    const lines = text.split('\n').filter(l => l.trim());
    const ok    = lines.filter(l => parseFn(l)).length;
    const el    = document.getElementById(previewId); if (!el) return;
    if (!lines.length) { el.textContent = ''; return; }
    el.textContent = ok > 0
      ? `✓ ${ok} linha${ok > 1 ? 's' : ''} reconhecida${ok > 1 ? 's' : ''}`
      : '⚠ Nenhuma linha reconhecida';
    el.style.color = ok > 0 ? 'var(--green)' : 'var(--orange)';
  });
}

function _parseXlsxDate(raw) {
  if (typeof raw === 'number') return new Date(Math.round((raw - 25569) * 86400000));
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const d = m ? new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T12:00:00`) : new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function loadSlaDsXlsx(event) {
  const file = event.target.files[0]; if (!file) return;
  document.getElementById('sla-xlsx-name').textContent   = file.name;
  document.getElementById('sla-xlsx-status').textContent = 'Processando...';
  document.getElementById('sla-xlsx-status').className   = 'import-wait';

  const ab   = await file.arrayBuffer();
  const wb   = XLSX.read(ab, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

  // Detect columns by header name (row 0), case-insensitive
  const hdrs = (rows[0] || []).map(h => String(h || '').trim().toLowerCase());
  const ci = name => hdrs.findIndex(h => h === name);
  const cHdr = {
    base:   ci('base'),
    sla:    hdrs.findIndex(h => /sla/.test(h) && !/rec|ent/.test(h)),
    ds:     hdrs.findIndex(h => /^ds/.test(h) && !/rec|ent/.test(h)),
    data:   hdrs.findIndex(h => h === 'data' || h === 'date'),
    slaRec: hdrs.findIndex(h => /sla/.test(h) && /rec/.test(h)),
    slaEnt: hdrs.findIndex(h => /sla/.test(h) && /ent/.test(h)),
    dsRec:  hdrs.findIndex(h => /ds/.test(h) && /rec/.test(h)),
    dsEnt:  hdrs.findIndex(h => /ds/.test(h) && /ent/.test(h)),
  };
  // Positional fallback: if no header row found, detect by column count
  const hasHeaders = cHdr.base >= 0 || cHdr.sla >= 0;
  const useNewPos  = !hasHeaders && (rows[1] || []).length >= 6;
  const col = hasHeaders ? cHdr : (useNewPos
    ? { base: 0, sla: 1, slaRec: 2, slaEnt: 3, ds: 4, dsRec: 5, dsEnt: 6, data: 7 }
    : { base: 0, sla: 1, slaRec: -1, slaEnt: -1, ds: 2, dsRec: -1, dsEnt: -1, data: 3 });

  const getNum = (r, i) => i >= 0 && r[i] != null ? parseFloat(r[i]) : NaN;
  const getInt = (r, i) => i >= 0 && r[i] != null ? parseQty(r[i]) : null;

  _slaDsXlsxParsed = [];
  const startRow = hasHeaders ? 1 : 0;
  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i]; if (!r || !r[col.base]) continue;
    const rawSla = getNum(r, col.sla);
    const rawDs  = getNum(r, col.ds);
    if (isNaN(rawSla) && isNaN(rawDs)) continue;
    const dateObj = _parseXlsxDate(r[col.data]); if (!dateObj) continue;
    _slaDsXlsxParsed.push({
      ts: dateObj.toISOString(), data: dateObj.toLocaleDateString('pt-BR'),
      base:    resolveBase(String(r[col.base])),
      sla_pct: isNaN(rawSla) ? null : normalizePct(rawSla),
      ds_pct:  isNaN(rawDs)  ? null : normalizePct(rawDs),
      sla_rec: getInt(r, col.slaRec), sla_ent: getInt(r, col.slaEnt),
      ds_rec:  getInt(r, col.dsRec),  ds_ent:  getInt(r, col.dsEnt),
    });
  }

  document.getElementById('sla-xlsx-status').textContent = `✓ ${_slaDsXlsxParsed.length} registros`;
  document.getElementById('sla-xlsx-status').className   = 'import-ok';

  const hasRecEnt = _slaDsXlsxParsed.some(r => r.sla_rec != null || r.ds_rec != null);
  const thStyle   = 'padding:4px 8px;color:var(--text3);border-bottom:1px solid var(--border)';
  const headEl    = document.getElementById('sla-xlsx-preview-head');
  if (headEl) headEl.innerHTML = `
    <th style="${thStyle};text-align:left">Base</th>
    <th style="${thStyle}">SLA%</th>${hasRecEnt ? `<th style="${thStyle}">Rec</th><th style="${thStyle}">Ent</th>` : ''}
    <th style="${thStyle}">DS%</th>${hasRecEnt ? `<th style="${thStyle}">Rec</th><th style="${thStyle}">Ent</th>` : ''}
    <th style="${thStyle}">Data</th>`;

  const colSpan = 4 + (hasRecEnt ? 4 : 0);
  const tbody = document.getElementById('sla-xlsx-preview-tbody');
  if (tbody) {
    tbody.innerHTML = _slaDsXlsxParsed.slice(0, 8).map(r => `<tr>
      <td style="padding:3px 8px">${r.base.toUpperCase()}</td>
      <td style="padding:3px 8px;text-align:center">${r.sla_pct != null ? fmtPct(r.sla_pct) : '—'}</td>
      ${hasRecEnt ? `<td style="padding:3px 8px;text-align:center;color:var(--text3)">${r.sla_rec ?? '—'}</td><td style="padding:3px 8px;text-align:center;color:var(--text3)">${r.sla_ent ?? '—'}</td>` : ''}
      <td style="padding:3px 8px;text-align:center">${r.ds_pct != null ? fmtPct(r.ds_pct) : '—'}</td>
      ${hasRecEnt ? `<td style="padding:3px 8px;text-align:center;color:var(--text3)">${r.ds_rec ?? '—'}</td><td style="padding:3px 8px;text-align:center;color:var(--text3)">${r.ds_ent ?? '—'}</td>` : ''}
      <td style="padding:3px 8px;color:var(--text3)">${r.data}</td>
    </tr>`).join('') +
    (_slaDsXlsxParsed.length > 8
      ? `<tr><td colspan="${colSpan}" style="padding:4px 8px;color:var(--text3)">… e mais ${_slaDsXlsxParsed.length - 8}</td></tr>` : '');
  }
  const preview = document.getElementById('sla-xlsx-preview');
  if (preview) preview.style.display = '';
}

async function saveSlaDs() {
  const msgEl    = document.getElementById('sla-ds-modal-msg');
  const isXlsx   = document.getElementById('sla-panel-xlsx')?.style.display !== 'none';
  let newRecords = [];

  if (isXlsx) {
    if (!_slaDsXlsxParsed.length) {
      if (msgEl) { msgEl.textContent = 'Nenhum dado carregado.'; msgEl.className = 'create-msg err'; }
      return;
    }
    newRecords = _slaDsXlsxParsed;
  } else {
    const dateInput = document.getElementById('sla-ds-date');
    if (!dateInput?.value) {
      if (msgEl) { msgEl.textContent = 'Selecione uma data.'; msgEl.className = 'create-msg err'; }
      return;
    }
    const dateObj = new Date(dateInput.value + 'T12:00:00');
    const dataStr = dateObj.toLocaleDateString('pt-BR');
    const ts      = dateObj.toISOString();

    const slaMap = {};
    (document.getElementById('sla-text')?.value || '').split('\n').forEach(line => {
      const p = parseSlaLine(line);
      if (p) slaMap[p.base] = { sla_pct: p.sla_pct, sla_rec: p.sla_rec, sla_ent: p.sla_ent };
    });
    const dsMap = {};
    (document.getElementById('ds-text')?.value || '').split('\n').forEach(line => {
      const p = parseDsLine(line);
      if (p) dsMap[p.base] = { ds_pct: p.ds_pct, ds_rec: p.ds_rec, ds_ent: p.ds_ent };
    });
    const allBases = new Set([...Object.keys(slaMap), ...Object.keys(dsMap)]);
    allBases.forEach(base => {
      const s = slaMap[base] || {}, d = dsMap[base] || {};
      newRecords.push({ ts, data: dataStr, base,
        sla_pct: s.sla_pct ?? null, sla_rec: s.sla_rec ?? null, sla_ent: s.sla_ent ?? null,
        ds_pct:  d.ds_pct  ?? null, ds_rec:  d.ds_rec  ?? null, ds_ent:  d.ds_ent  ?? null });
    });
    if (!newRecords.length) {
      if (msgEl) { msgEl.textContent = 'Nenhuma linha reconhecida.'; msgEl.className = 'create-msg err'; }
      return;
    }
  }

  if (msgEl) { msgEl.textContent = 'Salvando...'; msgEl.className = 'create-msg'; }
  const existing = await Storage.getJSON(SLA_DS_PATH) || [];
  const kept     = existing.filter(r => !newRecords.some(n => n.data === r.data && n.base === r.base));
  const updated  = [...kept, ...newRecords];
  const ok = await Storage.put(SLA_DS_PATH, JSON.stringify(updated, null, 2), `sla-ds import ${new Date().toLocaleDateString('pt-BR')}`);
  if (ok) {
    slaDsHistory = updated;
    if (msgEl) { msgEl.textContent = `✓ ${newRecords.length} registro${newRecords.length > 1 ? 's' : ''} salvo${newRecords.length > 1 ? 's' : ''}!`; msgEl.className = 'create-msg ok'; }
    setTimeout(() => { closeSlasDsModal(); renderSlaDsContent(); }, 900);
  } else {
    if (msgEl) { msgEl.textContent = 'Erro ao salvar.'; msgEl.className = 'create-msg err'; }
  }
}

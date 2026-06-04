function set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function updateAll() {
  const s = calcSLA(); const d = calcDS();
  set('g-sla-pct', s.pct.toFixed(1) + '%'); set('g-sla-sub', s.total + ' pacotes');
  const bar = document.getElementById('g-sla-bar'); if (bar) bar.style.width = Math.min(s.pct, 100) + '%';
  set('g-e', s.entregues); set('g-r', s.emRota);     set('g-o', s.ocorr);
  set('g-f', s.faltante);  set('g-d', s.faltamMeta); set('g-x', s.outros);
  const metaEl = document.getElementById('g-d');
  if (metaEl) metaEl.style.color = s.faltamMeta === 0 ? 'var(--green)' : 'var(--orange)';
  set('g-ds-pct', d.pct.toFixed(1) + '%'); set('g-ds-sub', d.motoristas + ' motoristas');
  const bds = document.getElementById('g-ds-bar'); if (bds) bds.style.width = Math.min(d.pct, 100) + '%';
  set('g-ds-e', d.totalE); set('g-ds-r', d.totalR); set('g-ds-o', d.totalO);
  set('sla-pct', s.pct.toFixed(1) + '%'); set('sla-tot', s.total + ' pacotes');
  const pt = v => s.total > 0 ? (v / s.total * 100).toFixed(1) + '%' : '0%';
  set('sc-e', s.entregues); set('sp-e', pt(s.entregues));
  set('sc-r', s.emRota);    set('sp-r', pt(s.emRota));
  set('sc-o', s.ocorr);     set('sp-o', pt(s.ocorr));
  set('sc-f', s.faltante);  set('sp-f', pt(s.faltante));
  set('sc-d', s.dev);       set('sp-d', pt(s.dev));
  renderDSTables(); renderSLATable(); updateCharts(); renderSemiCharts(s, d);
}

function renderDSTables() {
  ['gtbody', 'ds-tbody'].forEach(id => {
    const tbody = document.getElementById(id); if (!tbody) return;
    if (!xlsxData.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Importe a base DS (.xlsx)</td></tr>'; return; }
    tbody.innerHTML = xlsxData.map(d => {
      const dp = d.saiu > 0 ? (d.entregues / d.saiu * 100) : 0;
      return `<tr><td>${d.driver}</td><td>${d.saiu}</td><td>${d.entregues}</td><td>${d.emRota}</td><td>${d.ocorrencias}</td><td>${pctBadge(dp)}</td></tr>`;
    }).join('');
  });
}

function renderSLATable() {
  const tbody = document.getElementById('sla-tbody'); if (!tbody) return;
  if (!csvData.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Importe a base SLA (.csv)</td></tr>'; return; }
  const dm = {};
  csvData.forEach(p => {
    const n = p.driver || 'Desconhecido';
    if (!dm[n]) dm[n] = { total: 0, e: 0, r: 0, o: 0, f: 0 };
    const ms = STATUS_MAP[p.status] || p.status;
    dm[n].total++;
    if      (ms === 'Entregue')   dm[n].e++;
    else if (ms === 'Em rota')    dm[n].r++;
    else if (ms === 'Ocorrência') dm[n].o++;
    else if (ms === 'Faltante')   dm[n].f++;
  });
  tbody.innerHTML = Object.entries(dm).map(([n, d]) => {
    const sp = d.total > 0 ? (d.e / d.total * 100) : 0;
    return `<tr><td>${n}</td><td>${d.total}</td><td>${d.e}</td><td>${d.r}</td><td>${d.o}</td><td>${d.f}</td><td>${pctBadge(sp)}</td></tr>`;
  }).join('');
}

function renderHistoricoFromLogs() {
  const el = document.getElementById('historico-tl'); if (!el) return;
  if (!logsData.length) { el.innerHTML = '<div class="empty">Nenhum snapshot registrado ainda.</div>'; return; }
  el.innerHTML = [...logsData].reverse().map((s, i, arr) => {
    const prev = arr[i + 1];
    const sd   = prev ? (s.sla_pct - prev.sla_pct).toFixed(1) : null;
    const dd   = prev ? (s.ds_pct  - prev.ds_pct).toFixed(1)  : null;
    const dt   = v => v === null ? '' : `<div class="tl-d ${parseFloat(v) >= 0 ? 'up' : 'dn'}">${parseFloat(v) >= 0 ? '▲' : '▼'} ${Math.abs(v)}%</div>`;
    return `<div class="tl-item">
      <div class="tl-date">${s.data || ''}</div>
      <div class="tl-time">${s.hora || ''}</div>
      <div class="tl-metrics">
        <div class="tl-m"><div class="tl-v" style="color:var(--blue)">${s.sla_pct.toFixed(1)}%</div><div class="tl-l">SLA</div>${dt(sd)}</div>
        <div class="tl-m"><div class="tl-v" style="color:var(--green)">${s.ds_pct.toFixed(1)}%</div><div class="tl-l">DS</div>${dt(dd)}</div>
        <div class="tl-m"><div class="tl-v">${s.total}</div><div class="tl-l">Pacotes</div></div>
        <div class="tl-m"><div class="tl-v">${s.entregues}</div><div class="tl-l">Entregues</div></div>
      </div>
    </div>`;
  }).join('');
}


function _mkLineChart(canvasId, vals, color) {
  const c = document.getElementById(canvasId); if (!c) return;
  const ex = Chart.getChart(c); if (ex) ex.destroy();
  const data   = logsData.length ? logsData : [];
  const labels = data.map(s => `${s.data || ''} ${s.hora || ''}`);
  new Chart(c, {
    type: 'line',
    data: { labels, datasets: [
      { data: vals, borderColor: color, backgroundColor: color + '18', tension: .3, fill: true },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#2a3550' }, ticks: { color: '#8a9ab5', font: { size: 10 }, maxTicksLimit: 10 } },
        y: { min: 0, max: 100, grid: { color: '#2a3550' }, ticks: { color: '#8a9ab5', font: { size: 10 }, callback: v => v + '%' } },
      },
      elements: { point: { radius: 3, hoverRadius: 5 } },
    },
  });
}

function updateCharts() {
  const data    = logsData.length ? logsData : [];
  const slaVals = data.map(s => parseFloat(s.sla_pct.toFixed(1)));
  const dsVals  = data.map(s => parseFloat(s.ds_pct.toFixed(1)));
  _mkLineChart('chartGeralSLA', slaVals, '#3b82f6');
  _mkLineChart('chartGeralDS',  dsVals,  '#22c55e');
}

function renderSemiCharts(s, d) {
  const mkGauge = (canvasId, pct, color) => {
    const c = document.getElementById(canvasId); if (!c) return;
    const ex = Chart.getChart(c); if (ex) ex.destroy();
    const val = Math.min(Math.max(pct, 0), 100);
    new Chart(c, {
      type: 'doughnut',
      data: {
        datasets: [{
          data:            [val, 100 - val],
          backgroundColor: [color, '#ef4444'],
          borderWidth:     0,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        rotation:            -90,
        circumference:       180,
        cutout:              '72%',
        plugins:             { legend: { display: false }, tooltip: { enabled: false } },
      },
    });
  };
  mkGauge('g-sla-chart', s.pct, '#22c55e');
  mkGauge('g-ds-chart',  d.pct, '#22c55e');
}

function showOutrosModal() {
  const known = new Set(['Entregue', 'Em rota', 'Ocorrência', 'Faltante']);
  const counts = {};
  csvData.forEach(p => {
    const ms = STATUS_MAP[p.status] || p.status || 'Desconhecido';
    if (!known.has(ms)) counts[ms] = (counts[ms] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total   = entries.reduce((acc, [, n]) => acc + n, 0);

  const existing = document.getElementById('outros-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'outros-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9000;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:24px;width:380px;max-width:94vw;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:15px;font-weight:600">Outros — Detalhamento</div>
        <button onclick="document.getElementById('outros-modal').remove()" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:18px;line-height:1">✕</button>
      </div>
      ${!entries.length
        ? '<div class="empty">Nenhum pacote nesta categoria.</div>'
        : entries.map(([status, count]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:13px">${status}</span>
            <span style="font-size:13px;font-weight:600;color:var(--text2)">${count}</span>
          </div>`).join('')
      }
      ${entries.length
        ? `<div style="margin-top:12px;font-size:12px;color:var(--text3)">Total: ${total} pacote${total !== 1 ? 's' : ''}</div>`
        : ''
      }
    </div>`;
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

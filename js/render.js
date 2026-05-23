function set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function updateAll() {
  const s = calcSLA(); const d = calcDS();
  set('g-sla-pct', s.pct.toFixed(1) + '%'); set('g-sla-sub', s.total + ' pacotes');
  const bar = document.getElementById('g-sla-bar'); if (bar) bar.style.width = Math.min(s.pct, 100) + '%';
  set('g-e', s.entregues); set('g-r', s.emRota); set('g-o', s.ocorr);
  set('g-f', s.faltante);  set('g-d', s.dev);    set('g-x', s.outros);
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
  renderDSTables(); renderSLATable(); updateCharts();
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


function updateCharts() {
  const data    = logsData.length ? logsData : [];
  const labels  = data.map(s => `${s.data || ''} ${s.hora || ''}`);
  const slaVals = data.map(s => parseFloat(s.sla_pct.toFixed(1)));
  const dsVals  = data.map(s => parseFloat(s.ds_pct.toFixed(1)));
  const c = document.getElementById('chartGeral'); if (!c) return;
  const ex = Chart.getChart(c); if (ex) ex.destroy();
  new Chart(c, {
    type: 'line',
    data: { labels, datasets: [
      { label:'SLA', data:slaVals, borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.1)', tension:.3, fill:true },
      { label:'DS',  data:dsVals,  borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,0.1)',  tension:.3, fill:true, borderDash:[5,3] },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#8a9ab5', font: { size: 11 } } } },
      scales: {
        x: { grid: { color: '#2a3550' }, ticks: { color: '#8a9ab5', font: { size: 10 }, maxTicksLimit: 10 } },
        y: { min: 0, max: 100, grid: { color: '#2a3550' }, ticks: { color: '#8a9ab5', font: { size: 10 }, callback: v => v + '%' } },
      },
      elements: { point: { radius: 3, hoverRadius: 5 } },
    },
  });
}

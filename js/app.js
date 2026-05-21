function buildSidebar() {
  const navEl = document.getElementById('sidebar-nav');
  if (isAdmin) {
    navEl.innerHTML = `
      <div class="nav-section">
        <div class="nav-section-label">Principal</div>
        <div class="nav-item" onclick="nav('admin-home',this)" data-page="admin-home">
          <span class="nav-item-icon">⬛</span>Dashboard
        </div>
      </div>
      <div class="nav-section">
        <div class="nav-section-label">Operações</div>
        ${ALL_OPS.map(op => `
          <div class="nav-item nav-sub-item" onclick="nav('admin-op-${op}',this)" data-page="admin-op-${op}">
            ${OP_ICONS[op] || '📦'} ${OP_LABELS[op]}
          </div>`).join('')}
      </div>
      <div class="nav-section">
        <div class="nav-section-label">Gestão</div>
        <div class="nav-item" onclick="nav('admin-financeiro',this)" data-page="admin-financeiro">
          <span class="nav-item-icon">💰</span>Financeiro
        </div>
        <div class="nav-item" onclick="nav('admin-pessoas',this)" data-page="admin-pessoas">
          <span class="nav-item-icon">👥</span>Gestão de Pessoas
        </div>
      </div>
      <div class="nav-section">
        <div class="nav-section-label">Sistema</div>
        <div class="nav-item" onclick="nav('admin-users',this)" data-page="admin-users">
          <span class="nav-item-icon">⚙️</span>Usuários
        </div>
      </div>`;
  } else {
    navEl.innerHTML = `
      <div class="nav-section">
        <div class="nav-section-label">Principal</div>
        <div class="nav-item" onclick="nav('sup-home',this)" data-page="sup-home">
          <span class="nav-item-icon">⬛</span>Dashboard
        </div>
      </div>
      <div class="nav-section">
        <div class="nav-section-label">SLA / DS</div>
        <div class="nav-item nav-sub-item" onclick="nav('sup-hoje',this)" data-page="sup-hoje">📅 Hoje</div>
        <div class="nav-item nav-sub-item" onclick="nav('sup-historico',this)" data-page="sup-historico">📈 Histórico</div>
      </div>
      <div class="nav-section">
        <div class="nav-section-label">Operação</div>
        <div class="nav-item" onclick="nav('sup-pnr',this)" data-page="sup-pnr">
          <span class="nav-item-icon">📦</span>PNRs
        </div>
        <div class="nav-item" onclick="nav('sup-motoristas',this)" data-page="sup-motoristas">
          <span class="nav-item-icon">🚗</span>Motoristas
        </div>
        <div class="nav-item" onclick="nav('sup-liberacao',this)" data-page="sup-liberacao">
          <span class="nav-item-icon">✅</span>Liberação Pag.
        </div>
      </div>
      <div class="nav-section">
        <div class="nav-section-label">Suporte</div>
        <div class="nav-item" onclick="nav('sup-problema',this)" data-page="sup-problema">
          <span class="nav-item-icon">⚠️</span>Relatar Problema
        </div>
      </div>`;
  }
}

function nav(page, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  else { const f = document.querySelector(`[data-page="${page}"]`); if (f) f.classList.add('active'); }
  document.getElementById('topbar-title').textContent = pageTitle(page);
  document.getElementById('main-content').innerHTML   = renderPage(page);
  afterRender(page);
}

function navigateTo(page) { nav(page, null); }

function pageTitle(p) {
  const t = {
    'admin-home':'Dashboard', 'admin-financeiro':'Financeiro',
    'admin-pessoas':'Gestão de Pessoas', 'admin-users':'Usuários',
    'sup-home':'Dashboard', 'sup-hoje':'SLA & DS — Hoje',
    'sup-historico':'Histórico', 'sup-pnr':'PNRs',
    'sup-motoristas':'Motoristas', 'sup-liberacao':'Liberação de Pagamento',
    'sup-problema':'Relatar Problema',
  };
  if (p.startsWith('admin-op-'))   return `Operação — ${OP_LABELS[p.replace('admin-op-', '')] || p.replace('admin-op-', '')}`;
  if (p.startsWith('admin-base-')) { const [,op,base] = p.split('-base-'); return `${OP_LABELS[op] || op} / ${base}`; }
  return t[p] || p;
}

async function afterRender(page) {
  if (page === 'sup-hoje')       { updateAll(); }
  if (page === 'sup-historico')  { await loadLogsForCurrentUser(); renderHistoricoFromLogs(); updateCharts(); }
  if (page === 'sup-motoristas') { renderSLATable(); renderDSTables(); }
  if (page === 'admin-users')    { loadAdminClients(); }
  if (page.startsWith('admin-op-')) {
    currentOp   = page.replace('admin-op-', '');
    currentBase = null;
    loadOpLogo(currentOp);
    await loadBasesForOp(currentOp);
  }
}

loadCompanyLogo();

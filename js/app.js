function canSee(page) {
  if (isAdmin) return true;
  const allowed = ROLE_PAGES[userRole];
  return !allowed || allowed.includes(page);
}

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
        ${ALL_OPS.map(op => {
          const logo = Storage.isLocal() ? `data/${OPS_DIR}/${op}/logo.png` : `${GH_RAW}/${OPS_DIR}/${op}/logo.png`;
          return `
          <div class="nav-item nav-sub-item" onclick="nav('admin-op-${op}',this)" data-page="admin-op-${op}">
            <img src="${logo}" class="nav-op-logo" onerror="this.style.display='none'"> ${OP_LABELS[op]}
          </div>`;
        }).join('')}
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
    const s = (page, cls, icon, label) => canSee(page)
      ? `<div class="nav-item ${cls}" onclick="nav('${page}',this)" data-page="${page}">${icon}${label}</div>`
      : '';
    const slaItems    = canSee('sup-hoje') || canSee('sup-historico');
    const opItems     = canSee('sup-pnr') || canSee('sup-motoristas') || canSee('sup-liberacao');
    const suporteItem = canSee('sup-problema');
    navEl.innerHTML = `
      ${canSee('sup-home') ? `
      <div class="nav-section">
        <div class="nav-section-label">Principal</div>
        <div class="nav-item" onclick="nav('sup-home',this)" data-page="sup-home">
          <span class="nav-item-icon">⬛</span>Dashboard
        </div>
      </div>` : ''}
      ${slaItems ? `
      <div class="nav-section">
        <div class="nav-section-label">SLA / DS</div>
        ${s('sup-hoje',      'nav-sub-item', '📅 ', 'Hoje')}
        ${s('sup-historico', 'nav-sub-item', '📈 ', 'Histórico')}
      </div>` : ''}
      ${opItems ? `
      <div class="nav-section">
        <div class="nav-section-label">Operação</div>
        ${s('sup-pnr',       '', '<span class="nav-item-icon">📦</span>', 'PNRs')}
        ${s('sup-motoristas','', '<span class="nav-item-icon">🚗</span>', 'Motoristas')}
        ${s('sup-liberacao', '', '<span class="nav-item-icon">✅</span>', 'Liberação Pag.')}
      </div>` : ''}
      ${suporteItem ? `
      <div class="nav-section">
        <div class="nav-section-label">Suporte</div>
        ${s('sup-problema',  '', '<span class="nav-item-icon">⚠️</span>', 'Relatar Problema')}
      </div>` : ''}`;
  }
}

function nav(page, el) {
  if (!canSee(page)) return;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  else { const f = document.querySelector(`[data-page="${page}"]`); if (f) f.classList.add('active'); }
  document.getElementById('topbar-title').textContent = pageTitle(page);
  document.getElementById('main-content').innerHTML   = renderPage(page);
  if (!page.startsWith('admin-op-')) clearOpLogo();
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
    'admin-op-shopee':'Shopee',
    'admin-op-shopee-sla-ds':'Shopee — SLA / DS',
    'admin-op-shopee-pod':'Shopee — POD',
    'admin-op-shopee-pnr':'Shopee — PNR',
    'admin-op-shopee-monitoramento':'Shopee — Monitoramento',
  };
  if (p.startsWith('admin-op-') && !p.startsWith('admin-op-shopee'))
    return `Operação — ${OP_LABELS[p.replace('admin-op-', '')] || p.replace('admin-op-', '')}`;
  if (p.startsWith('admin-base-')) { const [,op,base] = p.split('-base-'); return `${OP_LABELS[op] || op} / ${base}`; }
  return t[p] || p;
}

async function afterRender(page) {
  if (page === 'sup-hoje')       { updateAll(); }
  if (page === 'sup-historico')  { await loadLogsForCurrentUser(); renderHistoricoFromLogs(); updateCharts(); }
  if (page === 'sup-motoristas') { renderSLATable(); renderDSTables(); }
  if (page === 'admin-users')    { loadAdminClients(); }
  if (page === 'admin-op-shopee') {
    currentOp   = 'shopee';
    currentBase = null;
    loadOpLogo('shopee');
  }
  if (page === 'admin-op-shopee-monitoramento') {
    currentOp   = 'shopee';
    currentBase = null;
    loadOpLogo('shopee');
    await loadBasesForOp('shopee');
  }
  if (page === 'admin-op-shopee-sla-ds') {
    currentOp   = 'shopee';
    currentBase = null;
    loadOpLogo('shopee');
    await loadSlaDsPage();
  }
  if (page.startsWith('admin-op-') && page !== 'admin-op-shopee' && !page.startsWith('admin-op-shopee-')) {
    currentOp   = page.replace('admin-op-', '');
    currentBase = null;
    loadOpLogo(currentOp);
    await loadBasesForOp(currentOp);
  }
}

loadCompanyLogo();
autoLoginAdmin();

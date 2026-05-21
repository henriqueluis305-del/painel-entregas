function renderPage(p) {
  if (p === 'admin-home')       return renderAdminHome();
  if (p === 'admin-users')      return renderAdminUsers();
  if (p === 'admin-financeiro') return wip('Financeiro', 'Módulo financeiro em desenvolvimento.', '💰');
  if (p === 'admin-pessoas')    return wip('Gestão de Pessoas', 'Módulo de RH em desenvolvimento.', '👥');
  if (p.startsWith('admin-op-')) return renderAdminOp(p.replace('admin-op-', ''));
  if (p === 'sup-home')         return renderSupHome();
  if (p === 'sup-hoje')         return renderHoje();
  if (p === 'sup-historico')    return renderHistoricoPage();
  if (p === 'sup-pnr')          return wip('PNRs', 'Módulo de PNRs em desenvolvimento.', '📦');
  if (p === 'sup-motoristas')   return renderMotoristasPage();
  if (p === 'sup-liberacao')    return renderLiberacao();
  if (p === 'sup-problema')     return wip('Relatar Problema', 'Em desenvolvimento.', '⚠️');
  return wip(p, 'Página em construção.', '🔧');
}

function wip(title, sub, icon) {
  return `<div class="wip-wrap">
    <div class="wip-icon">${icon}</div>
    <div class="wip-badge">Em construção</div>
    <div class="wip-title">${title}</div>
    <div class="wip-sub">${sub}</div>
  </div>`;
}

function slaBlocksHTML() {
  return `
    <div class="blocks-row">
      <div class="block">
        <div class="block-title"><span class="block-dot" style="background:var(--blue)"></span>SLA — Nível de Serviço</div>
        <div class="block-pct" id="g-sla-pct" style="color:var(--blue)">—%</div>
        <div class="block-sub" id="g-sla-sub">0 pacotes</div>
        <div class="bar-wrap"><div class="bar-fill" id="g-sla-bar" style="background:var(--blue);width:0%"></div></div>
        <div class="mini-grid">
          <div class="mini"><div class="mini-val" style="color:var(--green)" id="g-e">0</div><div class="mini-lbl">Entregues</div></div>
          <div class="mini"><div class="mini-val" style="color:var(--blue)" id="g-r">0</div><div class="mini-lbl">Em Rota</div></div>
          <div class="mini"><div class="mini-val" style="color:var(--red)" id="g-o">0</div><div class="mini-lbl">Ocorrências</div></div>
          <div class="mini"><div class="mini-val" style="color:var(--gray)" id="g-f">0</div><div class="mini-lbl">Faltantes</div></div>
          <div class="mini"><div class="mini-val" style="color:var(--orange)" id="g-d">0</div><div class="mini-lbl">Devoluções</div></div>
          <div class="mini"><div class="mini-val" style="color:var(--text2)" id="g-x">0</div><div class="mini-lbl">Outros</div></div>
        </div>
      </div>
      <div class="block">
        <div class="block-title"><span class="block-dot" style="background:var(--green)"></span>DS — Mesmo Dia</div>
        <div class="block-pct" id="g-ds-pct" style="color:var(--green)">—%</div>
        <div class="block-sub" id="g-ds-sub">0 motoristas</div>
        <div class="bar-wrap"><div class="bar-fill" id="g-ds-bar" style="background:var(--green);width:0%"></div></div>
        <div class="mini-grid">
          <div class="mini"><div class="mini-val" style="color:var(--green)" id="g-ds-e">0</div><div class="mini-lbl">Entregues</div></div>
          <div class="mini"><div class="mini-val" style="color:var(--blue)" id="g-ds-r">0</div><div class="mini-lbl">Em Rota</div></div>
          <div class="mini"><div class="mini-val" style="color:var(--red)" id="g-ds-o">0</div><div class="mini-lbl">Ocorrências</div></div>
        </div>
      </div>
    </div>`;
}

function chartBoxHTML(id, title) {
  return `<div class="chart-box"><div class="chart-box-title">${title}</div><div class="chart-h"><canvas id="${id}" role="img" aria-label="${title}">Sem dados.</canvas></div></div>`;
}

function driverTableHTML(tbodyId, title) {
  return `
    <div class="tbl-box">
      <div class="tbl-head"><div class="tbl-head-title">${title}</div><input class="tbl-search" placeholder="Buscar motorista..." oninput="filterTbl(this.value,'${tbodyId}')"></div>
      <table><thead><tr>
        <th onclick="sortTbl('${tbodyId}',0)">Motorista</th><th onclick="sortTbl('${tbodyId}',1)">Saiu</th>
        <th onclick="sortTbl('${tbodyId}',2)">Entregues</th><th onclick="sortTbl('${tbodyId}',3)">Em Rota</th>
        <th onclick="sortTbl('${tbodyId}',4)">Ocorrências</th><th onclick="sortTbl('${tbodyId}',5)">DS%</th>
      </tr></thead>
      <tbody id="${tbodyId}"><tr><td colspan="6" class="empty">Importe a base DS (.xlsx)</td></tr></tbody></table>
    </div>`;
}

function renderAdminHome() {
  return `
    <div style="margin-bottom:20px">
      <div style="font-size:20px;font-weight:600;margin-bottom:4px">Dashboard Geral</div>
      <div style="font-size:13px;color:var(--text2)">Selecione uma operação para ver os dados</div>
    </div>
    <div class="dash-grid">
      ${ALL_OPS.map(op => `
        <div class="dash-card" onclick="nav('admin-op-${op}',null)">
          <div class="dash-card-icon">${OP_ICONS[op]}</div>
          <div class="dash-card-title">${OP_LABELS[op]}</div>
          <div class="dash-card-sub">Ver bases e histórico</div>
        </div>`).join('')}
      <div class="dash-card" onclick="nav('admin-financeiro',null)">
        <div class="dash-card-icon">💰</div><div class="dash-card-title">Financeiro</div>
        <div class="dash-card-sub" style="color:var(--orange)">Em construção</div>
      </div>
      <div class="dash-card" onclick="nav('admin-pessoas',null)">
        <div class="dash-card-icon">👥</div><div class="dash-card-title">Gestão de Pessoas</div>
        <div class="dash-card-sub" style="color:var(--orange)">Em construção</div>
      </div>
      <div class="dash-card" onclick="nav('admin-users',null)">
        <div class="dash-card-icon">⚙️</div><div class="dash-card-title">Usuários</div>
        <div class="dash-card-sub">Gerenciar acessos</div>
      </div>
    </div>`;
}

function renderAdminOp(op) {
  return `
    <div style="margin-bottom:16px">
      <div style="font-size:13px;color:var(--text2);margin-bottom:10px">Selecione uma base:</div>
      <div class="base-selector" id="base-list"><div class="empty">Carregando bases...</div></div>
    </div>
    <div id="base-panel"></div>`;
}

function basePanelHTML(op, base) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div style="font-size:14px;font-weight:600">${OP_LABELS[op]} / <span style="color:var(--blue)">${base.toUpperCase()}</span></div>
      <button class="btn-primary-sm" onclick="saveSnapshot('${op}','${base}')">📸 Registrar Snapshot</button>
    </div>
    <div class="snap-bar" id="snap-bar"></div>
    <div class="import-bar">
      <div class="import-slot">
        <input type="file" id="csvInput" accept=".csv" onchange="loadCSV(event)">
        <div class="import-lbl">Base SLA</div>
        <div class="import-name" id="csvName">Selecionar .CSV</div>
        <div class="import-wait" id="csvStatus">Aguardando</div>
      </div>
      <div class="import-slot">
        <input type="file" id="xlsxInput" accept=".xlsx,.xls" onchange="loadXLSX(event)">
        <div class="import-lbl">Base DS</div>
        <div class="import-name" id="xlsxName">Selecionar .XLSX</div>
        <div class="import-wait" id="xlsxStatus">Aguardando</div>
      </div>
    </div>
    ${slaBlocksHTML()}
    ${chartBoxHTML('chartGeral', 'Evolução SLA e DS — snapshots desta base')}
    ${driverTableHTML('gtbody', 'Motoristas — DS')}
    <div class="chart-box">
      <div class="chart-box-title">Histórico de snapshots — ${base.toUpperCase()}</div>
      <div class="timeline" id="historico-tl"><div class="empty">Nenhum snapshot registrado ainda.</div></div>
    </div>`;
}

function renderSupHome() {
  return `
    <div style="margin-bottom:20px">
      <div style="font-size:20px;font-weight:600;margin-bottom:4px">Olá, supervisor</div>
      <div style="font-size:13px;color:var(--text2)">Operação: <strong>${OP_LABELS[userOp] || userOp}</strong>${userBase ? ' — Base: <strong>' + userBase.toUpperCase() + '</strong>' : ''}</div>
    </div>
    <div class="dash-grid">
      <div class="dash-card" onclick="nav('sup-hoje',null)"><div class="dash-card-icon">📅</div><div class="dash-card-title">SLA & DS Hoje</div><div class="dash-card-sub">Importar e monitorar</div></div>
      <div class="dash-card" onclick="nav('sup-historico',null)"><div class="dash-card-icon">📈</div><div class="dash-card-title">Histórico</div><div class="dash-card-sub">Snapshots salvos no GitHub</div></div>
      <div class="dash-card" onclick="nav('sup-pnr',null)"><div class="dash-card-icon">📦</div><div class="dash-card-title">PNRs</div><div class="dash-card-sub" style="color:var(--orange)">Em construção</div></div>
      <div class="dash-card" onclick="nav('sup-motoristas',null)"><div class="dash-card-icon">🚗</div><div class="dash-card-title">Motoristas</div><div class="dash-card-sub">Visão individual</div></div>
      <div class="dash-card" onclick="nav('sup-liberacao',null)"><div class="dash-card-icon">✅</div><div class="dash-card-title">Liberação Pagamento</div><div class="dash-card-sub">OK / NOK</div></div>
      <div class="dash-card" onclick="nav('sup-problema',null)"><div class="dash-card-icon">⚠️</div><div class="dash-card-title">Relatar Problema</div><div class="dash-card-sub" style="color:var(--orange)">Em construção</div></div>
    </div>`;
}

function renderHoje() {
  const op   = userOp   || '—';
  const base = userBase || '—';
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div style="font-size:13px;color:var(--text2)">${OP_LABELS[op] || op} / <strong>${base.toUpperCase()}</strong></div>
      <button class="btn-primary-sm" onclick="saveSnapshot('${op}','${base}')">📸 Registrar Snapshot</button>
    </div>
    <div class="snap-bar" id="snap-bar"></div>
    <div class="import-bar">
      <div class="import-slot">
        <input type="file" id="csvInput" accept=".csv" onchange="loadCSV(event)">
        <div class="import-lbl">Base SLA</div>
        <div class="import-name" id="csvName">Selecionar .CSV</div>
        <div class="import-wait" id="csvStatus">Aguardando</div>
      </div>
      <div class="import-slot">
        <input type="file" id="xlsxInput" accept=".xlsx,.xls" onchange="loadXLSX(event)">
        <div class="import-lbl">Base DS</div>
        <div class="import-name" id="xlsxName">Selecionar .XLSX</div>
        <div class="import-wait" id="xlsxStatus">Aguardando</div>
      </div>
    </div>
    ${slaBlocksHTML()}
    ${chartBoxHTML('chartGeral', 'Evolução SLA e DS — hoje')}
    ${driverTableHTML('gtbody', 'Motoristas — DS')}`;
}

function renderHistoricoPage() {
  return `
    ${chartBoxHTML('chartGeral', 'Evolução SLA e DS')}
    <div class="timeline" id="historico-tl"><div class="empty">Carregando histórico do GitHub...</div></div>`;
}

function renderMotoristasPage() {
  return `
    <div class="cards-row">
      <div class="card"><div class="card-top" style="background:var(--blue)"></div><div class="card-lbl">SLA</div><div class="card-val" id="sla-pct" style="color:var(--blue)">—%</div><div class="card-pct" id="sla-tot">0 pacotes</div></div>
      <div class="card"><div class="card-top" style="background:var(--green)"></div><div class="card-lbl">Entregues</div><div class="card-val" style="color:var(--green)" id="sc-e">0</div><div class="card-pct" id="sp-e">0%</div></div>
      <div class="card"><div class="card-top" style="background:var(--blue)"></div><div class="card-lbl">Em Rota</div><div class="card-val" style="color:var(--blue)" id="sc-r">0</div><div class="card-pct" id="sp-r">0%</div></div>
      <div class="card"><div class="card-top" style="background:var(--red)"></div><div class="card-lbl">Ocorrências</div><div class="card-val" style="color:var(--red)" id="sc-o">0</div><div class="card-pct" id="sp-o">0%</div></div>
      <div class="card"><div class="card-top" style="background:var(--gray)"></div><div class="card-lbl">Faltantes</div><div class="card-val" style="color:var(--gray)" id="sc-f">0</div><div class="card-pct" id="sp-f">0%</div></div>
      <div class="card"><div class="card-top" style="background:var(--orange)"></div><div class="card-lbl">Devoluções</div><div class="card-val" style="color:var(--orange)" id="sc-d">0</div><div class="card-pct" id="sp-d">0%</div></div>
    </div>
    <div class="tbl-box">
      <div class="tbl-head"><div class="tbl-head-title">Motoristas — SLA</div><input class="tbl-search" placeholder="Buscar..." oninput="filterTbl(this.value,'sla-tbody')"></div>
      <table><thead><tr>
        <th onclick="sortTbl('sla-tbody',0)">Motorista</th><th onclick="sortTbl('sla-tbody',1)">Total</th>
        <th onclick="sortTbl('sla-tbody',2)">Entregues</th><th onclick="sortTbl('sla-tbody',3)">Em Rota</th>
        <th onclick="sortTbl('sla-tbody',4)">Ocorrências</th><th onclick="sortTbl('sla-tbody',5)">Faltantes</th>
        <th onclick="sortTbl('sla-tbody',6)">SLA%</th>
      </tr></thead><tbody id="sla-tbody"><tr><td colspan="7" class="empty">Importe a base SLA na aba Hoje</td></tr></tbody></table>
    </div>
    <div class="tbl-box">
      <div class="tbl-head"><div class="tbl-head-title">Motoristas — DS</div><input class="tbl-search" placeholder="Buscar..." oninput="filterTbl(this.value,'ds-tbody')"></div>
      <table><thead><tr>
        <th onclick="sortTbl('ds-tbody',0)">Motorista</th><th onclick="sortTbl('ds-tbody',1)">Saiu</th>
        <th onclick="sortTbl('ds-tbody',2)">Entregues</th><th onclick="sortTbl('ds-tbody',3)">Em Rota</th>
        <th onclick="sortTbl('ds-tbody',4)">Ocorrências</th><th onclick="sortTbl('ds-tbody',5)">DS%</th>
      </tr></thead><tbody id="ds-tbody"><tr><td colspan="6" class="empty">Importe a base DS na aba Hoje</td></tr></tbody></table>
    </div>`;
}

function renderLiberacao() {
  return `
    <div class="lib-card">
      <div class="lib-title">Liberação de Pagamento</div>
      <div class="lib-sub">Operação: <strong>${OP_LABELS[userOp] || userOp}</strong>${userBase ? ' — Base: <strong>' + userBase.toUpperCase() + '</strong>' : ''}</div>
      <div class="lib-row">
        <button class="lib-btn lib-ok"  id="lib-ok"  onclick="selLib('ok')">✓ OK</button>
        <button class="lib-btn lib-nok" id="lib-nok" onclick="selLib('nok')">✗ NOK</button>
      </div>
      <textarea class="lib-obs" id="lib-obs" placeholder="Observações (opcional)..."></textarea>
      <button class="btn-primary-sm" style="width:100%" onclick="submitLib()">Enviar</button>
      <div class="create-msg" id="lib-msg" style="margin-top:10px"></div>
    </div>`;
}

function selLib(v) {
  libSel = v;
  document.getElementById('lib-ok').className  = 'lib-btn lib-ok'  + (v === 'ok'  ? ' sel' : '');
  document.getElementById('lib-nok').className = 'lib-btn lib-nok' + (v === 'nok' ? ' sel' : '');
}

async function submitLib() {
  const msg = document.getElementById('lib-msg');
  if (!libSel) { msg.textContent = 'Selecione OK ou NOK.'; msg.className = 'create-msg err'; return; }
  const obs = document.getElementById('lib-obs').value;
  msg.textContent = 'Enviando...'; msg.className = 'create-msg';
  const r = await supaReq('/rest/v1/liberacoes', {
    method: 'POST', prefer: 'return=minimal',
    body: JSON.stringify({ user_id: currentUser.id, operacao: userOp, base: userBase, status: libSel, observacao: obs }),
  });
  if (r.ok || r.status === 201) {
    msg.textContent = '✓ Enviado com sucesso!'; msg.className = 'create-msg ok';
    libSel = null;
    document.getElementById('lib-ok').className  = 'lib-btn lib-ok';
    document.getElementById('lib-nok').className = 'lib-btn lib-nok';
    document.getElementById('lib-obs').value = '';
  } else { msg.textContent = 'Erro ao enviar.'; msg.className = 'create-msg err'; }
}

function renderAdminUsers() {
  return `
    <div class="create-form">
      <div class="create-form-title">Criar novo acesso de supervisor</div>
      <div class="create-row">
        <div class="create-group"><label class="create-label">E-mail</label><input class="create-input" type="email" id="new-email" placeholder="supervisor@empresa.com"></div>
        <div class="create-group"><label class="create-label">Senha</label><input class="create-input" type="password" id="new-pass" placeholder="Mín. 6 caracteres"></div>
        <div class="create-group"><label class="create-label">Nome</label><input class="create-input" type="text" id="new-empresa" placeholder="Ex: Supervisor Shopee"></div>
        <div class="create-group"><label class="create-label">Operação</label>
          <select class="create-input" id="new-op">
            ${ALL_OPS.map(op => `<option value="${op}">${OP_LABELS[op]}</option>`).join('')}
          </select>
        </div>
        <div class="create-group"><label class="create-label">Base (ex: xpt-adr-02)</label><input class="create-input" type="text" id="new-base" placeholder="xpt-adr-02"></div>
        <button class="btn-create" id="btn-create-user" onclick="createUser()">Criar acesso</button>
      </div>
      <div class="create-msg" id="create-msg"></div>
    </div>
    <div class="tbl-box">
      <div class="tbl-head"><div class="tbl-head-title">Usuários cadastrados</div><button class="btn-sm" onclick="loadAdminClients()">↻ Atualizar</button></div>
      <table><thead><tr><th>Nome</th><th>E-mail</th><th>Operação</th><th>Base</th></tr></thead>
      <tbody id="admin-clients-tbody"><tr><td colspan="4" class="empty">Carregando...</td></tr></tbody>
    </div>`;
}

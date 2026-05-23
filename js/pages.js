function renderPage(p) {
  if (p === 'admin-home')                    return renderAdminHome();
  if (p === 'admin-users')                   return renderAdminUsers();
  if (p === 'admin-financeiro')              return wip('Financeiro', 'Módulo financeiro em desenvolvimento.', '💰');
  if (p === 'admin-pessoas')                 return wip('Gestão de Pessoas', 'Módulo de RH em desenvolvimento.', '👥');
  if (p === 'admin-op-shopee')               return renderShopeeMenu();
  if (p === 'admin-op-shopee-monitoramento') return renderShopeeBase();
  if (p === 'admin-op-shopee-sla-ds')        return renderShopeeSlaDs();
  if (p === 'admin-op-shopee-pod')           return wip('POD', 'Módulo POD em desenvolvimento.', '📋');
  if (p === 'admin-op-shopee-pnr')           return wip('PNR', 'Módulo PNR em desenvolvimento.', '📦');
  if (p.startsWith('admin-op-'))             return renderAdminOp(p.replace('admin-op-', ''));
  if (p === 'sup-home')                      return renderSupHome();
  if (p === 'sup-hoje')                      return renderHoje();
  if (p === 'sup-historico')                 return renderHistoricoPage();
  if (p === 'sup-pnr')                       return wip('PNRs', 'Módulo de PNRs em desenvolvimento.', '📦');
  if (p === 'sup-motoristas')                return renderMotoristasPage();
  if (p === 'sup-liberacao')                 return renderLiberacao();
  if (p === 'sup-problema')                  return wip('Relatar Problema', 'Em desenvolvimento.', '⚠️');
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

function renderShopeeMenu() {
  return `
    <div style="margin-bottom:20px">
      <div style="font-size:20px;font-weight:600;margin-bottom:4px">Shopee</div>
      <div style="font-size:13px;color:var(--text2)">Selecione uma seção</div>
    </div>
    <div class="dash-grid">
      <div class="dash-card" onclick="nav('admin-op-shopee-sla-ds',null)">
        <div class="dash-card-icon">📊</div>
        <div class="dash-card-title">SLA / DS</div>
        <div class="dash-card-sub">Dashboard de resultados</div>
      </div>
      <div class="dash-card" onclick="nav('admin-op-shopee-pod',null)">
        <div class="dash-card-icon">📋</div>
        <div class="dash-card-title">POD</div>
        <div class="dash-card-sub" style="color:var(--orange)">Em construção</div>
      </div>
      <div class="dash-card" onclick="nav('admin-op-shopee-pnr',null)">
        <div class="dash-card-icon">📦</div>
        <div class="dash-card-title">PNR</div>
        <div class="dash-card-sub" style="color:var(--orange)">Em construção</div>
      </div>
      <div class="dash-card" onclick="nav('admin-op-shopee-monitoramento',null)">
        <div class="dash-card-icon">📥</div>
        <div class="dash-card-title">Monitoramento</div>
        <div class="dash-card-sub">Importar e calcular SLA/DS</div>
      </div>
    </div>`;
}

function renderShopeeBase() {
  return `
    <div style="margin-bottom:16px">
      <div style="font-size:13px;color:var(--text2);margin-bottom:10px">Selecione uma base:</div>
      <div class="base-selector" id="base-list"><div class="empty">Carregando bases...</div></div>
    </div>
    <div id="base-panel"></div>`;
}


function _slaModal() {
  return `
    <div id="sla-ds-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9000;align-items:center;justify-content:center">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:28px;width:540px;max-width:96vw;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:16px;font-weight:600">Registrar SLA / DS</div>
          <button class="btn-sm" onclick="closeSlasDsModal()" style="padding:3px 10px">✕</button>
        </div>
        <div style="display:flex;gap:4px;margin-bottom:18px;background:var(--bg3);border-radius:8px;padding:3px">
          <button id="sla-tab-text" onclick="switchSlaTab('text')" style="flex:1;padding:7px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;background:var(--bg2);color:var(--text);font-weight:500">📝 Texto</button>
          <button id="sla-tab-xlsx" onclick="switchSlaTab('xlsx')" style="flex:1;padding:7px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;background:transparent;color:var(--text2)">📊 XLSX em massa</button>
        </div>
        <div id="sla-panel-text">
          <div style="margin-bottom:12px;display:flex;align-items:center;gap:10px">
            <label style="font-size:12px;color:var(--text3);white-space:nowrap">Data</label>
            <input type="date" id="sla-ds-date" class="create-input" style="width:180px">
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
              <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">SLA <span style="font-weight:400;text-transform:none;opacity:.7">— Base · SLA% · Recebidos · Entregues</span></div>
              <textarea id="sla-text" style="width:100%;min-height:110px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:12px;font-family:'DM Mono',monospace;resize:vertical;outline:none;box-sizing:border-box" placeholder="XPT-LRS-01&#9;95.2&#9;1000&#9;952&#10;XPT-CTN-01&#9;92.1&#9;850&#9;784" oninput="previewSlaText()"></textarea>
              <div id="sla-preview-sla" style="font-size:11px;margin-top:4px;min-height:14px"></div>
            </div>
            <div style="flex:1;min-width:200px">
              <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">DS <span style="font-weight:400;text-transform:none;opacity:.7">— Base · DS% · Recebidos · Entregues</span></div>
              <textarea id="ds-text" style="width:100%;min-height:110px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:12px;font-family:'DM Mono',monospace;resize:vertical;outline:none;box-sizing:border-box" placeholder="XPT-LRS-01&#9;88.1&#9;500&#9;441&#10;XPT-CTN-01&#9;85.3&#9;420&#9;359" oninput="previewSlaText()"></textarea>
              <div id="sla-preview-ds" style="font-size:11px;margin-top:4px;min-height:14px"></div>
            </div>
          </div>
        </div>
        <div id="sla-panel-xlsx" style="display:none">
          <div style="font-size:12px;color:var(--text3);margin-bottom:10px">Colunas: <strong>Base · SLA% · Rec_SLA · Ent_SLA · DS% · Rec_DS · Ent_DS · Data</strong><br><span style="opacity:.7">Rec e Ent são opcionais — formato antigo <strong>Base · SLA% · DS% · Data</strong> também é aceito</span></div>
          <div class="import-slot" style="margin-bottom:12px">
            <input type="file" id="sla-xlsx-input" accept=".xlsx,.xls" onchange="loadSlaDsXlsx(event)">
            <div class="import-lbl">XLSX histórico</div>
            <div class="import-name" id="sla-xlsx-name">Selecionar arquivo</div>
            <div class="import-wait" id="sla-xlsx-status">Aguardando</div>
          </div>
          <div id="sla-xlsx-preview" style="max-height:200px;overflow-y:auto;display:none">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr id="sla-xlsx-preview-head"></tr></thead>
              <tbody id="sla-xlsx-preview-tbody"></tbody>
            </table>
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
          <button class="btn-sm" onclick="closeSlasDsModal()">Cancelar</button>
          <button class="btn-primary-sm" id="sla-save-btn" onclick="saveSlaDs()">Salvar</button>
        </div>
        <div id="sla-ds-modal-msg" style="font-size:12px;margin-top:10px;min-height:16px"></div>
      </div>
    </div>`;
}

function _slaPanel(side) {
  const sfx = side === 'l' ? 'L' : 'R';
  return `
    <div style="flex:1;min-width:260px">
      <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Painel ${side === 'l' ? 'A' : 'B'}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
        <button class="base-btn active" id="sla-per-${side}-all"       onclick="setPanelPeriod('${side}',null)">Tudo</button>
        <button class="base-btn"        id="sla-per-${side}-semanal"   onclick="setPanelPeriod('${side}','semanal')">Semanal</button>
        <button class="base-btn"        id="sla-per-${side}-quinzenal" onclick="setPanelPeriod('${side}','quinzenal')">Quinzenal</button>
        <button class="base-btn"        id="sla-per-${side}-mensal"    onclick="setPanelPeriod('${side}','mensal')">Mensal</button>
        <button class="base-btn"        id="sla-per-${side}-trimestral" onclick="setPanelPeriod('${side}','trimestral')">Trimestral</button>
        <select id="sla-slot-select-${side}" style="display:none;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:12px;font-family:inherit;cursor:pointer;outline:none" onchange="selectPanelSlot('${side}',this.value||null)"><option value="">—</option></select>
      </div>
      <div id="sla-chart-box-sla-${side}" class="chart-box" style="display:none">
        <div class="chart-box-title">SLA</div>
        <div class="chart-h"><canvas id="chartSla${sfx}"></canvas></div>
      </div>
      <div id="sla-heatmap-sla-${side}"></div>
      <div id="sla-chart-box-ds-${side}" class="chart-box" style="display:none">
        <div class="chart-box-title">DS</div>
        <div class="chart-h"><canvas id="chartDs${sfx}"></canvas></div>
      </div>
      <div id="sla-heatmap-ds-${side}"></div>
      <div id="sla-empty-${side}" class="empty">—</div>
    </div>`;
}

function renderShopeeSlaDs() {
  return `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <div id="sla-period-bar" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1">
        <span style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.08em">Período</span>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
          <button class="base-btn" id="per-semanal"    onclick="setPeriod('semanal')">Semanal</button>
          <button class="base-btn" id="per-quinzenal"  onclick="setPeriod('quinzenal')">Quinzenal</button>
          <button class="base-btn" id="per-mensal"     onclick="setPeriod('mensal')">Mensal</button>
          <button class="base-btn" id="per-trimestral" onclick="setPeriod('trimestral')">Trimestral</button>
          <select id="sla-slot-select" style="display:none;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:12px;font-family:inherit;cursor:pointer;outline:none" onchange="selectSlot(this.value||null)"><option value="">—</option></select>
          <button class="base-btn active" id="per-all" onclick="setPeriod(null)">Tudo</button>
        </div>
      </div>
      <button class="btn-sm" id="sla-compare-btn" onclick="toggleSlaDsCompare()">⊞ Comparar</button>
    </div>

    <div id="sla-view-normal">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:18px">
        <div style="display:flex;gap:6px;flex-wrap:wrap;flex:1" id="sla-ds-filters">
          <div class="empty" style="padding:0;font-size:12px">Carregando bases...</div>
        </div>
        ${canEdit ? `<button class="btn-primary-sm" onclick="openSlasDsModal('text')">📝 Importar</button>
        <button class="btn-sm" onclick="openSlasDsModal('xlsx')">📊 XLSX histórico</button>` : ''}
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        <div id="sla-chart-box-sla" class="chart-box" style="flex:1;min-width:220px;display:none">
          <div class="chart-box-title">SLA</div>
          <div class="chart-h"><canvas id="chartSla"></canvas></div>
        </div>
        <div id="sla-chart-box-ds" class="chart-box" style="flex:1;min-width:220px;display:none">
          <div class="chart-box-title">DS</div>
          <div class="chart-h"><canvas id="chartDs"></canvas></div>
        </div>
      </div>
      <div id="sla-heatmap-sla"></div>
      <div id="sla-heatmap-ds"></div>
      <div id="sla-ds-empty" class="empty" style="margin-top:40px">Carregando...</div>
    </div>

    <div id="sla-view-compare" style="display:none;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <div style="display:flex;gap:6px;flex-wrap:wrap;flex:1" id="sla-ds-filters-cmp">
          <div class="empty" style="padding:0;font-size:12px">Carregando bases...</div>
        </div>
        ${canEdit ? `<button class="btn-primary-sm" onclick="openSlasDsModal('text')">📝 Importar</button>
        <button class="btn-sm" onclick="openSlasDsModal('xlsx')">📊 XLSX histórico</button>` : ''}
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        ${_slaPanel('l')}
        <div style="width:1px;background:var(--border);flex-shrink:0;align-self:stretch"></div>
        ${_slaPanel('r')}
      </div>
    </div>

    ${_slaModal()}`;
}

function renderAdminHome() {
  return `
    <div style="margin-bottom:20px">
      <div style="font-size:20px;font-weight:600;margin-bottom:4px">Dashboard Geral</div>
      <div style="font-size:13px;color:var(--text2)">Selecione uma operação para ver os dados</div>
    </div>
    <div class="dash-grid">
      ${ALL_OPS.map(op => {
        const logo = Storage.isLocal() ? `data/${OPS_DIR}/${op}/logo.png` : `${GH_RAW}/${OPS_DIR}/${op}/logo.png`;
        return `
        <div class="dash-card" onclick="nav('admin-op-${op}',null)">
          <div class="dash-card-icon"><img src="${logo}" class="dash-card-op-logo" onerror="this.style.display='none'"></div>
          <div class="dash-card-title">${OP_LABELS[op]}</div>
          <div class="dash-card-sub">Ver bases e histórico</div>
        </div>`;
      }).join('')}
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
        <input type="file" id="csvInput" accept=".csv" multiple onchange="loadCSV(event)">
        <div class="import-lbl">Base SLA</div>
        <div class="import-name" id="csvName">Selecionar .CSV</div>
        <div class="import-wait" id="csvStatus">Aguardando (aceita múltiplos)</div>
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
  const card = (page, icon, title, sub, subStyle = '') => canSee(page)
    ? `<div class="dash-card" onclick="nav('${page}',null)"><div class="dash-card-icon">${icon}</div><div class="dash-card-title">${title}</div><div class="dash-card-sub"${subStyle}>${sub}</div></div>`
    : '';
  return `
    <div style="margin-bottom:20px">
      <div style="font-size:20px;font-weight:600;margin-bottom:4px">Olá, ${ROLE_LABELS[userRole] || 'supervisor'}</div>
      <div style="font-size:13px;color:var(--text2)">Operação: <strong>${OP_LABELS[userOp] || userOp}</strong>${userBase ? ' — Base: <strong>' + userBase.toUpperCase() + '</strong>' : ''}</div>
    </div>
    <div class="dash-grid">
      ${card('sup-hoje',       '📅', 'SLA & DS Hoje',       'Importar e monitorar')}
      ${card('sup-historico',  '📈', 'Histórico',           'Snapshots salvos')}
      ${card('sup-pnr',        '📦', 'PNRs',                'Em construção',        ' style="color:var(--orange)"')}
      ${card('sup-motoristas', '🚗', 'Motoristas',          'Visão individual')}
      ${card('sup-liberacao',  '✅', 'Liberação Pagamento', 'OK / NOK')}
      ${card('sup-problema',   '⚠️', 'Relatar Problema',    'Em construção',        ' style="color:var(--orange)"')}
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
        <input type="file" id="csvInput" accept=".csv" multiple onchange="loadCSV(event)">
        <div class="import-lbl">Base SLA</div>
        <div class="import-name" id="csvName">Selecionar .CSV</div>
        <div class="import-wait" id="csvStatus">Aguardando (aceita múltiplos)</div>
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
      <div class="create-form-title">Criar novo usuário</div>
      <div class="create-row">
        <div class="create-group"><label class="create-label">E-mail</label><input class="create-input" type="email" id="new-email" placeholder="usuario@empresa.com"></div>
        <div class="create-group"><label class="create-label">Senha</label><input class="create-input" type="password" id="new-pass" placeholder="Mín. 6 caracteres"></div>
        <div class="create-group"><label class="create-label">Nome</label><input class="create-input" type="text" id="new-empresa" placeholder="Ex: João Silva"></div>
        <div class="create-group"><label class="create-label">Cargo</label>
          <select class="create-input" id="new-role">
            ${Object.entries(ROLE_LABELS).map(([k,v]) => `<option value="${k}"${k==='supervisor'?' selected':''}>${v}</option>`).join('')}
          </select>
        </div>
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
      <table><thead><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Operação</th><th>Base</th></tr></thead>
      <tbody id="admin-clients-tbody"><tr><td colspan="5" class="empty">Carregando...</td></tr></tbody>
    </div>`;
}

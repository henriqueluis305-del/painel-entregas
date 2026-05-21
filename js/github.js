async function ghGet(path) {
  try {
    const r = await fetch(`${GH_RAW}/${path}?t=${Date.now()}`);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

async function ghGetJSON(path) {
  const txt = await ghGet(path);
  if (!txt) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

async function ghPut(path, content, message) {
  let sha = null;
  try {
    const r = await fetch(`${GH_API}/contents/${path}`, {
      headers: { 'Authorization': `Bearer ${GH_TOKEN}`, 'Accept': 'application/vnd.github+json' }
    });
    if (r.ok) { const d = await r.json(); sha = d.sha; }
  } catch {}

  const body = { message, content: btoa(unescape(encodeURIComponent(content))), branch: GH_BRANCH };
  if (sha) body.sha = sha;

  const r = await fetch(`${GH_API}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return r.ok;
}

async function ghListDir(path) {
  try {
    const r = await fetch(`${GH_API}/contents/${path}`, {
      headers: { 'Authorization': `Bearer ${GH_TOKEN}`, 'Accept': 'application/vnd.github+json' }
    });
    if (!r.ok) return [];
    const items = await r.json();
    return Array.isArray(items) ? items : [];
  } catch { return []; }
}

function setGhStatus(ok, msg) {
  const badge = document.getElementById('gh-badge');
  const dot   = document.getElementById('gh-dot');
  const txt   = document.getElementById('gh-txt');
  if (!badge) return;
  badge.style.display = '';
  dot.style.background = ok ? 'var(--green)' : 'var(--red)';
  txt.textContent = msg || 'GitHub';
}

function logPath(op, base) {
  const safeBase = base.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${op}/${safeBase}/logs.json`;
}

async function loadLogs(op, base) {
  setSaving('Carregando histórico...');
  const data = await ghGetJSON(logPath(op, base));
  logsData = Array.isArray(data) ? data : [];
  setSaving('');
  setGhStatus(true, 'GitHub OK');
  return logsData;
}

async function saveSnapshot(op, base) {
  const s = calcSLA(); const d = calcDS();
  const now  = new Date();
  const snap = {
    data:        now.toLocaleDateString('pt-BR'),
    hora:        now.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
    ts:          now.toISOString(),
    sla_pct:     parseFloat(s.pct.toFixed(2)),
    ds_pct:      parseFloat(d.pct.toFixed(2)),
    total:       s.total,
    entregues:   s.entregues,
    em_rota:     s.emRota,
    ocorrencias: s.ocorr,
    faltantes:   s.faltante,
    devolvidos:  s.dev,
    motoristas:  xlsxData,
  };

  setSaving('Salvando no GitHub...');
  setGhStatus(null, 'Salvando...');
  const existing = await ghGetJSON(logPath(op, base)) || [];
  existing.push(snap);
  const ok = await ghPut(
    logPath(op, base),
    JSON.stringify(existing, null, 2),
    `snapshot ${op}/${base} — ${snap.data} ${snap.hora}`
  );
  if (ok) {
    logsData = existing;
    setSaving('');
    setGhStatus(true, 'Salvo ✓');
    showSnack(`Snapshot salvo — SLA: ${s.pct.toFixed(1)}% | DS: ${d.pct.toFixed(1)}%`);
    renderHistoricoFromLogs();
    updateCharts();
  } else {
    setSaving('');
    setGhStatus(false, 'Erro ao salvar');
    showSnack('Erro ao salvar no GitHub. Verifique o token.', true);
  }
}

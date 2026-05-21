async function loadBasesForOp(op) {
  const items = await ghListDir(op);
  const bases = items.filter(i => i.type === 'dir').map(i => i.name);
  const container = document.getElementById('base-list');
  if (!container) return;
  if (!bases.length) {
    container.innerHTML = `<div class="empty">Nenhuma base encontrada em /${op}/.<br>Crie a pasta no GitHub para começar.</div>`;
    return;
  }
  container.innerHTML = bases.map(b =>
    `<button class="base-btn" onclick="selectBase('${op}','${b}',this)">${b.toUpperCase()}</button>`
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
  setSaving('Criando pasta no GitHub...');
  const ok = await ghPut(`${op}/${slug}/.gitkeep`, '', `criar base ${op}/${slug}`);
  setSaving('');
  if (ok) { showSnack(`Base ${name} criada!`); await loadBasesForOp(op); }
  else showSnack('Erro ao criar base.', true);
}

async function loadLogsForCurrentUser() {
  if (!userOp || !userBase) { logsData = []; return; }
  await loadLogs(userOp, userBase);
}

async function createUser() {
  const email   = document.getElementById('new-email').value.trim();
  const pass    = document.getElementById('new-pass').value;
  const empresa = document.getElementById('new-empresa').value.trim();
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
      body: JSON.stringify({ id: data.id, email, empresa, role: 'cliente', operacao: op, base }),
    });
    if (base) {
      await ghPut(`${op}/${base}/.gitkeep`, '', `criar base ${op}/${base} para ${email}`);
    }
    msg.textContent = `✓ Acesso criado — ${OP_LABELS[op]} / ${base || 'sem base'}`; msg.className = 'create-msg ok';
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
  tbody.innerHTML = '<tr><td colspan="4" class="empty">Carregando...</td></tr>';
  const pr = await supaReq('/rest/v1/profiles?select=*&role=eq.cliente');
  if (!pr.ok) { tbody.innerHTML = '<tr><td colspan="4" class="empty">Erro ao carregar.</td></tr>'; return; }
  const profiles = await pr.json();
  if (!profiles.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhum usuário cadastrado.</td></tr>'; return; }
  tbody.innerHTML = profiles.map(p => `
    <tr>
      <td style="font-weight:500">${p.empresa || '—'}</td>
      <td style="color:var(--text2)">${p.email}</td>
      <td><span class="badge bb">${OP_LABELS[p.operacao] || p.operacao || '—'}</span></td>
      <td style="color:var(--text3)">${p.base || '—'}</td>
    </tr>`).join('');
}

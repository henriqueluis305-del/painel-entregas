async function supaReq(path, opts = {}) {
  const res = await fetch(SUPABASE_URL + path, {
    ...opts,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + (currentToken || SUPABASE_KEY),
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || '',
      ...(opts.headers || {}),
    }
  });
  return res;
}

async function supaAuth(action, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${action}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const err   = document.getElementById('login-err');
  const btn   = document.getElementById('btn-login');
  if (!email || !pass) { err.textContent = 'Preencha e-mail e senha.'; return; }
  btn.disabled = true; btn.textContent = 'Entrando...'; err.textContent = '';
  try {
    const data = await supaAuth('token?grant_type=password', { email, password: pass });
    if (!data.access_token) {
      err.textContent = data.error_description || 'E-mail ou senha incorretos.';
      btn.disabled = false; btn.textContent = 'Entrar'; return;
    }
    currentToken = data.access_token;
    currentUser  = data.user;
    const emailIsAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!emailIsAdmin) {
      try {
        const pr = await supaReq('/rest/v1/profiles?id=eq.' + currentUser.id);
        if (pr.ok) {
          const profiles = await pr.json();
          userRole = profiles[0]?.role     || 'supervisor';
          userOp   = profiles[0]?.operacao || ALL_OPS[0];
          userBase = profiles[0]?.base     || null;
        }
      } catch { userRole = 'supervisor'; userOp = ALL_OPS[0]; }
    }
    isAdmin  = emailIsAdmin || userRole === 'coordenador';
    canEdit  = emailIsAdmin;
    btn.disabled = false; btn.textContent = 'Entrar';
    document.getElementById('screen-login').style.display = 'none';
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-app').style.display  = 'flex';
    document.getElementById('screen-app').classList.add('active');
    document.getElementById('sb-name').textContent = email.split('@')[0];
    const roleLabel = emailIsAdmin ? 'Administrador' : (ROLE_LABELS[userRole] || 'Supervisor');
    document.getElementById('sb-role').textContent = emailIsAdmin
      ? 'Administrador'
      : `${roleLabel} — ${OP_LABELS[userOp] || userOp}${userBase ? ' / ' + userBase : ''}`;
    const chip = document.getElementById('topbar-chip');
    if (emailIsAdmin)              { chip.className = 'admin-chip'; chip.textContent = 'ADMIN'; }
    else if (isAdmin)              { chip.className = 'admin-chip'; chip.textContent = 'COORD'; }
    else                           { chip.className = 'op-chip';    chip.textContent = OP_LABELS[userOp] || userOp; }
    buildSidebar();
    const startPage = isAdmin ? 'admin-home' : (ROLE_PAGES[userRole]?.[0] ?? 'sup-home');
    navigateTo(startPage);
  } catch(e) {
    err.textContent = 'Erro de conexão. Tente novamente.';
    btn.disabled = false; btn.textContent = 'Entrar';
    console.error(e);
  }
}

async function doLogout() {
  try { await supaReq('/auth/v1/logout', { method: 'POST' }); } catch {}
  currentUser = null; currentToken = null; isAdmin = false; canEdit = false; userRole = null; userOp = null; userBase = null;
  csvData = []; xlsxData = []; logsData = [];
  document.getElementById('screen-app').style.display  = 'none';
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('screen-login').classList.add('active');
  document.getElementById('login-pass').value = '';
  document.getElementById('login-err').textContent = '';
  clearOpLogo();
}

function autoLoginAdmin() {
  isAdmin      = true;
  canEdit      = true;
  userRole     = null;
  currentUser  = { id: 'local-admin', email: ADMIN_EMAIL };
  currentToken = null;
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-app').style.display   = 'flex';
  document.getElementById('screen-app').classList.add('active');
  document.getElementById('sb-name').textContent = 'Admin';
  document.getElementById('sb-role').textContent = 'Administrador';
  const chip = document.getElementById('topbar-chip');
  chip.className   = 'admin-chip';
  chip.textContent = 'ADMIN';
  buildSidebar();
  navigateTo('admin-home');
}

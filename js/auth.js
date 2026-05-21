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
    isAdmin      = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      try {
        const pr = await supaReq('/rest/v1/profiles?id=eq.' + currentUser.id);
        if (pr.ok) {
          const profiles = await pr.json();
          userOp   = profiles[0]?.operacao || ALL_OPS[0];
          userBase = profiles[0]?.base || null;
        }
      } catch { userOp = ALL_OPS[0]; }
    }
    btn.disabled = false; btn.textContent = 'Entrar';
    document.getElementById('screen-login').style.display = 'none';
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-app').style.display  = 'flex';
    document.getElementById('screen-app').classList.add('active');
    document.getElementById('sb-name').textContent = email.split('@')[0];
    document.getElementById('sb-role').textContent = isAdmin
      ? 'Administrador'
      : `Supervisor — ${OP_LABELS[userOp] || userOp}${userBase ? ' / ' + userBase : ''}`;
    const chip = document.getElementById('topbar-chip');
    if (isAdmin) { chip.className = 'admin-chip'; chip.textContent = 'ADMIN'; }
    else         { chip.className = 'op-chip';    chip.textContent = OP_LABELS[userOp] || userOp; }
    buildSidebar();
    navigateTo(isAdmin ? 'admin-home' : 'sup-home');
  } catch(e) {
    err.textContent = 'Erro de conexão. Tente novamente.';
    btn.disabled = false; btn.textContent = 'Entrar';
    console.error(e);
  }
}

async function doLogout() {
  try { await supaReq('/auth/v1/logout', { method: 'POST' }); } catch {}
  currentUser = null; currentToken = null; isAdmin = false; userOp = null; userBase = null;
  csvData = []; xlsxData = []; logsData = [];
  document.getElementById('screen-app').style.display  = 'none';
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('screen-login').classList.add('active');
  document.getElementById('login-pass').value = '';
  document.getElementById('login-err').textContent = '';
  clearOpLogo();
}

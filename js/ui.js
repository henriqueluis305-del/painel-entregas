function setSaving(t) { const el = document.getElementById('saving-ind'); if (el) el.textContent = t; }

function showSnack(msg, err = false) {
  let el = document.getElementById('snackbar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'snackbar';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:10px;font-size:13px;z-index:9999;display:none;font-family:inherit';
    document.body.appendChild(el);
  }
  el.style.background = err ? '#ef4444' : '#22c55e';
  el.style.color = '#fff';
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

async function loadCompanyLogo() {
  const url  = 'assets/logo.png';
  const wrap = document.getElementById('login-logo-wrap');
  if (wrap) {
    wrap.innerHTML = `<img src="${url}" class="login-logo-img" onerror="this.style.display='none'">`;
  }
  const sb = document.getElementById('sidebar-logo');
  if (sb) {
    sb.innerHTML = `<img src="${url}" style="max-height:40px;max-width:160px;object-fit:contain" onerror="this.outerHTML='<div class=sidebar-logo-slot>LOGO</div>'">`;
  }
}

async function loadOpLogo(op) {
  const url = Storage.isLocal()
    ? `data/${OPS_DIR}/${op}/logo.png`
    : `${GH_RAW}/${OPS_DIR}/${op}/logo.png?t=${Date.now()}`;
  const img = document.getElementById('topbar-op-logo');
  if (img) { img.src = url; img.style.display = ''; img.onerror = () => img.style.display = 'none'; }
}

function clearOpLogo() {
  const img = document.getElementById('topbar-op-logo');
  if (img) img.style.display = 'none';
}

function filterTbl(v, id) {
  Array.from(document.getElementById(id)?.rows || []).forEach(r => {
    r.style.display = r.cells[0]?.textContent?.toLowerCase().includes(v.toLowerCase()) ? '' : 'none';
  });
}

function sortTbl(id, col) {
  const tbody = document.getElementById(id); if (!tbody) return;
  const key = id + '_' + col; const asc = !sortStates[key]; sortStates[key] = asc;
  const rows = Array.from(tbody.rows);
  rows.sort((a, b) => {
    const av = a.cells[col]?.textContent?.trim() || '';
    const bv = b.cells[col]?.textContent?.trim() || '';
    const an = parseFloat(av); const bn = parseFloat(bv);
    if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
    return asc ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  rows.forEach(r => tbody.appendChild(r));
}

async function loadCSV(event) {
  const files = Array.from(event.target.files); if (!files.length) return;
  const nameEl   = document.getElementById('csvName');
  const statusEl = document.getElementById('csvStatus');
  nameEl.textContent   = files.length > 1 ? `${files.length} arquivos` : files[0].name;
  statusEl.textContent = 'Processando...';
  statusEl.className   = 'import-wait';
  const merged = {};
  for (const file of files) {
    const text = await file.text();
    text.split('\n').filter(l => l.trim()).slice(1).forEach(row => {
      const cols = parseCSVRow(row);
      if (cols.length < 23) return;
      const codigo = cols[0]?.trim(); if (!codigo) return;
      merged[codigo] = { codigo, cep: cols[6]?.trim(), tel: cols[12]?.trim(), driver: cols[13]?.trim(), status: cols[22]?.trim() };
    });
  }
  csvData = Object.values(merged);
  nameEl.textContent   = files.length > 1 ? `${files[0].name} +${files.length - 1}` : files[0].name;
  statusEl.textContent = '✓ ' + csvData.length + ' pacotes';
  statusEl.className   = 'import-ok';
  await resolveAllCEPs();
  updateAll();
}

async function loadXLSX(event) {
  const file = event.target.files[0]; if (!file) return;
  document.getElementById('xlsxName').textContent   = file.name;
  document.getElementById('xlsxStatus').textContent = 'Processando...';
  const ab   = await file.arrayBuffer();
  const wb   = XLSX.read(ab, { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  xlsxData   = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || !r[0]) continue;
    xlsxData.push({
      driver:      String(r[0] || '').trim(),
      saiu:        Number(r[5])  || 0,
      entregues:   Number(r[8])  || 0,
      emRota:      Number(r[10]) || 0,
      ocorrencias: Number(r[12]) || 0,
    });
  }
  document.getElementById('xlsxStatus').textContent = '✓ ' + xlsxData.length + ' motoristas';
  document.getElementById('xlsxStatus').className   = 'import-ok';
  updateAll();
}

function parseCSVRow(row) {
  const res = []; let cur = '', inQ = false;
  for (const c of row) {
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { res.push(cur); cur = ''; }
    else { cur += c; }
  }
  res.push(cur); return res;
}

async function resolveAllCEPs() {
  const ceps = [...new Set(csvData.map(p => p.cep).filter(c => c && c.length >= 8))];
  for (const cep of ceps.filter(c => !cepCache[c]).slice(0, 150)) {
    try {
      const d = await (await fetch('https://viacep.com.br/ws/' + cep.replace(/\D/g, '') + '/json/')).json();
      cepCache[cep] = d.erro
        ? { cidade: 'Desconhecido', bairro: 'Desconhecido' }
        : { cidade: d.localidade || '', bairro: d.bairro || '' };
    } catch { cepCache[cep] = { cidade: 'Desconhecido', bairro: 'Desconhecido' }; }
  }
  localStorage.setItem('cep_cache', JSON.stringify(cepCache));
}

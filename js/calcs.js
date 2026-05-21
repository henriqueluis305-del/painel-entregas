function calcSLA() {
  const total     = csvData.length;
  const entregues = csvData.filter(p => STATUS_MAP[p.status] === 'Entregue').length;
  const emRota    = csvData.filter(p => STATUS_MAP[p.status] === 'Em rota').length;
  const ocorr     = csvData.filter(p => STATUS_MAP[p.status] === 'Ocorrência').length;
  const faltante  = csvData.filter(p => STATUS_MAP[p.status] === 'Faltante').length;
  const dev       = csvData.filter(p => DEV_SET.has(STATUS_MAP[p.status])).length;
  const outros    = total - entregues - emRota - ocorr - faltante - dev;
  return { total, entregues, emRota, ocorr, faltante, dev, outros, pct: total > 0 ? (entregues / total * 100) : 0 };
}

function calcDS() {
  const totalSaiu = xlsxData.reduce((a, d) => a + d.saiu, 0);
  const totalE    = xlsxData.reduce((a, d) => a + d.entregues, 0);
  const totalR    = xlsxData.reduce((a, d) => a + d.emRota, 0);
  const totalO    = xlsxData.reduce((a, d) => a + d.ocorrencias, 0);
  return { totalSaiu, totalE, totalR, totalO, motoristas: xlsxData.length, pct: totalSaiu > 0 ? (totalE / totalSaiu * 100) : 0 };
}

function pctBadge(p) {
  const v = parseFloat(p);
  return `<span class="badge ${v >= 85 ? 'bg' : v >= 70 ? 'bb' : 'br'}">${v.toFixed(1)}%</span>`;
}

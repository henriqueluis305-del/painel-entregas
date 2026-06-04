function _detectBrowser() {
  const ua = navigator.userAgent;
  if (/OPR\/|Opera\//.test(ua))               return 'opera';
  if (/Edg\/|EdgA\/|Edge\//.test(ua))         return 'edge';
  if (/Chrome\//.test(ua) && !/OPR\/|Edg\//.test(ua)) return 'chrome';
  return null;
}

const _BROWSER_NAMES = { opera: 'Opera / Opera GX', edge: 'Microsoft Edge', chrome: 'Google Chrome' };

function _printPopup(state, msg) {
  let el = document.getElementById('print-popup');
  if (!el) {
    el = document.createElement('div');
    el.id = 'print-popup';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9100;display:flex;align-items:center;justify-content:center';
    el.onclick = e => { if (e.target === el) el.remove(); };
    document.body.appendChild(el);
  }
  const icons  = { loading:'⏳', ok:'✓', err:'✕' };
  const colors = { loading:'#8a9ab5', ok:'#22c55e', err:'#ef4444' };
  const titles = { loading:'Gerando print…', ok:'Print copiado!', err:'Não foi possível copiar' };
  el.innerHTML = `
    <div style="background:#111827;border:1px solid #2a3550;border-radius:16px;padding:28px 32px;width:380px;max-width:94vw;text-align:center">
      <div style="font-size:32px;margin-bottom:12px">${icons[state]}</div>
      <div style="font-size:15px;font-weight:600;color:${colors[state]};margin-bottom:8px">${titles[state]}</div>
      <div style="font-size:13px;color:#8a9ab5;line-height:1.6;white-space:pre-wrap">${msg || ''}</div>
      ${state !== 'loading'
        ? `<button onclick="document.getElementById('print-popup').remove()"
             style="margin-top:20px;padding:7px 22px;background:#1a2035;border:1px solid #2a3550;border-radius:8px;color:#e8edf5;cursor:pointer;font-size:13px;font-family:inherit">
             Fechar
           </button>`
        : ''}
    </div>`;
}

async function gerarPrint() {
  const op      = currentOp   || userOp   || '';
  const base    = currentBase || userBase || '';
  const browser = _detectBrowser();

  if (!browser) {
    _printPopup('err',
      'Navegador não suportado.\n\n' +
      'Use um dos navegadores compatíveis:\n' +
      '• Google Chrome\n• Microsoft Edge\n• Opera / Opera GX'
    );
    return;
  }

  _printPopup('loading', `Detectado: ${_BROWSER_NAMES[browser]}`);

  try {
    const blob = await _buildPrintBlob(op, base);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    _printPopup('ok', 'Cole com Ctrl+V onde quiser.');
  } catch (e) {
    const browserName = _BROWSER_NAMES[browser];
    let msg;

    if (e?.name === 'NotAllowedError') {
      const tips = {
        chrome: 'No Chrome: barra de endereço → ícone de cadeado → Clipboard → Permitir',
        edge:   'No Edge: barra de endereço → ícone de cadeado → Permissões → Clipboard → Permitir',
        opera:  'No Opera: barra de endereço → ícone de cadeado → Permissões do site → Clipboard → Permitir',
      };
      msg = `Permissão de clipboard negada pelo ${browserName}.\n\n${tips[browser]}`;
    } else if (e?.name === 'TypeError') {
      msg = `Falha de tipo no ${browserName}.\n\nErro interno: ${e.message}`;
    } else {
      msg = `Erro no ${browserName}.\n\n${e?.name || 'Erro'}: ${e?.message || String(e)}`;
    }
    _printPopup('err', msg);
  }
}

async function _buildPrintBlob(op, base) {
  const compLogoSrc = 'assets/logo.png';
  const opLogoSrc   = Storage.isLocal()
    ? `data/${OPS_DIR}/${op}/logo.png`
    : `${GH_RAW}/${OPS_DIR}/${op}/logo.png`;

  const GAUGE_IDS = new Set(['g-sla-chart', 'g-ds-chart']);

  // For line-chart canvases only — gauges are redrawn separately
  const cloneEl = el => {
    const clone        = el.cloneNode(true);
    const origCanvases = Array.from(el.querySelectorAll('canvas'));
    const clnCanvases  = Array.from(clone.querySelectorAll('canvas'));
    origCanvases.forEach((orig, i) => {
      if (!clnCanvases[i]) return;
      if (GAUGE_IDS.has(orig.id)) return; // gauge redrawn after layout is set
      const img = document.createElement('img');
      img.src   = orig.toDataURL('image/png');
      img.style.cssText = `display:block;width:100%;height:${orig.offsetHeight}px`;
      clnCanvases[i].replaceWith(img);
    });
    clone.querySelectorAll('[style*="position:relative"]').forEach(c => {
      c.style.overflow = 'hidden';
    });
    return clone;
  };

  const inlineBox = clone => {
    clone.style.cssText += ';background:#111827;border:1px solid #2a3550;border-radius:12px;padding:16px;box-sizing:border-box';
    clone.querySelectorAll('.chart-box-title').forEach(t => { t.style.color = '#8a9ab5'; t.style.fontSize = '12px'; t.style.marginBottom = '12px'; });
    clone.querySelectorAll('.chart-h').forEach(h => { h.style.position = 'relative'; h.style.width = '100%'; h.style.height = '190px'; });
    return clone;
  };

  const PRINT_W       = 1200;
  const PRINT_PAD     = 24;
  const BLOCK_GAP     = 14;
  const BLOCK_PAD     = 18;
  const GAUGE_H       = 130;
  // Width of the content area inside each block column
  const GAUGE_W = Math.floor((PRINT_W - PRINT_PAD * 2 - BLOCK_GAP) / 2 - BLOCK_PAD * 2);

  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'position:fixed', 'left:-9999px', 'top:0', `width:${PRINT_W}px`,
    'background:#0b0e1a', 'color:#e8edf5',
    `padding:${PRINT_PAD}px`, 'font-family:DM Sans,system-ui,sans-serif',
    'font-size:14px', 'box-sizing:border-box',
  ].join(';');
  document.body.appendChild(wrap);

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #2a3550';
  header.innerHTML = `
    <img src="${compLogoSrc}" style="height:40px;object-fit:contain;max-width:160px" crossorigin="anonymous" onerror="this.style.display='none'">
    <div style="text-align:center">
      <div style="font-size:13px;font-weight:600;color:#e8edf5">${OP_LABELS[op] || op} / ${base.toUpperCase()}</div>
      <div style="font-size:11px;color:#8a9ab5">${new Date().toLocaleString('pt-BR')}</div>
    </div>
    <img src="${opLogoSrc}" style="height:40px;object-fit:contain;max-width:160px" crossorigin="anonymous" onerror="this.style.display='none'">
  `;
  wrap.appendChild(header);

  const blocks = Array.from(document.querySelectorAll('.blocks-row .block'));
  if (blocks.length) {
    const row = document.createElement('div');
    row.style.cssText = `display:grid;grid-template-columns:1fr 1fr;gap:${BLOCK_GAP}px;margin-bottom:18px`;
    blocks.forEach(b => {
      const clone = cloneEl(b);
      clone.style.cssText += `;background:#111827;border:1px solid #2a3550;border-radius:14px;padding:${BLOCK_PAD}px;box-sizing:border-box;min-width:0`;

      // Redraw gauge at print dimensions so the arch fills correctly
      const gaugeCanvas = Array.from(clone.querySelectorAll('canvas'))
        .find(c => GAUGE_IDS.has(c.id));
      if (gaugeCanvas) {
        const pctEl = b.querySelector('[id$="-pct"]');
        const pct   = parseFloat(pctEl?.textContent) || 0;
        gaugeCanvas.width  = GAUGE_W;
        gaugeCanvas.height = GAUGE_H;
        gaugeCanvas.style.cssText = `display:block;width:${GAUGE_W}px;height:${GAUGE_H}px`;
        const gaugeWrap = gaugeCanvas.parentElement;
        if (gaugeWrap) gaugeWrap.style.height = GAUGE_H + 'px';
        new Chart(gaugeCanvas, {
          type: 'doughnut',
          data: { datasets: [{ data: [pct, 100 - pct], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 0 }] },
          options: {
            responsive: false, animation: { duration: 0 },
            rotation: -90, circumference: 180, cutout: '72%',
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
          },
        });
      }

      row.appendChild(clone);
    });
    wrap.appendChild(row);
  }

  const slaBox = document.getElementById('chartGeralSLA')?.closest('.chart-box');
  const dsBox  = document.getElementById('chartGeralDS')?.closest('.chart-box');
  if (slaBox || dsBox) {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px';
    if (slaBox) row.appendChild(inlineBox(cloneEl(slaBox)));
    if (dsBox)  row.appendChild(inlineBox(cloneEl(dsBox)));
    wrap.appendChild(row);
  }


  await new Promise(r => setTimeout(r, 200));

  let canvas;
  try {
    canvas = await html2canvas(wrap, {
      useCORS: true, allowTaint: true, scale: 2,
      backgroundColor: '#0b0e1a', logging: false,
    });
  } finally {
    document.body.removeChild(wrap);
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

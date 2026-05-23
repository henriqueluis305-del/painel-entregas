const ALL_OPS    = ['shopee','meli','jt','loggi','imile'];

const BASE_ALIAS = {
  'xpt_es_linhares':       'xpt-lrs-01',
  'xpt_es_colatina':       'xpt-ctn-01',
  'xpt_es_nova venécia':   'xpt-nvc-01',
  'xpt_es_nova venecia':   'xpt-nvc-01',
  'xpt_es_são mateus':     'xpt-smt-01',
  'xpt_es_sao mateus':     'xpt-smt-01',
  'xpt_rj_angra dos reis':    'xpt-adr-02',
  'xpt_rj_angra dos reis_02': 'xpt-adr-02',
  'xpt_rj_saquarema':         'xpt-sqr-01',
};

// Normaliza valor que pode vir como decimal (0.952) ou percentagem (95.2)
function normalizePct(v) { return (v > 0 && v <= 1) ? v * 100 : v; }
function parseNum(s) { return parseFloat(String(s).replace(',', '.')); }
function parseQty(s) { return parseInt(String(s).replace(/\./g, '').replace(',', '')) || null; }

function resolveBase(raw) {
  const n = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  return BASE_ALIAS[n] || raw.trim().toLowerCase().replace(/_/g, '-');
}

function parseSlaDsLine(line) {
  line = line.trim(); if (!line) return null;
  const tabs = line.split('\t');
  if (tabs.length >= 3) {
    const sla = parseNum(tabs[1]); const ds = parseNum(tabs[2]);
    if (!isNaN(sla) && !isNaN(ds)) return { base: resolveBase(tabs[0]), sla_pct: sla, ds_pct: ds };
  }
  const parts = line.split(/\s+/);
  if (parts.length < 3) return null;
  const ds  = parseNum(parts[parts.length - 1]);
  const sla = parseNum(parts[parts.length - 2]);
  if (isNaN(sla) || isNaN(ds)) return null;
  return { base: resolveBase(parts.slice(0, parts.length - 2).join(' ')), sla_pct: sla, ds_pct: ds };
}

// Base  Pct%  [Recebidos  Entregues] — tab-separated preferred; space fallback (no rec/ent)
function parseSlaLine(line) {
  line = line.trim(); if (!line) return null;
  const t = line.split('\t');
  if (t.length >= 2) {
    const sla = parseNum(t[1]); if (isNaN(sla)) return null;
    return { base: resolveBase(t[0]), sla_pct: normalizePct(sla),
      sla_rec: t.length >= 3 ? parseQty(t[2]) : null,
      sla_ent: t.length >= 4 ? parseQty(t[3]) : null };
  }
  const p = line.split(/\s+/); if (p.length < 2) return null;
  const sla = parseNum(p[p.length - 1]); if (isNaN(sla)) return null;
  return { base: resolveBase(p.slice(0, -1).join(' ')), sla_pct: normalizePct(sla), sla_rec: null, sla_ent: null };
}

function parseDsLine(line) {
  line = line.trim(); if (!line) return null;
  const t = line.split('\t');
  if (t.length >= 2) {
    const ds = parseNum(t[1]); if (isNaN(ds)) return null;
    return { base: resolveBase(t[0]), ds_pct: normalizePct(ds),
      ds_rec: t.length >= 3 ? parseQty(t[2]) : null,
      ds_ent: t.length >= 4 ? parseQty(t[3]) : null };
  }
  const p = line.split(/\s+/); if (p.length < 2) return null;
  const ds = parseNum(p[p.length - 1]); if (isNaN(ds)) return null;
  return { base: resolveBase(p.slice(0, -1).join(' ')), ds_pct: normalizePct(ds), ds_rec: null, ds_ent: null };
}
const ROLE_LABELS = {
  monitoramento:         'Monitoramento',
  supervisor:            'Supervisor',
  supervisor_financeiro: 'Supervisor Financeiro',
  coordenador:           'Coordenador',
};

// Páginas permitidas por cargo — null = todas (usa sidebar de admin)
const ROLE_PAGES = {
  monitoramento:         ['sup-hoje'],
  supervisor:            ['sup-home','sup-hoje','sup-historico','sup-motoristas','sup-liberacao','sup-problema'],
  supervisor_financeiro: ['sup-home','sup-historico','sup-liberacao'],
  coordenador:           null,
};

const OPS_DIR    = 'operacoes';
const OP_LABELS  = {shopee:'Shopee',meli:'Meli','jt':'J&T',loggi:'Loggi',imile:'Imile'};
const OP_ICONS   = {shopee:'🛍️',meli:'🟡','jt':'📦',loggi:'🚚',imile:'✈️'};

const STATUS_MAP = {
  'Delivered':'Entregue','Hub_Received':'Recebido','OnHold':'Ocorrência',
  'Hub_Assigned':'Sem atribuição','LMHub_LHTransported':'Faltante',
  'Delivering':'Em rota','Return_LMHub_LHTransporting':'Devolução em LH',
  'Hub_LHArrived':'Faltante','SOC_LHTransported':'Faltante','SOC_Packing':'Faltante',
  'SOC_Staging':'Faltante','Hub_Packing':'Faltante','SOC_LHArrived':'Faltante',
  'SOC_Packed':'Faltante','SOC_Received':'Faltante',
  'Return_Hub_Received':'Interceptado','Return_Hub_Packing':'Devolução'
};
const DEV_SET = new Set(['Devolução em LH','Interceptado','Devolução']);

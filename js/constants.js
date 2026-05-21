const ALL_OPS    = ['shopee','meli','jt','loggi','imile'];
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

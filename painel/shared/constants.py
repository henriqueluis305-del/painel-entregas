"""Constantes de domínio — porta de constants.js + planos de migração."""

from .enums import PackageStatus

# Mapeamento alias de base (nome bruto Shopee → slug interno)
BASE_ALIASES: dict[str, str] = {
    "xpt_es_linhares":          "xpt-lrs-01",
    "xpt_es_colatina":          "xpt-ctn-01",
    "xpt_es_nova venécia":      "xpt-nvc-01",
    "xpt_es_nova venecia":      "xpt-nvc-01",
    "xpt_es_são mateus":        "xpt-smt-01",
    "xpt_es_sao mateus":        "xpt-smt-01",
    "xpt_rj_angra dos reis":    "xpt-adr-02",
    "xpt_rj_angra dos reis_02": "xpt-adr-02",
    "xpt_rj_saquarema":         "xpt-sqr-01",
}

# Status bruto Shopee → categoria interna
STATUS_MAP: dict[str, str] = {
    "Delivered":                    PackageStatus.ENTREGUE,
    "Hub_Received":                 "RECEBIDO",
    "OnHold":                       "OCORRENCIA",
    "Delivering":                   "EM_ROTA",
    "Return_LMHub_LHTransporting":  PackageStatus.DEVOLUCAO_LH,
    "Return_Hub_Received":          PackageStatus.INTERCEPTADO,
    "Return_Hub_Packing":           PackageStatus.DEVOLUCAO,
    "Returning":                    PackageStatus.DEVOLUCAO,
    "Absent":                       "FALTANTE",
    "Exception":                    "OCORRENCIA",
    "Pending":                      "PENDENTE",
    "Scheduled":                    "PENDENTE",
    "Cancelled":                    "CANCELADO",
}

# Status que encerram o ciclo de vida do pacote (persistidos em Package)
STATUS_FINALIZADORES: set[str] = {
    PackageStatus.ENTREGUE,
    PackageStatus.DEVOLUCAO,
    PackageStatus.INTERCEPTADO,
    PackageStatus.DEVOLUCAO_LH,
}

# Labels e ícones das operações
OP_LABELS: dict[str, str] = {
    "shopee": "Shopee",
    "meli":   "Mercado Livre",
    "jt":     "J&T",
    "loggi":  "Loggi",
    "imile":  "iMile",
}

ALL_OPS: list[str] = list(OP_LABELS.keys())

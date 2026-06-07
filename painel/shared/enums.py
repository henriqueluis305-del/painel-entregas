from enum import Enum


class Role(str, Enum):
    MONITORAMENTO = "MONITORAMENTO"
    SUPERVISOR = "SUPERVISOR"
    SUPERVISOR_FINANCEIRO = "SUPERVISOR_FINANCEIRO"
    COORDENADOR = "COORDENADOR"
    ADMIN = "ADMIN"


class BaseScope(str, Enum):
    SINGLE = "SINGLE"
    OP_WIDE = "OP_WIDE"
    ALL = "ALL"


class PackageStatus(str, Enum):
    ENTREGUE = "ENTREGUE"
    DEVOLUCAO = "DEVOLUCAO"
    INTERCEPTADO = "INTERCEPTADO"
    DEVOLUCAO_LH = "DEVOLUCAO_LH"


class LiberacaoStatus(str, Enum):
    OK = "OK"
    NOK = "NOK"


class UploadKind(str, Enum):
    CSV_SLA = "CSV_SLA"
    XLSX_DS = "XLSX_DS"
    XLSX_SLA_DS_HISTORY = "XLSX_SLA_DS_HISTORY"

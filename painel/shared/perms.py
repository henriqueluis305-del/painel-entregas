"""Permissões, presets por cargo e página inicial — porta de PLANO-USUARIOS.md."""

from .enums import Role


class PERMS:
    # Upload e dados
    UPLOAD_CSV_SLA     = "upload:csv_sla"
    UPLOAD_XLSX_DS     = "upload:xlsx_ds"
    UPLOAD_XLSX_SLA_DS = "upload:xlsx_sla_ds"
    SAVE_SNAPSHOT      = "snapshot:save"
    SAVE_SLA_DS_MANUAL = "sla_ds:save"

    # Visualização
    VIEW_HOJE      = "view:hoje"
    VIEW_HISTORICO = "view:historico"
    VIEW_MOTORISTAS = "view:motoristas"
    VIEW_SLA_DS    = "view:sla_ds"
    VIEW_LIBERACAO = "view:liberacao"

    # Ação
    SUBMIT_LIBERACAO = "liberacao:submit"

    # Admin
    MANAGE_USERS  = "admin:users"
    MANAGE_BASES  = "admin:bases"
    VIEW_ALL_BASES = "admin:view_all"


# Todos os valores de PERMS como conjunto
_ALL_PERMS: set[str] = {v for k, v in vars(PERMS).items() if not k.startswith("_")}

ROLE_PRESETS: dict[str, list[str]] = {
    Role.MONITORAMENTO: [
        PERMS.VIEW_HOJE,
        PERMS.UPLOAD_CSV_SLA, PERMS.UPLOAD_XLSX_DS,
        PERMS.SAVE_SNAPSHOT,
    ],
    Role.SUPERVISOR: [
        PERMS.VIEW_HOJE, PERMS.VIEW_HISTORICO, PERMS.VIEW_MOTORISTAS,
        PERMS.VIEW_SLA_DS, PERMS.VIEW_LIBERACAO,
        PERMS.UPLOAD_CSV_SLA, PERMS.UPLOAD_XLSX_DS,
        PERMS.SAVE_SNAPSHOT, PERMS.SUBMIT_LIBERACAO,
    ],
    Role.SUPERVISOR_FINANCEIRO: [
        PERMS.VIEW_HOJE, PERMS.VIEW_HISTORICO, PERMS.VIEW_LIBERACAO,
        PERMS.SUBMIT_LIBERACAO,
    ],
    Role.COORDENADOR: [
        PERMS.VIEW_HOJE, PERMS.VIEW_HISTORICO, PERMS.VIEW_MOTORISTAS,
        PERMS.VIEW_SLA_DS, PERMS.VIEW_LIBERACAO,
        PERMS.UPLOAD_CSV_SLA, PERMS.UPLOAD_XLSX_DS, PERMS.UPLOAD_XLSX_SLA_DS,
        PERMS.SAVE_SNAPSHOT, PERMS.SAVE_SLA_DS_MANUAL,
        PERMS.SUBMIT_LIBERACAO, PERMS.VIEW_ALL_BASES,
    ],
    Role.ADMIN: list(_ALL_PERMS),
}

LANDING_PAGE: dict[str, str] = {
    Role.MONITORAMENTO:         "/hoje",
    Role.SUPERVISOR:            "/home",
    Role.SUPERVISOR_FINANCEIRO: "/home",
    Role.COORDENADOR:           "/admin",
    Role.ADMIN:                 "/admin",
}


def has_perm(
    role: str,
    extra_perms: list[str],
    denied_perms: list[str],
    perm: str,
) -> bool:
    if perm in denied_perms:
        return False
    return perm in ROLE_PRESETS.get(role, []) or perm in extra_perms

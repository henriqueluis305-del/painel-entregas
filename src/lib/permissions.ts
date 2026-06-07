// Permissões, presets por cargo e helper — porta da lógica de PLANO-USUARIOS.

export const PERMS = {
  UPLOAD_CSV_SLA: "upload:csv_sla",
  UPLOAD_XLSX_DS: "upload:xlsx_ds",
  UPLOAD_XLSX_SLA_DS: "upload:xlsx_sla_ds",
  SAVE_SNAPSHOT: "snapshot:save",
  SAVE_SLA_DS_MANUAL: "sla_ds:save",
  VIEW_HOJE: "view:hoje",
  VIEW_HISTORICO: "view:historico",
  VIEW_MOTORISTAS: "view:motoristas",
  VIEW_SLA_DS: "view:sla_ds",
  VIEW_LIBERACAO: "view:liberacao",
  SUBMIT_LIBERACAO: "liberacao:submit",
  MANAGE_USERS: "admin:users",
  MANAGE_BASES: "admin:bases",
  VIEW_ALL_BASES: "admin:view_all",
} as const

export type Permission = (typeof PERMS)[keyof typeof PERMS]
export type Role =
  | "MONITORAMENTO"
  | "SUPERVISOR"
  | "SUPERVISOR_FINANCEIRO"
  | "COORDENADOR"
  | "ADMIN"

export const ROLE_PRESETS: Record<Role, Permission[]> = {
  MONITORAMENTO: [
    PERMS.VIEW_HOJE,
    PERMS.UPLOAD_CSV_SLA,
    PERMS.UPLOAD_XLSX_DS,
    PERMS.SAVE_SNAPSHOT,
  ],
  SUPERVISOR: [
    PERMS.VIEW_HOJE,
    PERMS.VIEW_HISTORICO,
    PERMS.VIEW_MOTORISTAS,
    PERMS.VIEW_SLA_DS,
    PERMS.VIEW_LIBERACAO,
    PERMS.UPLOAD_CSV_SLA,
    PERMS.UPLOAD_XLSX_DS,
    PERMS.SAVE_SNAPSHOT,
    PERMS.SUBMIT_LIBERACAO,
  ],
  SUPERVISOR_FINANCEIRO: [
    PERMS.VIEW_HOJE,
    PERMS.VIEW_HISTORICO,
    PERMS.VIEW_LIBERACAO,
    PERMS.SUBMIT_LIBERACAO,
  ],
  COORDENADOR: [
    PERMS.VIEW_HOJE,
    PERMS.VIEW_HISTORICO,
    PERMS.VIEW_MOTORISTAS,
    PERMS.VIEW_SLA_DS,
    PERMS.VIEW_LIBERACAO,
    PERMS.UPLOAD_CSV_SLA,
    PERMS.UPLOAD_XLSX_DS,
    PERMS.UPLOAD_XLSX_SLA_DS,
    PERMS.SAVE_SNAPSHOT,
    PERMS.SAVE_SLA_DS_MANUAL,
    PERMS.SUBMIT_LIBERACAO,
    PERMS.VIEW_ALL_BASES,
  ],
  ADMIN: Object.values(PERMS),
}

/** Lista resolvida de permissões do usuário (preset + extras − negadas). */
export function resolvePerms(profile: {
  role: Role
  is_admin?: boolean
  extra_perms?: string[]
  denied_perms?: string[]
}): Permission[] {
  if (profile.is_admin) return Object.values(PERMS)
  const set = new Set<Permission>([
    ...(ROLE_PRESETS[profile.role] ?? []),
    ...((profile.extra_perms ?? []) as Permission[]),
  ])
  ;(profile.denied_perms ?? []).forEach((p) => set.delete(p as Permission))
  return [...set]
}

export const ROLE_LABEL: Record<Role, string> = {
  MONITORAMENTO: "Monitoramento",
  SUPERVISOR: "Supervisor",
  SUPERVISOR_FINANCEIRO: "Supervisor Financeiro",
  COORDENADOR: "Coordenador",
  ADMIN: "Admin",
}

export function hasPerm(
  profile: {
    role: Role
    is_admin?: boolean
    extra_perms?: string[]
    denied_perms?: string[]
  },
  perm: Permission,
): boolean {
  if (profile.is_admin) return true
  if (profile.denied_perms?.includes(perm)) return false
  return (
    ROLE_PRESETS[profile.role]?.includes(perm) ||
    (profile.extra_perms?.includes(perm) ?? false)
  )
}

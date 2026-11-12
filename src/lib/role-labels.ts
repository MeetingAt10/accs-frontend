// Role names come from the session (`roleLabels`, sent by the API with every session), so a rename on the server, such as
// the administrator becoming the System Administrator, reaches every screen. These are the same names, for the moment
// before the session loads.
export const defaultRoleLabels: Record<string, string> = {
  student: 'Student',
  organization: 'CCS Student Organization',
  professor: 'Professor',
  chair: 'Program Chair',
  dean: 'Dean',
  administrator: 'System Administrator',
  guidance: 'Guidance',
  osas: 'OSAS',
  secretary: 'CCS Secretary',
}

let sessionLabels: Record<string, string> = {}

/** Keeps the labels from the latest session. */
export function rememberRoleLabels(labels: unknown) {
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) return
  sessionLabels = Object.fromEntries(Object.entries(labels).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''))
}

/** The name of a role, from the session when it has one. */
export function roleLabelOf(role: string) {
  return sessionLabels[role] ?? defaultRoleLabels[role] ?? (role ? role[0].toUpperCase() + role.slice(1) : '')
}

// Which roles one account may hold (decided 19 November 2026), the same rules as the API's rolesProblem: a student or
// organization account has that one role; any other account at most two. Only students have a section, as letters.

const singleRoles = ['student', 'organization']

/** Whether `role` can be ticked next to the roles already chosen. A ticked role can always be unticked. */
export function canAddRole(chosen: readonly string[], role: string) {
  if (chosen.includes(role)) return true
  if (!chosen.length) return true
  if (chosen.some((existing) => singleRoles.includes(existing))) return false
  if (singleRoles.includes(role)) return false
  return chosen.length < 2
}

/** A section is letters only, like A or AB. Empty means none was entered. */
export const sectionProblem = (section: string) => (!section.trim() || /^[A-Za-z]{1,3}$/.test(section.trim()) ? undefined : 'Use the section letter, like A.')

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

/** The part of a section name before its letter: campus, program code and year, like SBIT3 (SB is San Bartolome). */
export const sectionPrefix = ({ campus, program, year }: { campus?: string; program?: string; year?: number | string }) =>
  `${campus || 'SB'}${(program ?? '').replace(/^BS/, '')}${year ?? ''}`

/**
 * The section letter in a full section name typed in Admin (QA 19 November: the field took only "A"). SBIT3A gives A
 * when the prefix is SBIT3; a bare letter is still taken. Anything else gives undefined.
 */
export function sectionLetter(full: string, prefix: string) {
  const text = full.trim().toUpperCase()
  if (!text) return ''
  if (prefix && text.startsWith(prefix) && /^[A-Z]{1,3}$/.test(text.slice(prefix.length))) return text.slice(prefix.length)
  return /^[A-Z]{1,3}$/.test(text) ? text : undefined
}

export const fullSectionProblem = (full: string, prefix: string) =>
  sectionLetter(full, prefix) === undefined ? `Use the full section name, like ${prefix || 'SBIT3'}A.` : undefined

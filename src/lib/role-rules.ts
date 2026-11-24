// Which roles one account may hold (decided 19 and 20 November 2026), the same rules as the API's rolesProblem: at most
// two roles; a student may also be a CCS student organization representative and nothing else, and an organization
// account pairs only with the student role. Only students have a section, one letter.

// The role sets the API accepts (its roleSets): a role can be ticked when the chosen roles still fit inside one of them.
const roleSets = [['student', 'organization'], ['professor', 'dean'], ['professor', 'chair'], ['secretary'], ['osas'], ['guidance'], ['administrator']]

/** Whether `role` can be ticked next to the roles already chosen. A ticked role can always be unticked. */
export function canAddRole(chosen: readonly string[], role: string) {
  return chosen.includes(role) || roleSets.some((set) => [...chosen, role].every((r) => set.includes(r)))
}

/** The year levels a campus teaches: San Bartolome all four, the satellite campuses 1st and 2nd year only. */
export const campusYears = (campus?: string) => (!campus || campus === 'SB' ? [1, 2, 3, 4] : [1, 2])

/** A section is one letter, like A. Empty means none was entered. */
export const sectionProblem = (section: string) => (!section.trim() || /^[A-Za-z]$/.test(section.trim()) ? undefined : 'Use the section letter, like A.')

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
  if (prefix && text.startsWith(prefix) && /^[A-Z]$/.test(text.slice(prefix.length))) return text.slice(prefix.length)
  return /^[A-Z]$/.test(text) ? text : undefined
}

export const fullSectionProblem = (full: string, prefix: string) =>
  sectionLetter(full, prefix) === undefined ? `Use the full section name, like ${prefix || 'SBIT3'}A.` : undefined

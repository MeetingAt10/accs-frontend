import { roleLabelOf } from '@/lib/role-labels'

// The role line under every page title (testing sheet: 29 pages had no title and description for the signed-in role,
// only Home did). The same scope words as Home and the API's scopeLabel.

type Person = { roles: string[]; program?: string; section?: string; office?: string }

/** "Program Chair and Professor · BSIT program", "Student · BSIT · Section A", "Dean · College of Computer Studies". */
export function roleLine(user: Person) {
  const roles = user.roles.map(roleLabelOf).filter(Boolean).join(' and ')
  const has = (role: string) => user.roles.includes(role)
  const scope = has('administrator')
    ? 'Platform administration'
    : has('chair') && user.program
      ? `${user.program} program`
      : has('dean')
        ? 'College of Computer Studies'
        : user.office || [user.program, user.section && `Section ${user.section}`].filter(Boolean).join(' · ')
  return [roles, scope].filter(Boolean).join(' · ')
}

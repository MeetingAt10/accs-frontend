import {
  Card,
  CardAction,
  CardBody,
  CardMeta,
  CardTitle,
  Tile,
  type IconName,
  type TileTone,
} from '@meetingat10/design-system/react'

import type { Session } from '@/lib/api'
import { canOpenPath } from '@/lib/sites'

import './module-picker.css'

// Home module picker, e-services style (docs/deltas/2026-11-05-consultation-50-percent.md, slice D).
// One tile per module for the person's roles. A built module links only when the session may open it;
// a module that is not built yet is listed without a link.

type Entry = {
  id: string
  label: string
  about?: string
  icon: IconName
  /** Design-system lane color; navy when left out. */
  tone?: TileTone
  /** Roles that get the tile. */
  roles: string[]
  /** Routes the tile opens; the first one the session may open wins. Left out while the module is not built. */
  to?: string[]
  /** Added to the route the tile opens, e.g. a tab on the accounts page. It takes no part in the access check. */
  query?: string
}

export type ModuleTile = Omit<Entry, 'roles' | 'to' | 'query'> & { href?: string }

// Each role's tiles are named for the task they start, in the order the demo walks them. The secretary's tiles open the
// tabs of the one accounts page.
// ponytail: advisor assignments are not on the session yet, so every professor gets the advisor tiles.
// Gate the professor tiles on the assignment once the session carries it.
const entries: Entry[] = [
  { id: 'dean-accounts', label: 'Accounts', about: 'Activate the secretary, who sets up every other account.', icon: 'users', roles: ['dean'], to: ['/accounts'] },
  { id: 'dean-cases', label: 'Case oversight', about: 'Concerns across the college and where each one stands.', icon: 'file', tone: 'neutral', roles: ['dean'], to: ['/cases'] },
  { id: 'dean-records', label: 'Student records', about: 'Authorized student records.', icon: 'archive', tone: 'neutral', roles: ['dean'], to: ['/records'] },
  { id: 'dean-analytics', label: 'Analytics', about: 'Concern trends, waiting times and stages across the college.', icon: 'chalkboard', roles: ['dean'], to: ['/analytics'] },
  { id: 'dean-cycles', label: 'Evaluation cycles', about: 'Set up, review and publish faculty evaluation cycles.', icon: 'list-checks', roles: ['dean'], to: ['/evaluations/cycles'] },
  { id: 'dean-results', label: 'Evaluation results', about: 'Faculty results across the college.', icon: 'list', roles: ['dean'], to: ['/evaluations/results'] },

  { id: 'setup', label: 'Account setup', about: 'The setup steps and the state of every account.', icon: 'users', roles: ['secretary'], to: ['/accounts'], query: '?tab=status' },
  { id: 'faculty', label: 'Faculty accounts', about: 'Create faculty accounts and issue their sign-in details.', icon: 'user', roles: ['secretary'], to: ['/accounts'], query: '?tab=faculty' },
  { id: 'advisors', label: 'Advisor assignments', about: 'Choose the advisors for each year level.', icon: 'list', roles: ['secretary'], to: ['/accounts'], query: '?tab=advisors' },
  { id: 'chairs', label: 'Program chair assignments', about: 'Choose the program chair for each program.', icon: 'chalkboard', roles: ['secretary'], to: ['/accounts'], query: '?tab=chairs' },
  { id: 'import', label: 'Student import', about: 'Create student accounts from an Excel file.', icon: 'upload', roles: ['secretary'], to: ['/accounts'], query: '?tab=students' },

  { id: 'file-concern', label: 'File a concern', about: 'Tell your advisor or the college what happened.', icon: 'pencil', tone: 'neutral', roles: ['student'], to: ['/reports/new'] },
  { id: 'my-concerns', label: 'My concerns', about: 'Concerns you filed and the replies to them.', icon: 'file', tone: 'neutral', roles: ['student'], to: ['/reports'] },
  { id: 'student-consultations', label: 'Appointments', about: 'Book a time with a faculty member.', icon: 'calendar', tone: 'consult', roles: ['student'], to: ['/consultations', '/calendar'] },
  { id: 'student-messages', label: 'Messages', about: 'Conversations with your advisor and faculty.', icon: 'envelope', tone: 'community', roles: ['student'], to: ['/messages'] },
  { id: 'student-evaluations', label: 'Evaluations', about: 'Evaluate your professors; it counts for clearance.', icon: 'list-checks', roles: ['student'], to: ['/evaluations'] },
  { id: 'student-standing', label: 'My standing', about: 'Your clearance and any paused features.', icon: 'info', roles: ['student'], to: ['/standing'] },

  { id: 'assigned-concerns', label: 'Assigned concerns', about: 'Concerns from the students you advise.', icon: 'file', tone: 'neutral', roles: ['professor'], to: ['/cases', '/reports'] },
  { id: 'faculty-schedule', label: 'Appointment schedule', about: 'Appointment requests and your calendar.', icon: 'calendar', tone: 'consult', roles: ['professor'], to: ['/calendar', '/consultations'] },
  { id: 'availability', label: 'My availability', about: 'Set when students can book you.', icon: 'clock', tone: 'consult', roles: ['professor'], to: ['/consultations/availability'] },
  { id: 'faculty-messages', label: 'Messages', about: 'Conversations with students and faculty.', icon: 'envelope', tone: 'community', roles: ['professor'], to: ['/messages'] },
  { id: 'faculty-results', label: 'Evaluation results', about: 'What your students said about your classes.', icon: 'list', roles: ['professor'], to: ['/evaluations/results'] },
  { id: 'faculty-classes', label: 'My classes', about: 'Your sections, subjects and class materials.', icon: 'chalkboard', roles: ['professor'], to: ['/spaces'] },

  { id: 'chair-cases', label: 'Program concerns', about: 'Concerns in your program and where each one stands.', icon: 'file', tone: 'neutral', roles: ['chair'], to: ['/cases'] },
  { id: 'chair-records', label: 'Student records', about: 'Records of the students in your program.', icon: 'archive', tone: 'neutral', roles: ['chair'], to: ['/records'] },
  { id: 'chair-analytics', label: 'Analytics', about: 'Concern trends and waiting times in your program.', icon: 'chalkboard', roles: ['chair'], to: ['/analytics'] },
  { id: 'chair-results', label: 'Evaluation results', about: "Results for your program's faculty.", icon: 'list', roles: ['chair'], to: ['/evaluations/results'] },
  { id: 'chair-messages', label: 'Messages', about: 'Conversations with faculty and students.', icon: 'envelope', tone: 'community', roles: ['chair'], to: ['/messages'] },
  { id: 'chair-calendar', label: 'Calendar', about: 'Appointments and college events.', icon: 'calendar', roles: ['chair'], to: ['/calendar'] },

  { id: 'guidance-cases', label: 'Case queue', about: 'Concerns sent to Guidance, and the Case Files you open.', icon: 'hand-heart', tone: 'neutral', roles: ['guidance'], to: ['/cases'] },
  { id: 'guidance-records', label: 'Student records', about: 'Records of the students in your cases.', icon: 'archive', tone: 'neutral', roles: ['guidance'], to: ['/records'] },
  { id: 'guidance-messages', label: 'Messages', about: 'Conversations with students about their cases.', icon: 'envelope', tone: 'community', roles: ['guidance'], to: ['/messages'] },
  { id: 'guidance-restrictions', label: 'Restrictions', about: 'Pause features for a student, with the reason on record.', icon: 'list', roles: ['guidance'], to: ['/restrictions'] },
  { id: 'guidance-calendar', label: 'Calendar', about: 'Sessions and college events.', icon: 'calendar', roles: ['guidance'], to: ['/calendar'] },
  { id: 'guidance-directory', label: 'Directory', about: 'Find faculty and offices.', icon: 'users', roles: ['guidance'], to: ['/directory'] },

  { id: 'osas-cases', label: 'Case queue', about: 'Case Files sent to OSAS, and the strikes the Dean recommended.', icon: 'student', tone: 'neutral', roles: ['osas'], to: ['/cases'] },
  { id: 'osas-records', label: 'Student records', about: 'Strikes, clearance holds and Good Moral reviews.', icon: 'archive', tone: 'neutral', roles: ['osas'], to: ['/records'] },
  { id: 'osas-restrictions', label: 'Restrictions', about: 'Ask the System Administrator to pause features for a student.', icon: 'list', roles: ['osas'], to: ['/restrictions'] },
  { id: 'osas-messages', label: 'Messages', about: 'Conversations with students about their cases.', icon: 'envelope', tone: 'community', roles: ['osas'], to: ['/messages'] },
  { id: 'osas-calendar', label: 'Calendar', about: 'Meetings and college events.', icon: 'calendar', roles: ['osas'], to: ['/calendar'] },
  { id: 'osas-directory', label: 'Directory', about: 'Find faculty and offices.', icon: 'users', roles: ['osas'], to: ['/directory'] },
]

/** Tiles for this session, in catalog order. */
export function moduleTiles(session: Parameters<typeof canOpenPath>[0]) {
  return entries.flatMap(({ roles, to, query = '', ...tile }): ModuleTile[] => {
    if (!roles.some((role) => session.user.roles.includes(role))) return []
    if (!to) return [tile]
    const path = to.find((candidate) => canOpenPath(session, candidate))
    return path ? [{ ...tile, href: path + query }] : []
  })
}

export function ModulePicker({ session }: { session: Session }) {
  const tiles = moduleTiles(session)
  if (!tiles.length) return null
  return (
    <section className="module-picker accs-stack accs-stack--tight" aria-labelledby="module-picker-title">
      <h2 className="accs-panel__title" id="module-picker-title">
        Choose a module
      </h2>
      <ul className="module-picker__grid" role="list">
        {tiles.map(({ id, label, about, icon, tone, href }) => (
          <Card as="li" key={id} link={Boolean(href)} className={href ? 'module-tile' : 'module-tile module-tile--soon'}>
            <Tile icon={icon} tone={href ? tone : 'neutral'} size="lg" />
            <CardTitle href={href}>{label}</CardTitle>
            {about && <CardBody>{about}</CardBody>}
            <CardMeta>{href ? <CardAction>Open</CardAction> : 'Not available yet'}</CardMeta>
          </Card>
        ))}
      </ul>
    </section>
  )
}

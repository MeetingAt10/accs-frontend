import type { Session } from '@/lib/api'
import { canOpenPath, roleLabel } from '@/lib/sites'

import { mainRoleOrder } from './module-picker'

// Guided tour content (2026-11-25): the happy path of each role, in the order that role works. A step points at a
// sidebar link (`nav`, which the tour also opens) or at a control in the shell (`target`); with neither it is a centered
// card. A step whose page the account may not open is dropped.

export type TourStep = { id: string; title: string; text: string; nav?: string; target?: string }

type Entry = Omit<TourStep, 'id'> & { id?: string }

const assistant: Entry = {
  id: 'assistant',
  title: 'ACCS Assistant',
  text: 'Ask where things are or how a request moves. It explains; staff make the decisions.',
  target: '.shell-side .shell-assist',
}
const bell: Entry = {
  id: 'notifications',
  title: 'Notifications',
  text: 'The bell shows replies, updates on reports and appointment changes. Replay this tour from your name menu at the top.',
  target: '.shell-bell',
}

const tours: Record<string, Entry[]> = {
  // Docs: 2026-11-05-consultation-50-percent (demo flow), pages/07-cases, 08-evaluations, 09-records, sitemap 1.1 to 1.5.
  dean: [
    { nav: '/accounts', title: 'Accounts', text: 'Start here. Activate the secretary; the secretary then creates faculty, chair and student accounts. Sign-in details show once, for you to pass on.' },
    { nav: '/cases', title: 'Escalated reports', text: 'A concern reaches you only after the chair escalates it and the student allowed Dean access. Record your action, resolve it, or transfer it to Guidance.' },
    { nav: '/analytics', title: 'Analytics', text: 'College-wide report counts and trends. Filter by program, period and stage.' },
    { nav: '/evaluations/cycles', title: 'Evaluation cycles', text: 'Set up, publish and monitor faculty evaluation cycles. Published results are under Results.' },
    { nav: '/records', title: 'Student records', text: "Look up a student's offense history, standing and restrictions. Every opening is logged." },
    { nav: '/calendar', title: 'Calendar', text: 'College events and appointments in one place. Message faculty from Messages.' },
    assistant,
    bell,
  ],
  student: [
    { nav: '/reports', title: 'My reports', text: 'File a concern, agree to the consent form, and pick how to talk: chat, call or in person. Replies from your adviser appear here.' },
    { nav: '/consultations', title: 'Appointments', text: 'Request a consultation with a professor and follow its status.' },
    { nav: '/spaces', title: 'My classes', text: 'Your sections and subjects: announcements, materials and class chat.' },
    { nav: '/evaluations', title: 'Evaluations', text: 'When a cycle is open, fill in the forms for your faculty. Answers stay anonymous.' },
    assistant,
    bell,
  ],
  professor: [
    { nav: '/cases', title: 'Assigned reports', text: 'As adviser you see the concerns assigned to you. Read the statement, reply, and escalate to the Program Chair when needed.' },
    { nav: '/consultations', title: 'Appointments', text: 'Set your open times and approve or decline student requests.' },
    { nav: '/spaces', title: 'My classes', text: 'Post announcements and materials to your sections.' },
    { nav: '/evaluations', title: 'Evaluations', text: 'Complete peer and upward evaluations while a cycle is open.' },
    bell,
  ],
  chair: [
    { nav: '/cases', title: 'Report queue', text: 'Reports in your program, including those that bypassed the adviser. Resolve them or escalate to the Dean.' },
    { nav: '/cases/clusters', title: 'Similar reports', text: 'Groups of similar reports. Review them together instead of one by one.' },
    { nav: '/analytics', title: 'Analytics', text: 'Report counts and trends for your program.' },
    { nav: '/evaluations/results', title: 'Evaluation results', text: 'Published results for your program faculty.' },
    { nav: '/records', title: 'Student records', text: 'Offense history and standing for your program. Every opening is logged.' },
    bell,
  ],
  secretary: [
    { nav: '/accounts', title: 'Accounts', text: 'Create faculty, chair and student accounts (students can be imported from the registrar list) and assign advisers and chairs. Sign-in details show once.' },
    { nav: '/faculty-load', title: 'Faculty load', text: 'Assign sections and subjects to faculty.' },
    { nav: '/admin/users', title: 'Users and roles', text: 'Change roles and approve permission requests.' },
    { nav: '/admin/moderation', title: 'Referred items', text: 'Flagged content you review or send to OSAS for a decision.' },
    assistant,
    bell,
  ],
  guidance: [
    { nav: '/cases', title: 'Case files', text: 'Cases at the Guidance stage. Convert a report to a case file, record actions, and transfer or resolve.' },
    { nav: '/records', title: 'Student records', text: 'Offense history and Good Moral status for authorized students.' },
    { nav: '/restrictions', title: 'Restrictions', text: 'Review and refer decisions to apply or lift a restriction.' },
    bell,
  ],
  osas: [
    { nav: '/cases', title: 'OSAS cases', text: 'Cases transferred to OSAS. Record actions, resolve, or escalate to the Office of the President.' },
    { nav: '/admin/moderation', title: 'Flagged content', text: 'Posts and messages the CCS Secretary sends for your decision.' },
    { nav: '/records', title: 'Student records', text: 'Offense history and Good Moral status for students under OSAS authority.' },
    bell,
  ],
  administrator: [
    { nav: '/admin', title: 'Overview', text: 'The state of the platform at a glance.' },
    { nav: '/admin/users', title: 'Users and roles', text: 'Find a user and assign roles.' },
    { nav: '/admin/moderation', title: 'Moderation', text: 'Review flagged and reported content.' },
    { nav: '/admin/audit', title: 'Audit trail', text: 'Who did what and when: role changes, restrictions, case transitions.' },
    { nav: '/admin/monitoring', title: 'Monitoring', text: 'Assistant usage and uptime.' },
    bell,
  ],
  organization: [
    { nav: '/organizations', title: 'Our organization', text: 'Your organization space: announcements, events and members.' },
    { nav: '/feed', title: 'Feed', text: 'Publish announcements and join the college discussion.' },
    { nav: '/calendar', title: 'Calendar', text: 'Organization events and college dates.' },
    bell,
  ],
}

const fallback: Entry[] = [{ nav: '/feed', title: 'Feed', text: 'College announcements and discussion.' }, assistant, bell]

/** The account's tour: a welcome card, then its main role's steps whose pages it may open. */
export function tourSteps(session: Session): TourStep[] {
  const { user } = session
  const main = mainRoleOrder.find((role) => (user.roles as string[]).includes(role)) ?? user.roles[0]
  const roles = user.roles.map(roleLabel).join(' and ')
  const scope = user.program || user.office
  const welcome: TourStep = {
    id: 'welcome',
    title: `Welcome to ACCS, ${user.name}`,
    text: `You are signed in as ${roles}${scope ? ` (${scope})` : ''}. ACCS is the CCS office online. This tour walks through your usual work, in order. It takes about a minute.`,
  }
  const steps = (tours[main] ?? fallback)
    .filter((step) => !step.nav || canOpenPath(session, step.nav))
    .map((step) => ({ ...step, id: step.id ?? step.nav! }))
  return [welcome, ...steps]
}

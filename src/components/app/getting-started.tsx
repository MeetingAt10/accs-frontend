import { Panel } from '@/components/app/page-shell'
import { NavLink } from '@/components/app/site-chrome'
import { canOpenPath } from '@/lib/sites'

import './module-picker.css'

// Home "Getting started" panel: the demo process in order, for whoever walks it. Informational only. A step links to the
// page that does it when the session may open that page, and is plain text otherwise.

type Step = { id: string; label: string; to: string[]; query?: string }

const steps: Step[] = [
  { id: 'secretary', label: 'Activate the secretary', to: ['/accounts'] },
  { id: 'faculty', label: 'Create faculty and advisor accounts', to: ['/accounts'], query: '?tab=faculty' },
  { id: 'chairs', label: 'Assign program chairs', to: ['/accounts'], query: '?tab=chairs' },
  { id: 'students', label: 'Import students', to: ['/accounts'], query: '?tab=students' },
  { id: 'concern', label: 'Student files a concern', to: ['/reports/new'] },
  { id: 'respond', label: 'Advisor responds', to: ['/cases'] },
  { id: 'talk', label: 'Schedule or start a conversation', to: ['/consultations', '/messages'] },
]

export type GettingStartedStep = { id: string; label: string; href?: string }

/** The steps with the page each opens for this session. */
export function gettingStartedSteps(session: Parameters<typeof canOpenPath>[0]): GettingStartedStep[] {
  return steps.map(({ id, label, to, query = '' }) => {
    const path = to.find((candidate) => canOpenPath(session, candidate))
    return { id, label, href: path && path + query }
  })
}

const walkers = ['dean', 'secretary', 'student', 'professor']

export function GettingStarted({ session }: { session: Parameters<typeof canOpenPath>[0] }) {
  if (!session.user.roles.some((role) => walkers.includes(role))) return null
  return (
    <Panel title="Getting started" aria-label="Getting started">
      <ol className="getting-started" role="list">
        {gettingStartedSteps(session).map(({ id, label, href }) => (
          <li key={id} className="getting-started__step">
            {href ? <NavLink href={href}>{label}</NavLink> : label}
          </li>
        ))}
      </ol>
    </Panel>
  )
}

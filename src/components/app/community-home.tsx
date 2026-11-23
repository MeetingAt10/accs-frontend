import { Button, Icon } from '@meetingat10/design-system/react'

import { Panel } from '@/components/app/page-shell'
import { NavLink } from '@/components/app/site-chrome'
import type { Session } from '@/lib/api'
import { initials } from '@/lib/format'
import { canOpenPath } from '@/lib/sites'

import './community-home.css'

// Home helpers for students and faculty: which roles count as community roles, their summary cards, the section tabs,
// a composer and an About panel. The Home header itself is the shared hero in PageScreen. It adds no data of its own;
// every link goes to a page that already exists.

type Access = Parameters<typeof canOpenPath>[0]

/** The roles that get the community layout. */
export const isCommunityRole = (role: string) => role === 'student' || role === 'professor'

/** The Home summary cards for this role. Students and faculty read their unread count on the bell in the top bar, so the card is left out. */
export function dashboardStats<T extends { label?: unknown }>(stats: T[], role: string): T[] {
  return isCommunityRole(role) ? stats.filter((stat) => !/unread|notification/i.test(String(stat.label ?? ''))) : stats
}

type Tab = { id: string; label: string; href?: string }

const tabs: Tab[] = [
  { id: 'home', label: 'Home' },
  { id: 'discussion', label: 'Discussion', href: '/feed' },
  { id: 'events', label: 'Events', href: '/calendar' },
  { id: 'members', label: 'Members', href: '/directory' },
]

/** The section tabs this session may open. Home is always first and is the current one. */
export function communityTabs(session: Access): Tab[] {
  return tabs.filter((tab) => !tab.href || canOpenPath(session, tab.href))
}

/** "Write something": the entry to the existing New post page. Posting itself stays there. */
export function Composer({ session }: { session: Session }) {
  if (!canOpenPath(session, '/feed/new')) return null
  return (
    <Panel className="ch-composer">
      <span className="accs-avatar" aria-hidden>
        {initials(session.user.name)}
      </span>
      <NavLink href="/feed/new" className="ch-composer__field">
        Write something…
      </NavLink>
      <Button href="/feed/new" variant="secondary" icon="plus">
        Create post
      </Button>
    </Panel>
  )
}

export function AboutPanel({ session }: { session: Session }) {
  const { program, section } = session.user
  const links = [
    { label: 'Members', href: '/directory', icon: 'users' as const },
    { label: 'Events', href: '/calendar', icon: 'calendar' as const },
    { label: 'Help', href: '/help', icon: 'question' as const },
  ].filter((link) => canOpenPath(session, link.href))
  return (
    <Panel title="About">
      <div className="accs-stack accs-stack--tight">
        <p className="ch-about">
          The College of Computer Studies community for announcements, class discussions, and appointments.
        </p>
        {(program || section) && (
          <p className="ch-about ch-about--meta">
            <Icon name="graduation-cap" size={16} />
            {[program, section].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="ch-about ch-about--meta">
          <Icon name="lock" size={16} />
          Concerns you file are read by your adviser, your Program Chair and the Dean, and no one else.
        </p>
        {links.length > 0 && (
          <ul className="ch-links" role="list">
            {links.map((link) => (
              <li key={link.href}>
                <NavLink href={link.href} className="ch-link">
                  <Icon name={link.icon} size={16} />
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}

import { Button, Icon } from '@meetingat10/design-system/react'

import { moduleTiles } from '@/components/app/module-picker'
import { Panel } from '@/components/app/page-shell'
import { NavLink } from '@/components/app/site-chrome'
import type { Session } from '@/lib/api'
import { initials } from '@/lib/format'
import { canOpenPath } from '@/lib/sites'

import './community-home.css'

// Home for students and faculty, laid out like a college discussion board: a community header, section tabs, a composer
// and the feed on the left, an About panel on the right. It adds no data of its own. The feed, announcements and
// events come from the Home page data, and every link goes to a page that already exists.

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

export function CommunityHeader({ session, greeting, date }: { session: Session; greeting: string; date: string }) {
  const faculty = session.user.roles.includes('professor')
  // The module tiles are already the role's tasks in order: the first is the main one, the rest sit beside it.
  const actions = moduleTiles(session).filter((tile) => tile.href).slice(0, 4)
  return (
    <header className="ch-head">
      <div>
        <h1 className="ch-head__title">{greeting}</h1>
        <p className="ch-head__eyebrow">
          {date} · {faculty ? 'CCS faculty' : 'College of Computer Studies'}
        </p>
      </div>
      {actions.length > 0 && (
        <div className="ch-actions" role="group" aria-label="Quick actions">
          {actions.map((tile, index) => (
            <Button key={tile.id} href={tile.href} icon={tile.icon} variant={index === 0 ? 'primary' : 'secondary'}>
              {tile.label}
            </Button>
          ))}
        </div>
      )}
    </header>
  )
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

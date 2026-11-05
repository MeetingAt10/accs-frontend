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
}

export type ModuleTile = Omit<Entry, 'roles' | 'to'> & { href?: string }

// ponytail: advisor assignments are not on the session yet, so every professor gets the advisor tiles.
// Gate the professor tiles on the assignment once the session carries it.
const entries: Entry[] = [
  { id: 'concerns', label: 'Concerns', about: 'Concerns and the conversations that follow.', icon: 'file', tone: 'neutral', roles: ['student', 'professor'], to: ['/reports', '/cases'] },
  { id: 'schedule', label: 'Schedule', about: 'Consultation times and your calendar.', icon: 'calendar', tone: 'consult', roles: ['student', 'professor'], to: ['/calendar', '/consultations'] },
  { id: 'messages', label: 'Messages', about: 'Conversations with students and faculty.', icon: 'envelope', tone: 'community', roles: ['student', 'professor'], to: ['/messages'] },
  { id: 'notifications', label: 'Notifications', about: 'Updates on your concerns and consultations.', icon: 'bell', roles: ['student', 'professor'], to: ['/notifications'] },
  { id: 'accounts', label: 'Accounts', about: 'Activate and manage accounts.', icon: 'users', roles: ['dean', 'secretary'], to: ['/accounts'] },
  { id: 'dean', label: 'Dean', icon: 'graduation-cap', roles: ['dean'] },
  { id: 'chair', label: 'Program chair', icon: 'chalkboard', roles: ['chair'] },
  { id: 'guidance', label: 'Guidance', icon: 'hand-heart', roles: ['guidance'] },
  { id: 'osas', label: 'OSAS', icon: 'student', roles: ['osas'] },
  { id: 'president', label: "President's office", icon: 'door', roles: ['president'] },
]

/** Tiles for this session, in catalog order. */
export function moduleTiles(session: Parameters<typeof canOpenPath>[0]) {
  return entries.flatMap(({ roles, to, ...tile }): ModuleTile[] => {
    if (!roles.some((role) => session.user.roles.includes(role))) return []
    if (!to) return [tile]
    const href = to.find((path) => canOpenPath(session, path))
    return href ? [{ ...tile, href }] : []
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

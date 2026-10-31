import { CardLink, NavItem } from '@meetingat10/design-system/react'
import { motion } from 'motion/react'

import type { Role, Session } from '@/lib/api'
import { siteArt, siteById, type Site, type SiteId } from '@/lib/sites'

import './sites.css'

type Destination = { site: Site; href: string; entries: { href: string; label: string }[] }

// DOC003 module ID prefix -> role that owns the module.
const moduleOwner: Record<string, Role | undefined> = {
  STU: 'student',
  ORG: 'organization',
  PRO: 'professor',
  STF: 'staff',
  CHR: 'chair',
  DEAN: 'dean',
  ADM: 'administrator',
  GUD: 'guidance',
  OSAS: 'osas',
  PRES: 'president',
}

function modulesFor(site: SiteId, roles: Role[]) {
  return siteById[site].modules.filter((id) => {
    const owner = moduleOwner[id.split('-')[0]]
    return !owner || roles.includes(owner)
  })
}

export function SiteSwitcher({ destinations, current }: { destinations: Destination[]; current: SiteId }) {
  if (destinations.length < 2) return null
  return (
    <nav className="app-site-switcher" aria-label="ACCS sites">
      {destinations.map(({ site, href }) => (
        <NavItem
          key={site.id}
          className="app-site-switcher__item"
          href={href}
          icon={site.icon as never}
          isCurrent={site.id === current}
        >
          {site.id === current && (
            <motion.span layoutId="app-site-indicator" className="app-site-switcher__indicator" aria-hidden />
          )}
          {site.label}
        </NavItem>
      ))}
    </nav>
  )
}

function greeting(name: string) {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${name.replace(/^(Prof\.|Dr\.)\s+/, '').split(' ')[0]}`
}

export function SiteHero({ site, session }: { site: SiteId; session: Session }) {
  const info = siteById[site]
  const modules = modulesFor(site, session.user.roles)
  return (
    <section className="app-site-hero" data-lane={info.lane} aria-label={`${info.label} site`}>
      <div className="app-site-hero__text">
        <p className="app-site-hero__title">{site === 'portal' ? greeting(session.user.name) : info.label}</p>
        <p className="app-site-hero__purpose">{info.purpose}</p>
        {modules.length > 0 && (
          <ul className="app-site-hero__modules" aria-label="Modules on this site">
            {modules.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="app-site-hero__stage" aria-hidden>
        <img className="app-site-hero__art" src={siteArt(site)} alt="" width={320} height={320} decoding="async" />
      </div>
    </section>
  )
}

/** Home: one tile per module site the person can open. */
export function SiteDirectory({ destinations }: { destinations: Destination[] }) {
  const others = destinations.filter(({ site }) => site.id !== 'portal')
  if (!others.length) return null
  return (
    <section className="app-site-directory" aria-labelledby="app-site-directory-title">
      <h2 id="app-site-directory-title" className="app-site-directory__title">
        Your sites
      </h2>
      <ul className="app-site-directory__grid">
        {others.map(({ site, href, entries }) => (
          <li key={site.id}>
            <CardLink href={href} className="app-site-tile" data-lane={site.lane}>
              <img className="app-site-tile__art" src={siteArt(site.id)} alt="" width={96} height={96} loading="lazy" />
              <span className="app-site-tile__label">{site.label}</span>
              <span className="app-site-tile__purpose">{site.purpose}</span>
              <span className="app-site-tile__entries">
                {entries
                  .slice(0, 4)
                  .map((entry) => entry.label)
                  .join(' · ')}
              </span>
            </CardLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

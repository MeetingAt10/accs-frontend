import { Icon } from '@meetingat10/design-system/react'
import { useRouter } from '@tanstack/react-router'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react'

import type { Session } from '@/lib/api'
import { initials } from '@/lib/format'
import { roleLabel, siteById, siteHref, type Site, type SiteId } from '@/lib/sites'

import './sites.css'

export type Destination = { site: Site; href: string; entries: { href: string; label: string }[] }
export type NavEntry = { label: string; href: string; icon?: string }
export type NavGroup = { label: string; entries: NavEntry[] }

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

function useSlide() {
  return useReducedMotion() ? { duration: 0 } : { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.8 }
}

/** Router link that also works across site hosts: same-host links use client routing, others load the other host. */
export function NavLink({
  href,
  onNavigate,
  onClick,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate?: () => void }) {
  const router = useRouter()
  const target = siteHref(href)
  const local = target === href
  function click(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented) return
    onNavigate?.()
    if (!local || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    router.history.push(href)
  }
  return (
    <a {...rest} href={local ? router.history.createHref(href) : target} onClick={click}>
      {children}
    </a>
  )
}

/** Dark 72px rail: one button per site the person may open, a sliding accent pill on the current one. */
export function SiteRail({
  destinations,
  current,
  session,
  accountLinks,
  onSignOut,
}: {
  destinations: Destination[]
  current: SiteId
  session: Session
  accountLinks: NavEntry[]
  onSignOut: () => void
}) {
  const slide = useSlide()
  return (
    <div className="shell-rail">
      <span className="shell-mark" aria-hidden>
        A
      </span>
      <nav className="shell-rail__nav" aria-label="ACCS sites">
        <LayoutGroup id="rail">
          {destinations.map(({ site, href }) => {
            const isCurrent = site.id === current
            return (
              <NavLink
                key={site.id}
                href={href}
                className="shell-rail__item"
                title={`${site.label}. ${site.purpose}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {isCurrent && (
                  <>
                    <motion.span layoutId="rail-pill" className="shell-rail__pill" transition={slide} aria-hidden />
                    <motion.span layoutId="rail-bar" className="shell-rail__bar" transition={slide} aria-hidden />
                  </>
                )}
                <Icon name={site.icon as never} size={24} weight={isCurrent ? 'fill' : 'regular'} />
                <span className="shell-rail__label">{site.label}</span>
              </NavLink>
            )
          })}
        </LayoutGroup>
      </nav>
      <AccountMenu session={session} links={accountLinks} onSignOut={onSignOut} />
    </div>
  )
}

/** Avatar button that pops a small account panel (scale-in). */
function AccountMenu({ session, links, onSignOut }: { session: Session; links: NavEntry[]; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => root.current?.contains(event.target as Node) || setOpen(false)
    const esc = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div className="shell-account" ref={root}>
      <button
        type="button"
        className="shell-avatar"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Account menu, ${session.user.name}`}
        title={session.user.name}
        onClick={() => setOpen((value) => !value)}
      >
        {initials(session.user.name)}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="shell-menu"
            role="group"
            aria-label="Account"
            initial={reduce ? false : { opacity: 0, scale: 0.94, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <div className="shell-menu__who">
              <strong>{session.user.name}</strong>
              <span>{session.user.email}</span>
              <span>{session.user.roles.map(roleLabel).join(' · ')}</span>
            </div>
            {links.map((link) => (
              <NavLink key={link.href} href={link.href} className="shell-menu__item" onNavigate={() => setOpen(false)}>
                {link.icon && <Icon name={link.icon as never} size={16} />}
                {link.label}
              </NavLink>
            ))}
            <button type="button" className="shell-menu__item shell-menu__item--danger" onClick={onSignOut}>
              <Icon name="sign-out" size={16} />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Site nav groups; the current item's wash slides between items. */
export function SiteNav({
  groups,
  current,
  onNavigate,
  layoutId = 'side',
}: {
  groups: NavGroup[]
  current?: string
  onNavigate?: () => void
  layoutId?: string
}) {
  const slide = useSlide()
  return (
    <LayoutGroup id={layoutId}>
      {groups.map((group, index) => (
        <div className="shell-group" key={group.label + index}>
          {group.label !== 'Workspace' && <p className="shell-group__label">{group.label}</p>}
          {group.entries.map((entry) => {
            const isCurrent = entry.href === current
            return (
              <NavLink
                key={entry.href + entry.label}
                href={entry.href}
                className="shell-nav-item"
                aria-current={isCurrent ? 'page' : undefined}
                onNavigate={onNavigate}
              >
                {isCurrent && <motion.span layoutId="side-pill" className="shell-nav-item__pill" transition={slide} aria-hidden />}
                {entry.icon && <Icon name={entry.icon as never} size={20} weight={isCurrent ? 'fill' : 'regular'} />}
                {entry.label}
              </NavLink>
            )
          })}
        </div>
      ))}
    </LayoutGroup>
  )
}

/** Light sidebar: site name, nav groups, then the signed-in person. */
export function SiteSidebar({
  site,
  groups,
  current,
  session,
  profileHref,
  onSignOut,
}: {
  site: SiteId
  groups: NavGroup[]
  current?: string
  session: Session
  profileHref?: string
  onSignOut: () => void
}) {
  const info = siteById[site]
  const who = (
    <>
      <span className="accs-avatar" aria-hidden>
        {initials(session.user.name)}
      </span>
      <span className="shell-person__text">
        <span className="shell-person__name">{session.user.name}</span>
        <span className="shell-person__role">{session.user.roles.map(roleLabel).join(' · ')}</span>
      </span>
    </>
  )
  return (
    <aside className="shell-side" aria-label={`${info.label} sidebar`}>
      <div className="shell-side__head">
        <p className="shell-side__name">{info.label}</p>
      </div>
      <nav className="shell-side__nav" aria-label={`${info.label} navigation`}>
        <SiteNav groups={groups} current={current} />
      </nav>
      <div className="shell-person">
        {profileHref ? (
          <NavLink href={profileHref} className="shell-person__link">
            {who}
          </NavLink>
        ) : (
          <div className="shell-person__link">{who}</div>
        )}
        <button type="button" className="accs-icon-btn" aria-label="Sign out" title="Sign out" onClick={onSignOut}>
          <Icon name="sign-out" size={20} />
        </button>
      </div>
    </aside>
  )
}

/** Mobile drawer body: sites, current site nav, account. */
export function DrawerNav({
  destinations,
  current,
  groups,
  currentHref,
  accountLinks,
  onNavigate,
  onSignOut,
  footer,
}: {
  destinations: Destination[]
  current: SiteId
  groups: NavGroup[]
  currentHref?: string
  accountLinks: NavEntry[]
  onNavigate: () => void
  onSignOut: () => void
  footer?: ReactNode
}) {
  return (
    <div className="shell-drawer" data-site={current}>
      <nav aria-label="ACCS sites" className="shell-drawer__sites">
        {destinations.map(({ site, href }) => (
          <NavLink
            key={site.id}
            href={href}
            className="shell-drawer__site"
            aria-current={site.id === current ? 'page' : undefined}
            onNavigate={onNavigate}
          >
            <Icon name={site.icon as never} size={24} weight={site.id === current ? 'fill' : 'regular'} />
            {site.label}
          </NavLink>
        ))}
      </nav>
      <nav aria-label={`${siteById[current].label} navigation`} className="shell-side__nav" style={{ padding: 0, overflow: 'visible' }}>
        <SiteNav groups={groups} current={currentHref} onNavigate={onNavigate} layoutId="drawer" />
      </nav>
      <div className="shell-group">
        <p className="shell-group__label">Account</p>
        {accountLinks.map((link) => (
          <NavLink key={link.href} href={link.href} className="shell-nav-item" onNavigate={onNavigate}>
            {link.icon && <Icon name={link.icon as never} size={20} />}
            {link.label}
          </NavLink>
        ))}
        <button type="button" className="shell-nav-item shell-nav-item--danger" onClick={onSignOut}>
          <Icon name="sign-out" size={20} />
          Sign out
        </button>
      </div>
      {footer}
    </div>
  )
}

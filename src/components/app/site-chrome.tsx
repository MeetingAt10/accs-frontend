import { useQuery } from '@tanstack/react-query'
import { pageQuery } from '@/lib/queries'
import { AvatarFill } from '@/components/app/photo'
import { Icon } from '@meetingat10/design-system/react'
import { AssistantCard, assistantIcon, assistantIconName } from '@/components/app/assistant-icon'
import logoMark from '@/components/app/shell-logo-mark.svg'
import { useRouter } from '@tanstack/react-router'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react'

import type { Session } from '@/lib/api'
import { initials } from '@/lib/format'
import { roleLabel, type Site, type SiteId } from '@/lib/sites'

import './sites.css'

export type Destination = { site: Site; href: string; entries: { href: string; label: string }[] }
export type NavEntry = { label: string; href: string; icon?: string }
export type NavGroup = { label: string; entries: NavEntry[] }

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

function useSlide() {
  return useReducedMotion() ? { duration: 0 } : { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.8 }
}

/** Router link: plain clicks use client routing; modified clicks keep the browser's behavior. */
export function NavLink({
  href,
  onNavigate,
  onClick,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate?: () => void }) {
  const router = useRouter()
  function click(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented) return
    onNavigate?.()
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    router.history.push(href)
  }
  return (
    <a {...rest} href={router.history.createHref(href)} onClick={click}>
      {children}
    </a>
  )
}

/** The ACCS mark and name. `tone="brand"` is white on the navy panel; `"page"` is ink on the white top bar. */
export function ShellBrand({ tone = 'brand', size = 'md' }: { tone?: 'brand' | 'page'; size?: 'sm' | 'md' }) {
  return (
    <span className="shell-brand" data-tone={tone} data-size={size}>
      <span className="shell-mark" aria-hidden>
        <img src={logoMark} alt="" width={22.32} height={22.32} />
      </span>
      <span className="shell-brand__text">
        <span className="shell-brand__name">ACCS</span>
        <span className="shell-brand__sub">College of Computer Studies</span>
      </span>
    </span>
  )
}

/** "Program Chair · BSIT": the first role and the program or office it covers, for the account block and the phone menu. */
export function accountLine(user: Session['user']) {
  return [user.roles[0] ? roleLabel(user.roles[0]) : '', user.program || user.office].filter(Boolean).join(' · ')
}

/** Site links with the current site's own links nested under it. Shared by the panel and the phone menu. */
function SiteList({
  destinations,
  current,
  groups,
  currentHref,
  onNavigate,
  layoutId,
}: {
  destinations: Destination[]
  current: SiteId
  groups: NavGroup[]
  currentHref?: string
  onNavigate?: () => void
  layoutId: string
}) {
  const slide = useSlide()
  return (
    <LayoutGroup id={layoutId}>
      {destinations.map(({ site, href }) => {
        const isCurrent = site.id === current
        // With a link under it highlighted, the site only reads as the section; otherwise it is the page.
        const isPage = isCurrent && !currentHref
        return (
          <div className="shell-group" key={site.id}>
            <NavLink
              href={href}
              className="shell-nav-item"
              title={`${site.label}. ${site.purpose}`}
              data-section={isCurrent || undefined}
              aria-current={isPage ? 'page' : undefined}
              onNavigate={onNavigate}
            >
              {isPage && <motion.span layoutId={`${layoutId}-pill`} className="shell-nav-item__pill" transition={slide} aria-hidden />}
              <Icon name={site.icon as never} size={20} />
              {site.label}
            </NavLink>
            {isCurrent && groups.length > 0 && (
              <div className="shell-sub">
                <SiteNav groups={groups} current={currentHref} onNavigate={onNavigate} layoutId={`${layoutId}-sub`} />
              </div>
            )}
          </div>
        )
      })}
    </LayoutGroup>
  )
}

/** The primary navigation panel: the sites the person may open, with the current site's own links nested under it,
 *  and the Assistant card at the foot. Account and utility links (profile, settings, help) live in the top bar. */
export function SitePanel({
  destinations,
  current,
  groups,
  currentHref,
  onAssistant,
}: {
  destinations: Destination[]
  current: SiteId
  groups: NavGroup[]
  currentHref?: string
  onAssistant: () => void
}) {
  return (
    <aside className="shell-side" aria-label="Main navigation">
      <div className="shell-side__head">
        <ShellBrand />
      </div>
      <nav className="shell-side__nav" aria-labelledby="shell-side-label">
        <p className="shell-side__label" id="shell-side-label">
          Workspace
        </p>
        <SiteList destinations={destinations} current={current} groups={groups} currentHref={currentHref} layoutId="panel" />
      </nav>
      <div className="shell-side__foot">
        <AssistantCard onPress={onAssistant} />
      </div>
    </aside>
  )
}

/** Phone tab bar (below 768px): the role's first four sites, then More, which opens the menu drawer. */
export function TabBar({ destinations, current, onMore }: { destinations: Destination[]; current: SiteId; onMore: () => void }) {
  return (
    <nav className="shell-tabs" aria-label="Main sections">
      {destinations.slice(0, 4).map(({ site, href }) => (
        <NavLink key={site.id} href={href} className="shell-tab" aria-current={site.id === current ? 'page' : undefined}>
          <Icon name={site.icon as never} size={24} weight={site.id === current ? 'fill' : 'regular'} />
          <span>{site.label}</span>
        </NavLink>
      ))}
      <button type="button" className="shell-tab" aria-haspopup="dialog" onClick={onMore}>
        <Icon name="list" size={24} />
        <span>More</span>
      </button>
    </nav>
  )
}

/** Avatar button that pops a small account panel (scale-in). */
export function AccountMenu({
  session,
  links,
  onSignOut,
  paused,
}: {
  session: Session
  links: NavEntry[]
  onSignOut: () => void
  /** The paused-features notice is hidden: a dot on the avatar, and a menu item that shows it again (QA 17 November, V3). */
  paused?: { onShow: () => void }
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  // The session leaves photos out (it is checked on every request); My profile has yours.
  const own = useQuery({ ...pageQuery('P39'), enabled: session.allowedPages.includes('P39'), staleTime: 300_000 })
  const ownPhoto = (own.data?.data.record as { photo?: unknown } | undefined)?.photo
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
    <div className="shell-account" ref={root} data-paused={paused ? true : undefined}>
      <button
        type="button"
        className="shell-account__button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Account menu, ${session.user.name}${paused ? ', some features paused' : ''}`}
        title={session.user.name}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="shell-avatar">
          <AvatarFill photo={ownPhoto} fallback={initials(session.user.name)} />
        </span>
        <span className="shell-account__who" aria-hidden>
          <span className="shell-account__name">{session.user.name}</span>
          <span className="shell-account__line">{accountLine(session.user)}</span>
        </span>
        <Icon name="caret-down" size={16} className="shell-account__caret" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="shell-menu"
            role="group"
            aria-label="Account"
            initial={reduce ? false : { opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <div className="shell-menu__who">
              <strong>{session.user.name}</strong>
              <span>{session.user.email}</span>
              <span>{session.user.roles.map(roleLabel).join(' · ')}</span>
            </div>
            {paused && (
              <button type="button" className="shell-menu__item shell-menu__item--paused" onClick={() => { setOpen(false); paused.onShow() }}>
                <Icon name="warning-circle" size={16} />
                Some features paused
              </button>
            )}
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
                {entry.icon && (entry.icon === assistantIconName
                  ? <Icon icon={assistantIcon} size={20} />
                  : <Icon name={entry.icon as never} size={20} />)}
                {entry.label}
              </NavLink>
            )
          })}
        </div>
      ))}
    </LayoutGroup>
  )
}

/** Phone menu body (frame 09): who is signed in, the sites with the current site's links, the Assistant, then account. */
export function DrawerNav({
  session,
  destinations,
  current,
  groups,
  currentHref,
  accountLinks,
  onNavigate,
  onSignOut,
  footer,
}: {
  session: Session
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
      <div className="shell-drawer__who">
        <span className="shell-drawer__avatar" aria-hidden>
          {initials(session.user.name)}
        </span>
        <span className="shell-drawer__id">
          <strong>{session.user.name}</strong>
          <span>{accountLine(session.user)}</span>
        </span>
      </div>
      <nav aria-label="ACCS sites" className="shell-drawer__nav">
        <SiteList
          destinations={destinations}
          current={current}
          groups={groups}
          currentHref={currentHref}
          onNavigate={onNavigate}
          layoutId="drawer"
        />
      </nav>
      {footer}
      <nav aria-label="Account" className="shell-drawer__account">
        {accountLinks.map((link) => (
          <NavLink key={link.href} href={link.href} className="shell-drawer__link" onNavigate={onNavigate}>
            {link.icon && <Icon name={link.icon as never} size={16} />}
            {link.label}
          </NavLink>
        ))}
        <button type="button" className="shell-drawer__link" onClick={onSignOut}>
          <Icon name="sign-out" size={16} />
          Sign out
        </button>
      </nav>
    </div>
  )
}

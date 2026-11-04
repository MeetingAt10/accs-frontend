import { pageIdForPath } from '@/lib/page-catalog'
import type { Role } from '@/lib/api'

// ACCS module sites (docs/deltas/2026-11-01-subdomain-sites.md). A site is a host and navigation boundary only;
// route permissions and API checks are unchanged.

export type SiteId = 'portal' | 'forums' | 'schedule' | 'cases' | 'evaluations' | 'records' | 'admin'

export type Site = {
  id: SiteId
  label: string
  purpose: string
  icon: string
  /** Design-system lane: community violet, consult teal, everything else navy/neutral. */
  lane: 'navy' | 'community' | 'consult' | 'neutral'
  prefixes: string[]
  /** Preferred landing routes, first allowed one wins. */
  landings: string[]
  /** DOC003 module IDs served by the site. */
  modules: string[]
}

export const sites: Site[] = [
  {
    id: 'portal',
    label: 'Home',
    purpose: 'Dashboard, notifications, assistant, and your account.',
    icon: 'house',
    lane: 'navy',
    prefixes: ['/home', '/notifications', '/assistant', '/help', '/settings', '/profile', '/standing'],
    landings: ['/home', '/notifications'],
    modules: ['ALL-01', 'ALL-04', 'ALL-05', 'STU-11', 'STU-12', 'STF-01', 'CHR-01', 'DEAN-01'],
  },
  {
    id: 'forums',
    label: 'Forums',
    purpose: 'College feed, class spaces, organizations, and messages.',
    icon: 'chats',
    lane: 'community',
    prefixes: ['/feed', '/spaces', '/organizations', '/messages', '/directory', '/people'],
    landings: ['/feed', '/spaces', '/messages', '/directory'],
    modules: ['ALL-02', 'ALL-03', 'STU-01', 'STU-02', 'STU-03', 'ORG-01', 'ORG-02', 'PRO-01', 'PRO-02', 'PRO-03', 'CHR-06', 'DEAN-06', 'GUD-05', 'OSAS-04'],
  },
  {
    id: 'schedule',
    label: 'Schedule',
    purpose: 'Calendars, faculty availability, and consultation requests.',
    icon: 'calendar',
    lane: 'consult',
    prefixes: ['/calendar', '/consultations'],
    landings: ['/calendar', '/consultations'],
    modules: ['STU-04', 'STU-05', 'PRO-04', 'PRO-05'],
  },
  {
    id: 'cases',
    label: 'Cases',
    purpose: 'Confidential reports and their case files.',
    icon: 'file',
    lane: 'neutral',
    prefixes: ['/reports', '/cases'],
    landings: ['/cases', '/reports'],
    modules: ['STU-06', 'STU-07', 'STU-08', 'STU-09', 'PRO-06', 'CHR-02', 'CHR-07', 'DEAN-02', 'GUD-01', 'GUD-02', 'OSAS-01', 'PRES-01', 'PRES-02'],
  },
  {
    id: 'evaluations',
    label: 'Evaluations',
    purpose: 'Faculty evaluation forms, cycles, and results.',
    icon: 'list-checks',
    lane: 'navy',
    prefixes: ['/evaluations'],
    landings: ['/evaluations'],
    modules: ['STU-10', 'PRO-07', 'PRO-08', 'CHR-04', 'DEAN-03', 'DEAN-04'],
  },
  {
    id: 'records',
    label: 'Records',
    purpose: 'Authorized student records, restrictions, and program analytics.',
    icon: 'archive',
    lane: 'neutral',
    prefixes: ['/records', '/restrictions', '/analytics'],
    landings: ['/analytics', '/records', '/restrictions'],
    modules: ['CHR-03', 'CHR-05', 'DEAN-05', 'GUD-03', 'GUD-04', 'OSAS-02', 'OSAS-03', 'ADM-03'],
  },
  {
    id: 'admin',
    label: 'Admin',
    purpose: 'Roles, moderation, restrictions, audit, and monitoring.',
    icon: 'gear',
    lane: 'navy',
    prefixes: ['/admin'],
    landings: ['/admin'],
    modules: ['ADM-01', 'ADM-02', 'ADM-04', 'ADM-05', 'ADM-06'],
  },
]

export const siteById = Object.fromEntries(sites.map((site) => [site.id, site])) as Record<SiteId, Site>

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/')

/** Site that owns a path. Unknown paths (/, /sign-in) belong to the portal. */
export function siteForPath(path: string): SiteId {
  return sites.find((site) => site.prefixes.some((prefix) => matches(path, prefix)))?.id ?? 'portal'
}

/** Paths served on every host. */
export const isSharedPath = (path: string) => path === '/' || matches(path, '/sign-in')

function configuredOrigins(): Partial<Record<SiteId, string>> {
  try {
    const raw = import.meta.env.VITE_SITE_ORIGINS
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const origins = configuredOrigins()

function hostLabelSite(): SiteId | undefined {
  if (typeof window === 'undefined') return undefined
  const label = window.location.hostname.split('.')[0]
  return sites.some((site) => site.id === label) && window.location.hostname.includes('.') ? (label as SiteId) : undefined
}

/** The site this host serves, or undefined in unified (single-host) mode. */
export function currentSite(): SiteId | undefined {
  if (typeof window === 'undefined') return undefined
  const configured = (Object.entries(origins) as [SiteId, string][]).find(([, origin]) => origin === window.location.origin)
  return configured?.[0] ?? hostLabelSite()
}

/** Origin of another site, when this deployment splits sites across hosts. */
export function siteOrigin(site: SiteId): string | undefined {
  if (origins[site]) return origins[site]
  const here = hostLabelSite()
  if (!here) return undefined
  const { protocol, hostname, port } = window.location
  return `${protocol}//${[site, ...hostname.split('.').slice(1)].join('.')}${port ? ':' + port : ''}`
}

/**
 * Absolute URL when `href` belongs to another host, otherwise `href` unchanged.
 * Leaves external, hash, and query-only links alone.
 */
export function siteHref(href: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href
  const here = currentSite()
  const path = href.split(/[?#]/)[0]
  if (!here || isSharedPath(path)) return href
  const owner = siteForPath(path)
  if (owner === here) return href
  const origin = siteOrigin(owner)
  return origin ? origin + href : href
}

/** First landing route of a site the session may open. */
export function siteLanding(site: SiteId, allowedHref: (href: string) => boolean) {
  return siteById[site].landings.find(allowedHref)
}

type Access = { allowedPages: string[]; user: { roles: string[] } }

/** Roles that may open each site (docs/deltas/2026-11-01-real-auth-and-visual-refactor.md section 3). */
export const siteRoles: Record<SiteId, Role[] | 'all'> = {
  portal: 'all',
  forums: 'all',
  schedule: ['student', 'organization', 'professor', 'chair', 'dean', 'guidance', 'osas'],
  cases: ['student', 'professor', 'chair', 'dean', 'guidance', 'osas', 'president'],
  evaluations: ['student', 'professor', 'chair', 'dean'],
  records: ['chair', 'dean', 'guidance', 'osas', 'president', 'administrator'],
  admin: ['administrator'],
}

const allowsPath = (session: Access, href: string) => session.allowedPages.includes(pageIdForPath(href) ?? '')

/** A site is open when the role is listed for it and at least one of its landing pages is allowed. */
export function canOpenSite(session: Access, site: SiteId) {
  const roles = siteRoles[site]
  return (
    (roles === 'all' || session.user.roles.some((role) => (roles as string[]).includes(role))) &&
    siteById[site].landings.some((href) => allowsPath(session, href))
  )
}

/** A path is open when its page is allowed and the role may open both the path's site and this host's site. */
export function canOpenPath(session: Access, path: string) {
  const host = currentSite()
  return allowsPath(session, path) && canOpenSite(session, siteForPath(path)) && (!host || canOpenSite(session, host))
}

const roleLabels: Partial<Record<string, string>> = {
  professor: 'Faculty',
  staff: 'CCS staff',
  osas: 'OSAS',
  president: "President's Office",
}

export const roleLabel = (role: string) => roleLabels[role] ?? role[0].toUpperCase() + role.slice(1)

/** Where a signed-in person lands on this host: the current site's first allowed landing, else Home (Admin for administrators). */
export function landingFor(session: Access, site = currentSite()) {
  const landing = site && site !== 'portal' && canOpenSite(session, site) ? siteLanding(site, (href) => allowsPath(session, href)) : undefined
  return landing ?? (session.user.roles.includes('administrator') ? '/admin' : '/home')
}

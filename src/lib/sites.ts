import { pageAllowed, pageIdForPath } from '@/lib/page-catalog'
import type { Role } from '@/lib/api'

// ACCS module sites (docs/deltas/2026-11-05-one-portal-host.md). A site is a navigation group on the one portal host;
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
    modules: ['STU-06', 'STU-07', 'STU-08', 'STU-09', 'PRO-06', 'CHR-02', 'CHR-07', 'DEAN-02', 'GUD-01', 'GUD-02', 'OSAS-01'],
  },
  {
    id: 'evaluations',
    label: 'Evaluations',
    purpose: 'Faculty evaluation forms, cycles, and results.',
    icon: 'list-checks',
    lane: 'navy',
    prefixes: ['/evaluations'],
    // A Program Chair has results but no evaluations of their own, and the Dean manages cycles: both still open the site.
    landings: ['/evaluations', '/evaluations/results', '/evaluations/cycles'],
    modules: ['STU-10', 'PRO-07', 'PRO-08', 'CHR-04', 'DEAN-03', 'DEAN-04'],
  },
  {
    id: 'records',
    label: 'Records',
    purpose: 'Authorized student records, restrictions, and program analytics.',
    icon: 'archive',
    lane: 'neutral',
    prefixes: ['/records', '/restrictions', '/analytics', '/clearance'],
    landings: ['/analytics', '/records', '/restrictions', '/clearance'],
    modules: ['CHR-03', 'CHR-05', 'DEAN-05', 'GUD-03', 'GUD-04', 'OSAS-02', 'OSAS-03', 'ADM-03'],
  },
  {
    id: 'admin',
    label: 'Admin',
    purpose: 'Accounts, roles, moderation, restrictions, audit, and monitoring.',
    icon: 'gear',
    lane: 'navy',
    prefixes: ['/admin', '/accounts'],
    landings: ['/admin', '/accounts'],
    modules: ['ADM-01', 'ADM-02', 'ADM-04', 'ADM-05', 'ADM-06'],
  },
]

export const siteById = Object.fromEntries(sites.map((site) => [site.id, site])) as Record<SiteId, Site>

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/')

/** Site that owns a path. Unknown paths (/, /sign-in) belong to the portal. */
export function siteForPath(path: string): SiteId {
  return sites.find((site) => site.prefixes.some((prefix) => matches(path, prefix)))?.id ?? 'portal'
}

/** First landing route of a site the session may open. */
export function siteLanding(site: SiteId, allowedHref: (href: string) => boolean) {
  return siteById[site].landings.find(allowedHref)
}

type Access = { allowedPages: string[]; permissions?: string[]; user: { roles: string[]; mustChangeCredentials?: boolean } }

/** Roles that may open each site (docs/deltas/2026-11-01-real-auth-and-visual-refactor.md section 3). */
export const siteRoles: Record<SiteId, Role[] | 'all'> = {
  portal: 'all',
  forums: 'all',
  schedule: ['student', 'organization', 'professor', 'chair', 'dean', 'guidance', 'osas'],
  cases: ['student', 'professor', 'chair', 'dean', 'guidance', 'osas'],
  evaluations: ['student', 'professor', 'chair', 'dean'],
  records: ['chair', 'dean', 'guidance', 'osas', 'administrator', 'secretary'],
  admin: ['administrator', 'dean', 'secretary'],
}

/** Whether the session may open the page that owns `href`. */
export const allowsPath = (session: Access, href: string) => pageAllowed(session, pageIdForPath(href))

/** A site is open when the role is listed for it and at least one of its landing pages is allowed. */
export function canOpenSite(session: Access, site: SiteId) {
  const roles = siteRoles[site]
  return (
    (roles === 'all' || session.user.roles.some((role) => (roles as string[]).includes(role))) &&
    siteById[site].landings.some((href) => allowsPath(session, href))
  )
}

/** A path is open when its page is allowed and the role may open the path's site. */
export const canOpenPath = (session: Access, path: string) => allowsPath(session, path) && canOpenSite(session, siteForPath(path))

const roleLabels: Partial<Record<string, string>> = {
  professor: 'Faculty',
  staff: 'CCS staff',
  secretary: 'CCS secretary',
  osas: 'OSAS',
}

export const roleLabel = (role: string) => roleLabels[role] ?? role[0].toUpperCase() + role.slice(1)

/** Where a signed-in person lands: Home (Admin for administrators). Temporary sign-in details come first. */
export function landingFor(session: Access) {
  if (session.user.mustChangeCredentials) return '/first-login'
  return session.user.roles.includes('administrator') ? '/admin' : '/home'
}

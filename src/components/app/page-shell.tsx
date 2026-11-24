import { useQuery } from '@tanstack/react-query'

import { sessionQuery } from '@/lib/queries'
import { roleLine } from '@/lib/role-scope'
import type { ReactNode } from 'react'

import { allowsPath, siteById, siteForPath, siteLanding, type SiteId } from '@/lib/sites'
import { dateParts } from '@/lib/format'
import { bar, SkeletonRows, useLoadingLayout } from '@/components/app/skeleton-rows'

// Shared page vocabulary for every ACCS screen. Styles live in src/styles.css (foundation section).
// Spec: docs/deltas/2026-11-01-real-auth-and-visual-refactor.md

type Crumb = { label: string; href?: string; site?: SiteId }

/** Page header used at the top of every page. No eyebrow labels above the title. */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  crumbs?: Crumb[]
  actions?: ReactNode
}) {
  // Every page says which role it is shown for (testing sheet: only Home did).
  const session = useQuery(sessionQuery()).data
  const user = session?.user
  return (
    <header className="accs-page-head">
      <div className="accs-page-head__main">
        <div className="accs-page-head__text">
          {crumbs && crumbs.length > 0 && (
            <nav aria-label="Breadcrumb">
              <ol className="accs-crumbs">
                {crumbs.map((crumb) => {
                  // A site crumb opens the first landing this session may open (the first one can be closed to its role).
                  const href = crumb.site && session ? siteLanding(crumb.site, (h) => allowsPath(session, h)) ?? crumb.href : crumb.href
                  return <li key={crumb.label}>{href ? <a href={href}>{crumb.label}</a> : crumb.label}</li>
                })}
              </ol>
            </nav>
          )}
          <h1 className="accs-page-title">{title}</h1>
          {user && <p className="accs-page-role">{roleLine(user)}</p>}
          {description && <p className="accs-page-desc">{description}</p>}
        </div>
      </div>
      {actions && <div className="accs-page-actions">{actions}</div>}
    </header>
  )
}

/** Breadcrumb root for the site that owns a path. */
export function siteCrumb(path: string): Crumb {
  const site = siteById[siteForPath(path)]
  return { label: site.label, href: site.landings[0], site: site.id }
}

/** The one container. Pass `flush` for lists and tables that run edge to edge. */
export function Panel({
  title,
  action,
  flush,
  interactive,
  className,
  children,
  as: Tag = 'section',
  ...rest
}: {
  title?: ReactNode
  action?: ReactNode
  flush?: boolean
  interactive?: boolean
  className?: string
  children?: ReactNode
  as?: 'section' | 'article' | 'div' | 'aside'
} & Record<`aria-${string}` | `data-${string}`, string | undefined>) {
  const classes = ['accs-panel', flush && 'accs-panel--flush', interactive && 'accs-panel--interactive', className]
    .filter(Boolean)
    .join(' ')
  return (
    <Tag className={classes} {...rest}>
      {(title || action) && (
        <div className="accs-panel__head">
          {title && <h2 className="accs-panel__title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Tag>
  )
}

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'neutral'

/** Dot + label status chip. Always text, never color alone. */
/**
 * The office a case status names ("Escalated to Program Chair", "Case File at Guidance"), so each office has its own color,
 * the same as its role color in the Directory (QA 19 November: every escalation looked the same blue).
 */
export function officeOf(status: string) {
  const s = status.toLowerCase()
  if (!/(escalat|with |at guidance|at osas|case file|transfer|submitted to)/.test(s)) return undefined
  if (s.includes('program chair') || /\bchair\b/.test(s)) return 'chair'
  if (s.includes('dean')) return 'dean'
  if (s.includes('guidance')) return 'guidance'
  if (s.includes('osas')) return 'osas'
  if (s.includes('adviser')) return 'adviser'
  return undefined
}

export function StatusChip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const office = typeof children === 'string' ? officeOf(children) : undefined
  const closed = typeof children === 'string' && /^closed\b/i.test(children.trim())
  return (
    <span className="accs-status" data-tone={tone === 'neutral' ? undefined : tone} data-office={office} data-closed={closed || undefined}>
      {children}
    </span>
  )
}

/** Map common workflow words to a tone: green done, red refused or urgent, yellow waiting, blue in progress. */
export function toneFor(status: string): Tone {
  const s = status.toLowerCase()
  // "Not finished" and "Not started" are waiting, even though they contain a done word.
  if (/(^|[^a-z])not (started|finished|yet|chosen|set)/.test(s)) return 'warn'
  if (/(^|[^a-z])(unfinished|unclear|not cleared)/.test(s)) return 'warn'
  if (/(resolved|completed|approved|booked|published|active|submitted|done|closed|ok|healthy|confirmed|\bclear(ed)?\b|\bfinished\b|\bkept\b|good standing|\blow\b)/.test(s)) return 'ok'
  if (/(declined|rejected|removed|cancel|overdue|high|urgent|failed|restricted|suspended|missing|on hold|paused)/.test(s)) return 'danger'
  if (/(pending|requested|review|draft|waiting|medium|due|open|not started|important)/.test(s)) return 'warn'
  if (/(new|in progress|escalat|with |transfer|case file|at guidance|at osas|ongoing|scheduled)/.test(s)) return 'info'
  return 'neutral'
}

export function Kpis({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="accs-kpis" role="list" aria-label={label}>
      {children}
    </div>
  )
}

export function Kpi({ label, value, note, href }: { label: string; value: ReactNode; note?: ReactNode; href?: string }) {
  const loading = useLoadingLayout()
  const body = loading ? (
    <>
      <p className="accs-kpi__label">{label}</p>
      <p className="accs-kpi__value">{bar('3rem', 28)}</p>
    </>
  ) : (
    <>
      <p className="accs-kpi__label">{label}</p>
      <p className="accs-kpi__value">{value}</p>
      {note && <p className="accs-kpi__note">{note}</p>}
    </>
  )
  return href ? (
    <a className="accs-kpi" role="listitem" href={href}>
      {body}
    </a>
  ) : (
    <div className="accs-kpi" role="listitem">
      {body}
    </div>
  )
}

export function DateTile({ value }: { value: unknown }) {
  const parts = dateParts(value)
  if (!parts) return null
  return (
    <span className="accs-date" aria-hidden>
      <span className="accs-date__month">{parts.month}</span>
      <span className="accs-date__day">{parts.day}</span>
    </span>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  // While the page's data loads, an empty list is a loading list, not "nothing here".
  if (useLoadingLayout()) return <SkeletonRows count={3} />
  return (
    <div className="accs-empty">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
      {action}
    </div>
  )
}

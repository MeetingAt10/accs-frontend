import type { ReactNode } from 'react'

import { siteById, siteForPath } from '@/lib/sites'
import { dateParts } from '@/lib/format'

// Shared page vocabulary for every ACCS screen. Styles live in src/styles.css (foundation section).
// Spec: docs/deltas/2026-11-01-real-auth-and-visual-refactor.md

type Crumb = { label: string; href?: string }

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
  return (
    <header className="accs-page-head">
      <div className="accs-page-head__main">
        <div className="accs-page-head__text">
          {crumbs && crumbs.length > 0 && (
            <nav aria-label="Breadcrumb">
              <ol className="accs-crumbs">
                {crumbs.map((crumb) => (
                  <li key={crumb.label}>{crumb.href ? <a href={crumb.href}>{crumb.label}</a> : crumb.label}</li>
                ))}
              </ol>
            </nav>
          )}
          <h1 className="accs-page-title">{title}</h1>
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
  return { label: site.label, href: site.landings[0] }
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
export function StatusChip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="accs-status" data-tone={tone === 'neutral' ? undefined : tone}>
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
  const body = (
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
  return (
    <div className="accs-empty">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
      {action}
    </div>
  )
}

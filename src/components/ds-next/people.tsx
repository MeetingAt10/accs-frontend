import { Icon, Link } from '@meetingat10/design-system/react'
import type { ReactNode } from 'react'

import { initials } from '@/lib/format'

import './people.css'

export interface PersonCardProps {
  name: string
  role?: ReactNode
  office?: string
  description?: ReactNode
  meta?: ReactNode
  href?: string
  actions?: ReactNode
}

/** Directory row: initials avatar, name (the whole card links when `href` is set), role tags, office. */
export function PersonCard({
  name,
  role,
  office,
  description,
  meta,
  href,
  actions,
}: PersonCardProps) {
  return (
    <article className="ds-next-person-card" data-link={href ? '' : undefined}>
      <span className="accs-avatar ds-next-person-card__avatar" aria-hidden>
        {initials(name)}
      </span>
      <div className="ds-next-person-card__body">
        <h3 className="ds-next-person-card__name">
          {href ? (
            <Link href={href} className="ds-next-person-card__link">
              {name}
            </Link>
          ) : (
            name
          )}
        </h3>
        {role && <div className="ds-next-person-card__roles">{role}</div>}
        {office && <p className="ds-next-person-card__line">{office}</p>}
        {description && <p className="ds-next-person-card__line">{description}</p>}
      </div>
      {(meta || actions) && (
        <div className="ds-next-person-card__meta">
          {meta}
          {actions}
        </div>
      )}
    </article>
  )
}

export interface ProfileHeaderProps {
  name: string
  role?: ReactNode
  title?: string
  office?: string
  email?: string
  compact?: boolean
  actions?: ReactNode
}

export function ProfileHeader({
  name,
  role,
  title,
  office,
  email,
  compact = false,
  actions,
}: ProfileHeaderProps) {
  return (
    <header
      className={[
        'ds-next-profile-header',
        compact && 'ds-next-profile-header--compact',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="ds-next-profile-header__avatar" aria-hidden>
        {initials(name)}
      </span>
      <div className="ds-next-profile-header__body">
        <h1 className="accs-page-title">{name}</h1>
        {(role || title) && (
          <div className="ds-next-profile-header__roles">
            {role}
            {title && <span>{title}</span>}
          </div>
        )}
        {(office || email) && (
          <div className="ds-next-profile-header__contact">
            {office && (
              <span>
                <Icon name="map-pin" size={16} />
                {office}
              </span>
            )}
            {email && (
              <Link href={`mailto:${email}`}>
                <Icon name="envelope" size={16} />
                {email}
              </Link>
            )}
          </div>
        )}
      </div>
      {actions && (
        <div className="ds-next-profile-header__actions">{actions}</div>
      )}
    </header>
  )
}

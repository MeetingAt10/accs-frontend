import {
  Avatar,
  Card,
  CardBody,
  CardHeader,
  CardMeta,
  CardTitle,
  Link,
  RoleBadge,
  Row,
} from '@meetingat10/design-system/react'
import type { ReactNode } from 'react'

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
    <Card link={Boolean(href)} className="ds-next-person-card">
      <CardHeader>
        <Avatar name={name} size={48} />
        {role && <RoleBadge>{role}</RoleBadge>}
      </CardHeader>
      <CardTitle href={href}>{name}</CardTitle>
      {office && <CardBody>{office}</CardBody>}
      {description && <CardBody>{description}</CardBody>}
      {(meta || actions) && (
        <CardMeta>
          {meta}
          {actions}
        </CardMeta>
      )}
    </Card>
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
      <Avatar name={name} size={compact ? 48 : 64} />
      <div className="ds-next-profile-header__body">
        <h1 className="ds-section-header__title">{name}</h1>
        <Row gap={8}>
          {role && <RoleBadge>{role}</RoleBadge>}
          {title && <span>{title}</span>}
        </Row>
        <Row gap={8}>
          {office && <span>{office}</span>}
          {email && <Link href={`mailto:${email}`}>{email}</Link>}
        </Row>
      </div>
      {actions && (
        <div className="ds-next-profile-header__actions">{actions}</div>
      )}
    </header>
  )
}

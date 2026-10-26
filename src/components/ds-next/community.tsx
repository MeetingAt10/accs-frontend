import { Avatar, Button, RoleBadge } from '@meetingat10/design-system/react'
import type { ReactNode } from 'react'

import './community.css'

export interface CommentThreadProps {
  children: ReactNode
  label?: string
}

export function CommentThread({
  children,
  label = 'Comments',
}: CommentThreadProps) {
  return (
    <ol className="ds-next-comment-thread" aria-label={label}>
      {children}
    </ol>
  )
}

export interface CommentProps {
  author: string
  role?: string
  date: string
  dateTime?: string
  children: ReactNode
  actions?: ReactNode
}

export function Comment({
  author,
  role,
  date,
  dateTime,
  children,
  actions,
}: CommentProps) {
  return (
    <li className="ds-next-comment">
      <Avatar name={author} size={32} />
      <div className="ds-next-comment__content">
        <div className="ds-next-comment__meta">
          <strong>{author}</strong>
          {role && <RoleBadge>{role}</RoleBadge>}
          <time dateTime={dateTime}>{date}</time>
        </div>
        <div className="ds-prose ds-next-comment__body">{children}</div>
        {actions && <div className="ds-next-comment__actions">{actions}</div>}
      </div>
    </li>
  )
}

export interface ReactionButtonProps {
  count: number
  isSelected?: boolean
  isDisabled?: boolean
  loading?: boolean
  onChange: (selected: boolean) => void
}

export function ReactionButton({
  count,
  isSelected = false,
  isDisabled,
  loading,
  onChange,
}: ReactionButtonProps) {
  return (
    <Button
      variant={isSelected ? 'primary' : 'secondary'}
      aria-pressed={isSelected}
      aria-label={`Agree, ${count} ${count === 1 ? 'agreement' : 'agreements'}`}
      isDisabled={isDisabled}
      loading={loading}
      onPress={() => onChange(!isSelected)}
    >
      Agree <span className="ds-next-reaction-count">{count}</span>
    </Button>
  )
}

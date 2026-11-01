import { Icon } from '@meetingat10/design-system/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import { initials } from '@/lib/format'
import './community.css'

const ease = [0.16, 1, 0.3, 1] as const

export interface CommentThreadProps {
  children: ReactNode
  label?: string
}

/** New comments slide in; comments already on the page do not animate. */
export function CommentThread({
  children,
  label = 'Comments',
}: CommentThreadProps) {
  return (
    <ol className="ds-next-comment-thread" aria-label={label}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </ol>
  )
}

export interface CommentProps {
  author: string
  role?: string
  date: string
  /** Full date and time, shown on hover. */
  fullDate?: string
  dateTime?: string
  children: ReactNode
  actions?: ReactNode
}

export function Comment({
  author,
  role,
  date,
  fullDate,
  dateTime,
  children,
  actions,
}: CommentProps) {
  const reduce = useReducedMotion()
  return (
    <motion.li
      className="ds-next-comment"
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4, ease }}
    >
      <span className="accs-avatar ds-next-comment__avatar" aria-hidden>
        {initials(author) || '?'}
      </span>
      <div className="ds-next-comment__content">
        <div className="ds-next-comment__meta">
          <strong>{author}</strong>
          {role && <span className="accs-tag">{role}</span>}
          <time dateTime={dateTime} title={fullDate}>
            {date}
          </time>
        </div>
        <div className="ds-next-comment__body">{children}</div>
        {actions && <div className="ds-next-comment__actions">{actions}</div>}
      </div>
    </motion.li>
  )
}

export interface ReactionButtonProps {
  count: number
  isSelected?: boolean
  isDisabled?: boolean
  loading?: boolean
  onChange: (selected: boolean) => void
}

/** Agree toggle: the caret pops on select and the count rolls to its new value. */
export function ReactionButton({
  count,
  isSelected = false,
  isDisabled,
  loading,
  onChange,
}: ReactionButtonProps) {
  const reduce = useReducedMotion()
  const busy = Boolean(loading)
  return (
    <motion.button
      type="button"
      className="ds-next-reaction"
      aria-pressed={isSelected}
      aria-label={`Agree, ${count} ${count === 1 ? 'agreement' : 'agreements'}`}
      disabled={isDisabled || busy}
      onClick={() => onChange(!isSelected)}
      whileTap={reduce ? undefined : { scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 600, damping: 22 }}
    >
      <motion.span
        className="ds-next-reaction__icon"
        key={String(isSelected)}
        initial={reduce ? false : { scale: 0.6, y: 4 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 12 }}
      >
        <Icon name="caret-up" size={16} weight={isSelected ? 'fill' : 'bold'} />
      </motion.span>
      <span className="ds-next-reaction__label">Agree</span>
      <span className="ds-next-reaction-count" aria-hidden>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={count}
            className="ds-next-reaction__num"
            initial={reduce ? false : { y: isSelected ? 10 : -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: isSelected ? -10 : 10, opacity: 0 }}
            transition={{ duration: 0.22, ease }}
          >
            {count}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.button>
  )
}

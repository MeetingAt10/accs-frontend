import { Search } from '@meetingat10/design-system/react'
import type { HTMLAttributes, ReactNode } from 'react'

export { Comment, CommentThread, ReactionButton } from './community'
export type { CommentProps, CommentThreadProps, ReactionButtonProps } from './community'
export { EventCalendar } from './EventCalendar'
export type { CalendarEvent, EventCalendarProps } from './EventCalendar'
export { PersonCard, ProfileHeader } from './people'
export type { PersonCardProps, ProfileHeaderProps } from './people'

export interface StatProps {
  label: string
  value: ReactNode
  change?: string
  scopeNote?: string
}

export function Stat({ label, value, change, scopeNote }: StatProps) {
  return (
    <section className="ds-next-stat" aria-label={label}>
      <p className="ds-next-stat__label">{label}</p>
      <p className="ds-next-stat__value">{value}</p>
      {change && <p className="ds-next-stat__change">{change}</p>}
      {scopeNote && <p className="ds-next-stat__scope">{scopeNote}</p>}
    </section>
  )
}

export interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  query?: string
  onQueryChange?: (query: string) => void
  searchLabel?: string
  searchPlaceholder?: string
  activeFilters?: string[]
  children?: ReactNode
}

export function FilterBar({
  query,
  onQueryChange,
  searchLabel = 'Search this list',
  searchPlaceholder,
  activeFilters = [],
  children,
  ...props
}: FilterBarProps) {
  return (
    <div {...props} className={['ds-next-filter-bar', props.className].filter(Boolean).join(' ')}>
      <div className="ds-next-filter-bar__controls">
        <Search
          label={searchLabel}
          placeholder={searchPlaceholder}
          value={query}
          onChange={onQueryChange}
          size="sm"
        />
        {children}
      </div>
      {activeFilters.length > 0 && (
        <ul className="ds-next-filter-bar__chips" aria-label="Active filters">
          {activeFilters.map((filter) => <li key={filter}>{filter}</li>)}
        </ul>
      )}
    </div>
  )
}

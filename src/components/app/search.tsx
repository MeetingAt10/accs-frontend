import { Icon, Link, ViewState, type IconName } from '@meetingat10/design-system/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'

import { searchAll, type SearchHit, type SearchResults } from '@/lib/api'
import { Empty, PageHeader, Panel } from '@/components/app/page-shell'
import './search.css'

// The top search (decided 16 November 2026): posts, class spaces, people, cases and student records in one place. The
// API returns only what this person may open, a few of each kind, so the page shows each group and links on.

const groups: { key: keyof SearchResults['groups']; title: string; icon: IconName }[] = [
  { key: 'posts', title: 'Posts', icon: 'chats' },
  { key: 'spaces', title: 'Class spaces', icon: 'graduation-cap' },
  { key: 'people', title: 'People', icon: 'users' },
  { key: 'cases', title: 'Cases and reports', icon: 'file' },
  { key: 'records', title: 'Student records', icon: 'student' },
]

function Hits({ hits }: { hits: SearchHit[] }) {
  return (
    <ul className="sr-hits">
      {hits.map((hit) => (
        <li key={hit.id}>
          <Link variant="quiet" className="sr-hit" href={hit.href}>
            <span className="sr-hit__title">{hit.title}</span>
            {hit.sub && <span className="sr-hit__sub">{hit.sub}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function SearchScreen() {
  const q = useRouterState({ select: (state) => new URLSearchParams(state.location.searchStr).get('q') ?? '' }).trim()
  const results = useQuery({
    queryKey: ['search', q],
    queryFn: () => searchAll(q),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  })
  const found = results.data ? groups.filter((group) => results.data!.groups[group.key]?.length) : []
  return (
    <div className="app-page accs-stack">
      <PageHeader title="Search" description={q ? `Results for "${q}" that you can open.` : 'Search posts, class spaces, people, cases and records.'} />
      {q.length < 2 ? (
        <Panel><Empty title="Type at least two letters">Use the search box at the top of the page.</Empty></Panel>
      ) : results.isPending ? (
        <ViewState kind="loading" title="Searching" />
      ) : results.isError ? (
        <Panel><Empty title="Search didn't work">Try again in a moment.</Empty></Panel>
      ) : found.length ? (
        <div className="sr-groups">
          {found.map((group) => (
            <Panel
              key={group.key}
              flush
              title={<span className="sr-group-title"><Icon name={group.icon} size={16} />{group.title}</span>}
            >
              <Hits hits={results.data!.groups[group.key]} />
            </Panel>
          ))}
        </div>
      ) : (
        <Panel><Empty title="Nothing found">Try another word, a name, or a reference such as a case number.</Empty></Panel>
      )}
    </div>
  )
}

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'

import logo from '@/assets/dev-toolbox/accs-dev-toolbox.svg?inline'
import { ApiError } from '@/lib/api'
import { listDevUsers, switchDevUser, type DevUser } from '@/lib/dev-toolbox-api'
import { sessionQuery } from '@/lib/queries'
import { landingFor, roleLabel, siteHref } from '@/lib/sites'

import './dev-toolbox.css'

// Development-stack account switcher (docs/deltas/2026-11-05-consultation-50-percent.md, slice E).
// __root.tsx loads this file only when the build flag is set, so no other build contains it, its stylesheet, or its logo.

/** The demo flow's roles come first, everyone else after. */
const roleOrder = ['dean', 'secretary', 'professor', 'chair', 'student']
const rank = (role: string) => (roleOrder.includes(role) ? roleOrder.indexOf(role) : roleOrder.length)

/** Accounts matching `search`, grouped by their first role. */
function groupByRole(users: DevUser[], search: string) {
  const needle = search.trim().toLowerCase()
  const groups = new Map<string, DevUser[]>()
  for (const user of users) {
    const text = [user.name, user.username, ...user.roles.map(roleLabel)].join(' ').toLowerCase()
    if (!text.includes(needle)) continue
    const role = user.roles[0] ?? ''
    groups.set(role, [...(groups.get(role) ?? []), user])
  }
  return [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
}

export default function DevToolbox() {
  const queryClient = useQueryClient()
  // Only the sign-in pages have no session. Everywhere else the API answers 401 when nobody is signed in, and that hides the toolbox.
  const onAuthPage = useRouterState({ select: (state) => state.matches.some((match) => match.routeId === '/_auth') })
  const users = useQuery({
    queryKey: ['dev-toolbox', 'users'],
    queryFn: listDevUsers,
    enabled: !onAuthPage,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [switching, setSwitching] = useState<string>()
  const [error, setError] = useState<string>()
  const session = useQuery({ ...sessionQuery(), enabled: open }).data
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const panelId = useId()
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    // A touch screen would raise the keyboard over the list, so only move focus into the panel for a keyboard or mouse.
    if (!matchMedia('(pointer: coarse)').matches) field.current?.focus()
    void users.refetch()
    const away = (event: PointerEvent) => root.current?.contains(event.target as Node) || setOpen(false)
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const gone = users.error instanceof ApiError && (users.error.status === 401 || users.error.status === 404)
  if (onAuthPage || users.isPending || gone) return null

  async function pick(user: DevUser) {
    // aria-disabled keeps focus on the row, so a keyboard user is not dropped if the switch fails.
    if (switching) return
    setSwitching(user.id)
    setError(undefined)
    try {
      const next = await switchDevUser(user.id)
      queryClient.clear()
      // A full page load leaves nothing of the previous account in memory, and it also covers a landing on another site's host.
      window.location.assign(siteHref(landingFor(next)))
    } catch (cause) {
      setSwitching(undefined)
      setError(cause instanceof Error ? cause.message : 'Could not switch accounts.')
    }
  }

  const groups = groupByRole(users.data ?? [], search)

  return (
    <div className="dev-toolbox" ref={root}>
      <button
        ref={button}
        type="button"
        className="dev-toolbox__button"
        aria-label="Dev toolbox"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title="Dev toolbox (dev only)"
        onClick={() => {
          setError(undefined)
          setOpen(!open)
        }}
      >
        <img src={logo} alt="" width={36} height={36} />
      </button>
      {open && (
        <div className="dev-toolbox__panel" id={panelId} role="dialog" aria-labelledby={titleId}>
          <div className="dev-toolbox__head">
            <h2 className="dev-toolbox__title" id={titleId}>
              Switch account
            </h2>
            <span className="dev-toolbox__tag">Dev only</span>
          </div>
          {session && (
            <p className="dev-toolbox__who">
              Signed in as <strong>{session.user.name}</strong>, {session.user.roles.map(roleLabel).join(' · ')}
            </p>
          )}
          <input
            ref={field}
            type="search"
            className="dev-toolbox__search"
            aria-label="Search accounts"
            placeholder="Search name, username, or role"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {error && (
            <p className="dev-toolbox__error" role="alert">
              {error}
            </p>
          )}
          <div className="dev-toolbox__list">
            {users.isError && (
              <p className="dev-toolbox__error" role="alert">
                Could not load accounts.{' '}
                <button type="button" className="dev-toolbox__retry" onClick={() => void users.refetch()}>
                  Try again
                </button>
              </p>
            )}
            {groups.length === 0 && !users.isError && (
              <p className="dev-toolbox__empty" role="status">
                {users.data?.length ? 'No accounts match.' : 'No accounts.'}
              </p>
            )}
            {groups.map(([role, members]) => (
              <div key={role}>
                <h3 className="dev-toolbox__group">{role ? roleLabel(role) : 'No role'}</h3>
                <ul className="dev-toolbox__users" role="list">
                  {members.map((user) => {
                    const current = user.id === session?.user.id
                    return (
                      <li key={user.id}>
                        <button
                          type="button"
                          className={user.active ? 'dev-toolbox__user' : 'dev-toolbox__user dev-toolbox__user--off'}
                          aria-current={current ? 'true' : undefined}
                          aria-disabled={switching !== undefined || undefined}
                          onClick={() => (current ? setOpen(false) : void pick(user))}
                        >
                          <span className="dev-toolbox__name">{user.name}</span>
                          <span className="dev-toolbox__meta">
                            {user.username && <span>{user.username}</span>}
                            {user.roles.length > 1 && <span>{user.roles.map(roleLabel).join(' · ')}</span>}
                            {!user.active && <span className="dev-toolbox__flag">Inactive</span>}
                            {current && <span className="dev-toolbox__flag">Current</span>}
                            {switching === user.id && <span>Switching…</span>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

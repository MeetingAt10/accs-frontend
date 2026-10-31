import {
  Alert,
  Avatar,
  Badge,
  DoorPlate,
  RoleBadge,
  Search,
  Spinner,
  ViewState,
} from '@meetingat10/design-system/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { signIn } from '@/lib/api'
import { demoAccountsQuery } from '@/lib/queries'
import { currentSite, landingFor, siteById, siteHref, sites } from '@/lib/sites'

import './sign-in.css'

export const Route = createFileRoute('/_auth/sign-in')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' && search.redirect.startsWith('/') && !search.redirect.startsWith('//')
      ? search.redirect
      : undefined,
  }),
  component: SignInPage,
})

// Fixed display order for role groups; a multi-role account is listed under its first role here.
const roleOrder = ['student', 'organization', 'professor', 'staff', 'chair', 'dean', 'guidance', 'osas', 'president', 'administrator']
const roleLabels: Record<string, string> = {
  student: 'Students',
  organization: 'Student organization',
  professor: 'Professors',
  staff: 'CCS staff',
  chair: 'Program chairs',
  dean: 'Dean',
  guidance: 'Guidance',
  osas: 'OSAS',
  president: "President's Office",
  administrator: 'Administration',
}

function SignInPage() {
  const router = useRouter()
  const { redirect: redirectTo } = Route.useSearch()
  const queryClient = useQueryClient()
  const accounts = useQuery(demoAccountsQuery())
  const [query, setQuery] = useState('')
  const site = currentSite()
  const mutation = useMutation({
    mutationFn: signIn,
    onSuccess: (session) => {
      queryClient.setQueryData(['session'], session)
      const destination = siteHref(redirectTo ?? landingFor(session))
      if (destination.startsWith('/')) router.history.push(destination)
      else window.location.assign(destination)
    },
  })

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = (accounts.data?.accounts ?? []).filter(
      (account) =>
        !needle ||
        [account.name, account.email, account.description, ...account.roles].join(' ').toLowerCase().includes(needle),
    )
    return roleOrder
      .map((role) => ({
        role,
        accounts: list.filter((account) => roleOrder.find((r) => account.roles.includes(r as never)) === role),
      }))
      .filter((group) => group.accounts.length)
  }, [accounts.data, query])

  return (
    <main className="sign-in">
      <section className="sign-in__brand" aria-label="About ACCS">
        <div className="sign-in__brand-inner">
          <DoorPlate size="lg" code="ACCS" />
          <h1 className="sign-in__headline">Your access to the College of Computer Studies</h1>
          <p className="sign-in__lede">
            Discussions, consultations, reports, and evaluations for IT, CS, and IS, each on its own site with one
            sign-in.
          </p>
          <ul className="sign-in__sites" aria-label="ACCS sites">
            {sites.map((entry) => (
              <li key={entry.id} aria-current={entry.id === site ? 'true' : undefined}>
                {entry.label}
              </li>
            ))}
          </ul>
        </div>
        <img className="sign-in__art" src="/brand/sites/crest.webp" alt="" width={420} height={420} />
      </section>

      <section className="sign-in__panel" aria-labelledby="sign-in-title">
        <div className="sign-in__panel-head">
          <h2 id="sign-in-title" className="sign-in__title">
            Sign in{site ? ` to ${siteById[site].label}` : ''}
          </h2>
          <Badge outline marker={false}>
            Sample data
          </Badge>
        </div>
        <p className="sign-in__note">
          This prototype uses simulated QCU accounts. Choose a demo account to continue.
        </p>
        {mutation.error && (
          <Alert tone="danger" title="Sign-in failed">
            The account could not be signed in. Choose an available demo account and try again.
          </Alert>
        )}
        {accounts.isPending ? (
          <ViewState kind="loading" title="Loading demo accounts" />
        ) : accounts.isError ? (
          <ViewState
            kind="error"
            title="Demo accounts couldn't be loaded"
            description="Check that the API is running, then refresh this page."
          />
        ) : (
          <>
            <Search label="Find a demo account" placeholder="Name, role, or program" value={query} onChange={setQuery} />
            {groups.length === 0 && <p className="sign-in__note">No demo account matches “{query.trim()}”.</p>}
            {groups.map((group) => (
              <section key={group.role} className="sign-in__group" aria-labelledby={`sign-in-group-${group.role}`}>
                <h3 id={`sign-in-group-${group.role}`} className="sign-in__group-title">
                  {roleLabels[group.role]}
                </h3>
                <ul className="sign-in__accounts">
                  {group.accounts.map((account) => {
                    const pending = mutation.isPending && mutation.variables === account.id
                    return (
                      <li key={account.id}>
                        <button
                          type="button"
                          className="sign-in__account"
                          disabled={mutation.isPending}
                          aria-busy={pending || undefined}
                          aria-label={`Continue as ${account.name}, ${account.roles.join(', ')}`}
                          onClick={() => mutation.mutate(account.id)}
                        >
                          <Avatar name={account.name} size={36} />
                          <span className="sign-in__account-text">
                            <span className="sign-in__account-name">{account.name}</span>
                            <span className="sign-in__account-detail">{account.description}</span>
                            <span className="sign-in__account-roles">
                              {account.roles.map((role) => (
                                <RoleBadge key={role}>{role}</RoleBadge>
                              ))}
                            </span>
                          </span>
                          <span className="sign-in__account-go" aria-hidden>
                            {pending ? <Spinner size={20} label="Signing in" /> : '→'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
            <p className="sign-in__note">
              Access changes apply the next time you sign in. This page does not create an account or reset a password.
            </p>
          </>
        )}
      </section>
    </main>
  )
}

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Container,
  DoorPlate,
  RoleBadge,
  SectionHeader,
  ViewState,
} from '@meetingat10/design-system/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { signIn } from '@/lib/api'
import { demoAccountsQuery } from '@/lib/queries'

export const Route = createFileRoute('/_auth/sign-in')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' && search.redirect.startsWith('/') && !search.redirect.startsWith('//')
      ? search.redirect
      : undefined,
  }),
  component: SignInPage,
})

function SignInPage() {
  const router = useRouter()
  const { redirect: redirectTo } = Route.useSearch()
  const queryClient = useQueryClient()
  const accounts = useQuery(demoAccountsQuery())
  const mutation = useMutation({
    mutationFn: signIn,
    onSuccess: (session) => {
      queryClient.setQueryData(['session'], session)
      const destination = redirectTo ?? (session.user.roles.includes('administrator') ? '/admin' : '/home')
      router.history.push(destination)
    },
  })

  return (
    <main className="sign-in-page">
      <Container width="reading">
        <div className="sign-in-brand">
          <DoorPlate size="lg" code="ACCS" />
          <Badge outline marker={false}>Sample data</Badge>
        </div>
        <SectionHeader
          level={1}
          title="Sign in to ACCS"
          description="This prototype uses simulated QCU accounts. Choose a demo account to continue."
        />
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
            <SectionHeader level={2} title="Demo accounts" />
            <div className="sign-in-accounts">
              {accounts.data.accounts.map((account) => (
                <Card key={account.id} className="sign-in-account">
                  <CardTitle level={3}>{account.name}</CardTitle>
                  <CardBody>{account.description}</CardBody>
                  <p className="sign-in-account__email">{account.email}</p>
                  <div className="sign-in-account__roles">
                    {account.roles.map((role) => <RoleBadge key={role}>{role}</RoleBadge>)}
                  </div>
                  <Button
                    variant="secondary"
                    loading={mutation.isPending && mutation.variables === account.id}
                    isDisabled={mutation.isPending}
                    onPress={() => mutation.mutate(account.id)}
                  >
                    Continue as {account.name}
                  </Button>
                </Card>
              ))}
            </div>
            <p className="sign-in-note">Access changes apply the next time you sign in. This page does not create an account or reset a password.</p>
          </>
        )}
      </Container>
    </main>
  )
}

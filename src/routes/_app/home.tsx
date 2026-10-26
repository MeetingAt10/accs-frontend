import { createFileRoute, redirect } from '@tanstack/react-router'

import { PageScreen } from '@/components/app/PageScreen'
import { RoutePermission } from '@/components/app/guards'
import { sessionQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app/home')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery())
    if (session.user.roles.includes('administrator')) throw redirect({ href: '/admin' })
    return RoutePermission(context.queryClient, 'P03')
  },
  component: () => <PageScreen pageId="P03" />,
})

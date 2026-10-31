import { createFileRoute, redirect } from '@tanstack/react-router'

import { sessionQuery } from '@/lib/queries'
import { landingFor } from '@/lib/sites'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery()).catch(() => undefined)
    throw redirect({ href: session ? landingFor(session) : '/sign-in' })
  },
})

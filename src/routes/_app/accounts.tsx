import { createFileRoute } from '@tanstack/react-router'

import { AccountsScreen } from '@/components/app/accounts'
import { RoutePermission } from '@/components/app/guards'

export const Route = createFileRoute('/_app/accounts')({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, 'accounts'),
  component: AccountsScreen,
})

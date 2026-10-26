import { createFileRoute } from '@tanstack/react-router'

import { PageScreen } from '@/components/app/PageScreen'
import { RoutePermission } from '@/components/app/guards'

export const Route = createFileRoute('/_app/organizations/$orgId')({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, 'P10'),
  component: () => <PageScreen pageId="P10" />,
})

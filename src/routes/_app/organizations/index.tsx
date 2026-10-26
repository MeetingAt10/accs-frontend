import { createFileRoute } from '@tanstack/react-router'

import { PageScreen } from '@/components/app/PageScreen'
import { RoutePermission } from '@/components/app/guards'

export const Route = createFileRoute('/_app/organizations/')({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, 'P09'),
  component: () => <PageScreen pageId="P09" />,
})

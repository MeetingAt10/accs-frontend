import { createFileRoute } from '@tanstack/react-router'

import { PageScreen } from '@/components/app/PageScreen'
import { RoutePermission } from '@/components/app/guards'

export const Route = createFileRoute('/_app/spaces/$spaceId')({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, 'P08'),
  component: () => <PageScreen pageId="P08" />,
})

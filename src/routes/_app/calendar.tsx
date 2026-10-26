import { createFileRoute } from '@tanstack/react-router'

import { PageScreen } from '@/components/app/PageScreen'
import { RoutePermission } from '@/components/app/guards'

export const Route = createFileRoute('/_app/calendar')({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, 'P13'),
  component: () => <PageScreen pageId="P13" />,
})

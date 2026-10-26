import { createFileRoute } from '@tanstack/react-router'

import { PageScreen } from '@/components/app/PageScreen'
import { RoutePermission } from '@/components/app/guards'

export const Route = createFileRoute('/_app/spaces/')({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, 'P07'),
  component: () => <PageScreen pageId="P07" />,
})

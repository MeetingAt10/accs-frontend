import { createFileRoute } from '@tanstack/react-router'

import { PageScreen } from '@/components/app/PageScreen'
import { RoutePermission } from '@/components/app/guards'

export const Route = createFileRoute('/_app/consultations/availability')({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, 'P17'),
  component: () => <PageScreen pageId="P17" />,
})

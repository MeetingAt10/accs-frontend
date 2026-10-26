import { createFileRoute } from '@tanstack/react-router'
import { PageScreen } from '@/components/app/PageScreen'
import { RoutePermission } from '@/components/app/guards'

export const Route = createFileRoute('/_app/reports/new')({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, 'P19'),
  component: () => <PageScreen pageId="P19" />,
})

import { createFileRoute } from '@tanstack/react-router'
import { PageScreen } from '@/components/app/PageScreen'
import { RoutePermission } from '@/components/app/guards'

export const Route = createFileRoute('/_app/cases/')({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, 'P21'),
  component: () => <PageScreen pageId="P21" />,
})

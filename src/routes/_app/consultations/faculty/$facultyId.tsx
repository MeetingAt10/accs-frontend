import { createFileRoute } from '@tanstack/react-router'

import { PageScreen } from '@/components/app/PageScreen'
import { RoutePermission } from '@/components/app/guards'

export const Route = createFileRoute('/_app/consultations/faculty/$facultyId')({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, 'P15'),
  component: () => <PageScreen pageId="P15" />,
})

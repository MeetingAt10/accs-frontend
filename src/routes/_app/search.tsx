import { createFileRoute } from '@tanstack/react-router'

import { SearchScreen } from '@/components/app/search'

// Everyone signed in may search; the API returns only what each person may open.
export const Route = createFileRoute('/_app/search')({
  component: SearchScreen,
})

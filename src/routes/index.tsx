import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await fetch('/api/health')).json() as Promise<{ status: string }>,
  })

  return (
    <main>
      <h1>ACCS</h1>
      <p>API: {health.isPending ? '...' : (health.data?.status ?? 'unreachable')}</p>
    </main>
  )
}

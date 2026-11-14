import { Alert, Button } from '@meetingat10/design-system/react'

/**
 * A secondary list that did not load (MeetingAt10/accs-frontend#5). It says so and offers a retry, so a failed load is never
 * shown as an empty list. `what` names the list in lower case, for example "your class spaces".
 */
export function QueryProblem({ what, onRetry, retrying = false }: { what: string; onRetry: () => void; retrying?: boolean }) {
  return (
    <Alert tone="warning" title={`Couldn't load ${what}`}>
      <span className="query-problem">
        Check your connection, then try again.{' '}
        <Button size="sm" variant="secondary" loading={retrying} onPress={onRetry}>Try again</Button>
      </span>
    </Alert>
  )
}

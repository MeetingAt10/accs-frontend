// The student's report progress (decided 19 November 2026): five equal steps from the API's `progress`.

const progressSteps = ['Submitted', 'Read', 'Escalated', 'Resolved', 'Closed']

/** The steps, the current one (from 0), and its label ("Escalated to Program Chair"). Defaults to Submitted. */
export function progressOf(report: object) {
  const raw = (report as { progress?: unknown }).progress
  const progress = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const steps = Array.isArray(progress.steps) && progress.steps.length ? progress.steps.map(String) : progressSteps
  const step = Math.min(steps.length - 1, Math.max(0, Number(progress.step ?? 0) || 0))
  const escalatedTo = typeof progress.escalatedTo === 'string' ? progress.escalatedTo : ''
  const label = steps[step]! + (steps[step] === 'Escalated' && escalatedTo ? ` to ${escalatedTo}` : '')
  return { steps, step, label }
}

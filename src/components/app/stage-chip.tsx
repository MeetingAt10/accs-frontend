import './stage-chip.css'

/** The handling stages a case moves through, in order. OSAS is the last office; Resolved closes the case. */
export const caseStages = ['adviser', 'chair', 'dean', 'guidance', 'osas'] as const

const labels: Record<string, string> = {
  submitted: 'Submitted',
  adviser: 'With Adviser',
  chair: 'With Program Chair',
  dean: 'With Dean',
  guidance: 'With Guidance',
  osas: 'With OSAS',
  resolved: 'Resolved',
  closed: 'Closed',
}

/** A pill naming the office a case is with, in that office's color (Figma "Stage Chip"). */
export function StageChip({ stage, label }: { stage: string; label?: string }) {
  return (
    <span className="stage-chip" data-stage={stage}>
      {label ?? labels[stage] ?? stage}
    </span>
  )
}

/** Five short bars, one per office, filled up to the case's current office (Figma "Stage progress"). */
export function StageProgress({ stage }: { stage: string }) {
  const reached = stage === 'resolved' || stage === 'closed' ? caseStages.length : caseStages.indexOf(stage as (typeof caseStages)[number]) + 1
  const label = reached > 0 ? `Stage ${reached} of ${caseStages.length}` : 'Not yet with an office'
  return (
    <span className="stage-progress" role="img" aria-label={label}>
      {caseStages.map((step, index) => (
        <span key={step} data-on={index < reached || undefined} />
      ))}
    </span>
  )
}

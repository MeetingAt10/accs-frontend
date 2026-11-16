import { useEffect, useId, useRef, useState } from 'react'

import { tryEscalation, type DevUser, type EscalationTry } from '@/lib/dev-toolbox-api'

// Escalation lab (dev only): type a report as any student and see the first office and the engine's reasons.
// Nothing is stored or sent. The engine is rule-based and runs in the API (backend/src/escalation).

const offices: Record<string, string> = { adviser: 'Adviser', chair: 'Program Chair', dean: 'Dean', guidance: 'Guidance Office', osas: 'OSAS' }
const roles: Record<string, string> = { adviser: 'Adviser', subject: 'Subject professor', chair: 'Program Chair', dean: 'Dean' }
const samples = [
  'Si sir {surname} laging absent, buong section namin hindi naturuan.',
  'Tinulungan ako ni sir {surname}, pero yung registrar hindi nagrereply sa email ko.',
  'Adviser namin hindi pumapasok tuwing Friday.',
  'Buong BSIT walang schedule ng enrollment hanggang ngayon.',
  'The lab timetable changed on Monday and our group missed an activity.',
]

export function EscalationLab({ students, onClose }: { students: DevUser[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [reporterId, setReporterId] = useState(students[0]?.id ?? '')
  const [narrative, setNarrative] = useState(samples[0]!.replace('{surname}', 'Brook'))
  const [aboutAdvisor, setAboutAdvisor] = useState(false)
  const [result, setResult] = useState<EscalationTry>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const adviserSurname = result?.roster.find((p) => p.role === 'adviser')?.name.split(' ').at(-1) ?? 'Brook'

  async function run(text = narrative) {
    setBusy(true)
    setError(undefined)
    try {
      setResult(await tryEscalation(reporterId, text, aboutAdvisor))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not run the engine.')
    } finally {
      setBusy(false)
    }
  }

  const d = result?.decision
  return (
    <dialog ref={dialog} className="esc-lab" aria-labelledby={titleId} onClose={onClose}>
      <div className="dev-toolbox__head">
        <h2 className="dev-toolbox__title" id={titleId}>Escalation lab</h2>
        <span className="dev-toolbox__tag">Dev only · nothing is saved</span>
        <button type="button" className="dev-toolbox__retry esc-lab__close" onClick={() => dialog.current?.close()}>Close</button>
      </div>
      <form className="esc-lab__form" onSubmit={(event) => { event.preventDefault(); void run() }}>
        <label>
          Student filing the report
          <select value={reporterId} onChange={(event) => { setReporterId(event.target.value); setResult(undefined) }}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
          </select>
        </label>
        <label>
          Report text
          <textarea rows={4} value={narrative} maxLength={4000} onChange={(event) => setNarrative(event.target.value)} />
        </label>
        <div className="esc-lab__samples" aria-label="Sample reports">
          {samples.map((s) => {
            const text = s.replace('{surname}', adviserSurname)
            return <button key={s} type="button" className="dev-toolbox__retry" onClick={() => { setNarrative(text); void run(text) }}>{text.slice(0, 42)}…</button>
          })}
        </div>
        <label className="esc-lab__check">
          <input type="checkbox" checked={aboutAdvisor} onChange={(event) => setAboutAdvisor(event.target.checked)} />
          Student answered "This concern is about my adviser"
        </label>
        <button type="submit" className="dev-toolbox__retry" aria-disabled={busy || !narrative.trim() || undefined}>{busy ? 'Routing…' : 'Route this report'}</button>
      </form>
      {error && <p className="dev-toolbox__error" role="alert">{error}</p>}
      {d && (
        <section className="esc-lab__result" aria-live="polite">
          <p className="esc-lab__office">First office: <strong>{offices[d.stage] ?? d.stage}</strong>{d.possibleConflict && <span className="dev-toolbox__flag">Check for conflict</span>}</p>
          <p>{d.reason}</p>
          <p className="esc-lab__student">The student sees only: "With the {offices[d.stage] ?? d.stage}".</p>
          <dl className="esc-lab__facts">
            <dt>Rule</dt><dd>{d.trace.rule}</dd>
            <dt>Scope</dt><dd>{d.trace.scope}</dd>
            <dt>Critical words</dt><dd>{d.trace.criticalTerm ?? 'none'}</dd>
            <dt>Kept out</dt><dd>{d.involvedUserIds.map((id) => result.roster.find((p) => p.id === id)?.name ?? id).join(', ') || 'nobody'}</dd>
            <dt>Thresholds</dt><dd>bypass ≥ {d.trace.thresholds.bypass}, check ≥ {d.trace.thresholds.triage}</dd>
            <dt>Version</dt><dd>{d.trace.engineVersion} · {d.trace.lexiconVersion}</dd>
          </dl>
          {d.trace.heldBack.map((note) => <p key={note} className="esc-lab__held">{note}</p>)}
          <table className="esc-lab__table">
            <caption>Faculty mentioned (score = match × proximity)</caption>
            <thead><tr><th>Person</th><th>Matched</th><th>Complaint word</th><th>Match</th><th>Proximity</th><th>Score</th></tr></thead>
            <tbody>
              {d.trace.mentions.length ? d.trace.mentions.map((m) => (
                <tr key={m.personId} className={m.conflict >= d.trace.thresholds.bypass ? 'esc-lab__hot' : undefined}>
                  <td>{m.name}<br /><small>{roles[m.role] ?? m.role}</small></td>
                  <td>"{m.alias}" <small>({m.aliasKind})</small></td>
                  <td>{m.term ? `"${m.term}" · ${m.distance} words away` : 'none in the same clause'}</td>
                  <td>{m.matchScore}</td><td>{m.proximity}</td><td><strong>{m.conflict}</strong></td>
                </tr>
              )) : <tr><td colSpan={6}>No faculty of this student is mentioned.</td></tr>}
            </tbody>
          </table>
          <details>
            <summary>This student's faculty and the names the engine looks for</summary>
            <ul className="esc-lab__roster">
              {result.roster.map((p) => <li key={p.id}><strong>{p.name}</strong> · {roles[p.role]}: {p.aliases.join(', ')}</li>)}
            </ul>
          </details>
        </section>
      )}
    </dialog>
  )
}

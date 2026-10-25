import { createFileRoute } from '@tanstack/react-router'
import { Agenda, AgendaItem, Badge, DoorPlate } from '@meetingat10/design-system/react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="coming-soon">
      <section className="ds-sheet ds-sheet--pad coming-soon__sheet" aria-labelledby="coming-soon-title">
        <div className="coming-soon__head">
          <DoorPlate size="lg" code="Portal" />
          <Badge tone="info" form="pending">Coming soon</Badge>
        </div>
        <h1 id="coming-soon-title" className="ds-type-h1">Student portal</h1>
        <p className="ds-lead">
          Consultations, the academic forum, and confidential concern reporting will live here.
        </p>
        <Agenda>
          <AgendaItem chip="Consult" lane="consult" title="Book office hours" level={2}>
            Pick an open slot; nothing is booked until faculty confirm.
          </AgendaItem>
          <AgendaItem chip="Forum" lane="community" title="Ask, answer, share what helped" level={2}>
            The academic forum for the college community.
          </AgendaItem>
          <AgendaItem chip="Reports" lane="restricted" title="Your own records, kept apart" level={2}>
            Confidential concern reporting: you see only your own records.
          </AgendaItem>
        </Agenda>
      </section>
    </main>
  )
}

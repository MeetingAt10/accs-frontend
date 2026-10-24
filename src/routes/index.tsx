import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="coming-soon">
      <section className="coming-soon__card">
        <img
          className="coming-soon__logo"
          src="/accs-logo.svg"
          alt="ACCS — Access for College of Computer Studies"
          width={473}
          height={116}
        />
        <p className="coming-soon__badge">Coming soon</p>
        <h1 className="coming-soon__title">Student portal</h1>
        <p className="coming-soon__body">
          Consultations, the academic forum, and confidential concern reporting will live here.
        </p>
      </section>
    </main>
  )
}

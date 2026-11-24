import { useRouterState } from '@tanstack/react-router'

import { Kpi, Kpis, PageHeader, Panel, siteCrumb } from '@/components/app/page-shell'
import { formPages, recordPages } from '@/lib/page-catalog'

import { bar, SkeletonRows } from '@/components/app/skeleton-rows'

import './home.css'

export { SkeletonRows }

// Grey placeholders in the shape of the page while it loads: Home is a header, stat tiles and a list; the Feed is a
// column of post cards; any other page gets a header and one block.

export function PageSkeleton({ pageId }: { pageId: string }) {
  const cards = pageId === 'P04' ? 4 : pageId === 'P03' ? 3 : 1
  return (
    <div className="pg-skel" role="status" aria-busy="true">
      <span className="pg-skel__sr">Loading page</span>
      {bar('min(22rem, 70%)', 32)}
      {bar('40%')}
      {pageId === 'P03' && (
        <div className="pg-skel__tiles">
          {[0, 1, 2].map((i) => <div key={i} className="accs-skeleton pg-skel__tile" />)}
        </div>
      )}
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="pg-skel__card">
          {bar('30%')}
          {bar('70%', 18)}
          {bar('95%')}
          {pageId !== 'P04' && pageId !== 'P03' && <div className="accs-skeleton pg-skel__block" />}
        </div>
      ))}
    </div>
  )
}

/** Real KPI tiles (shell stays) with placeholder values. */
export function SkeletonKpis({ labels = ['Loading', 'Loading', 'Loading'] }: { labels?: string[] }) {
  return (
    <Kpis label="Loading overview">
      {labels.map((label, i) => <Kpi key={i} label={label} value={bar('30%', 28)} />)}
    </Kpis>
  )
}

/** A loading page: the real header and back link with placeholder panels. A record page has the title bar, main column and side column; a form page has labelled, disabled fields. */
export function PageLoading({ title, pageId, panels = [''], kpis = 0, children }: { title: string; pageId?: string; panels?: string[]; kpis?: number; children?: React.ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const record = !!pageId && recordPages.includes(pageId)
  const form = !!pageId && formPages.includes(pageId)
  return (
    <div className="accs-stack" aria-busy="true">
      <PageHeader title={title} crumbs={record || form ? [siteCrumb(path), { label: title }] : undefined} />
      <span className="pg-skel__sr" role="status">Loading {title}</span>
      {kpis > 0 && !record && !form && <SkeletonKpis labels={Array(kpis).fill('Loading')} />}
      {children}
      {form ? (
        <Panel aria-busy="true">
          <div className="pg-skel" aria-hidden>
            {[0, 1, 2, 3].map((i) => <div key={i} className="pg-skel__card" style={{ border: 0, padding: 0 }}>{bar('20%', 12)}{bar('100%', 40)}</div>)}
            {bar('8rem', 40)}
          </div>
        </Panel>
      ) : record ? (
        <div className="hm-cols">
          <div className="hm-col"><Panel aria-busy="true"><div className="pg-skel" aria-hidden>{bar('60%', 24)}{bar('30%')}{bar('95%')}{bar('90%')}{bar('70%')}</div></Panel><Panel flush aria-busy="true"><SkeletonRows /></Panel></div>
          <aside className="hm-col hm-side"><Panel flush aria-busy="true"><SkeletonRows count={3} /></Panel></aside>
        </div>
      ) : panels.map((name, i) => <Panel flush key={i} title={name || undefined} aria-busy="true"><SkeletonRows /></Panel>)}
    </div>
  )
}

const navBar = (width: string, height = 16) => <span className="accs-skeleton" style={{ display: 'block', width, height, background: 'rgb(255 255 255 / 14%)', animation: 'none' }} />

/** The app shell drawn before the session is known: same frame, side panel and top bar, so the real shell does not shift the page. */
export function ShellSkeleton({ pageId }: { pageId: string }) {
  return (
    <div className="app-chrome shell" data-site="portal" aria-busy="true">
      <div className="shell-frame">
        <aside className="shell-side" aria-hidden>
          <div className="shell-side__head">{navBar('60%', 28)}</div>
          <div className="shell-side__nav">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ padding: '10px 12px' }}>{navBar(`${55 + (i % 3) * 15}%`)}</div>)}</div>
        </aside>
        <div className="shell-main">
          <header className="shell-top" aria-hidden>
            {bar('10rem', 16)}
            <div className="shell-top__slot" />
            <div className="shell-top__tools">{bar('14rem', 32)}{bar('32px', 32)}</div>
          </header>
          <main className="shell-content" id="main-content">
            <div className="shell-content__inner"><div className="shell-page"><PageSkeleton pageId={pageId} /></div></div>
          </main>
        </div>
      </div>
    </div>
  )
}

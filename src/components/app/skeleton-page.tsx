import { Kpi, Kpis, PageHeader, Panel } from '@/components/app/page-shell'

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

/** A loading page: the real header (and optional actions) with a titled panel of placeholder rows in place of the data. */
export function PageLoading({ title, panels = [''], kpis = 0, children }: { title: string; panels?: string[]; kpis?: number; children?: React.ReactNode }) {
  return (
    <div className="accs-stack" aria-busy="true">
      <PageHeader title={title} />
      <span className="pg-skel__sr" role="status">Loading {title}</span>
      {kpis > 0 && <SkeletonKpis labels={Array(kpis).fill('Loading')} />}
      {children}
      {panels.map((name, i) => <Panel flush key={i} title={name || undefined} aria-busy="true"><SkeletonRows /></Panel>)}
    </div>
  )
}

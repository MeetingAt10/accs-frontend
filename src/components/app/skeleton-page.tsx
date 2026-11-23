import './home.css'

// Grey placeholders in the shape of the page while it loads: Home is a header, stat tiles and a list; the Feed is a
// column of post cards; any other page gets a header and one block.
const bar = (width: string, height = 14) => <div className="accs-skeleton" style={{ width, height }} />

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

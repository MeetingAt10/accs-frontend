import { createContext, useContext, type ReactNode } from 'react'

import './home.css'

export const bar = (width: string, height = 14) => <span className="accs-skeleton" style={{ display: 'block', width, height }} />

/** True while a page renders its real layout on empty data: Empty states and KPI values turn into placeholders. */
const LoadingContext = createContext(false)
export const useLoadingLayout = () => useContext(LoadingContext)

/** The page's own layout, drawn before its data arrives. Not interactive until the data is in. */
export function LoadingLayout({ children }: { children: ReactNode }) {
  return (
    <LoadingContext.Provider value>
      <div className="accs-loading-layout" aria-busy="true" inert>{children}</div>
    </LoadingContext.Provider>
  )
}

/** Placeholder list rows for the data-bound part of a panel. Hidden from assistive tech; the page carries aria-busy. */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    // Plain blocks, not .accs-row: that grid sizes its columns to content, which left percent-width bars at 0px.
    <div className="accs-skeleton-rows" aria-hidden style={{ display: 'grid', width: '100%' }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ display: 'grid', gap: 8, padding: '14px 0', borderTop: i ? '1px solid var(--accs-line)' : undefined }}>
          {bar('55%', 16)}{bar('35%', 12)}
        </div>
      ))}
    </div>
  )
}
